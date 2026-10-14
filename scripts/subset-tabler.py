#!/usr/bin/env python3
"""Subset Tabler webfont + CSS to glyphs actually used in the repo.

Usage: python3 scripts/subset-tabler.py [--check]
  default: rebuild assets/fonts/tabler/{fonts/tabler-icons.woff2,tabler-icons.min.css}
  --check: report only (used count, missing rules, dynamic suspects, sizes).

Safety:
  - scans ALL *.html/*.js (excl. node_modules, coverage, the tabler css itself)
  - any `ti-*` token adjacent to JS dynamism ($, +, concat, template) is REPORTED;
    if suspects exist the script still runs but exits nonzero in --check mode.
  - woff/ttf legacy files are left on disk; only the woff2 URL is kept in CSS.
  - font URL query is bumped (?v=subset-N) so the immutable _headers cache busts.
"""
import os
import re
import sys
import shutil
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'assets', 'fonts', 'tabler')
WOFF2 = os.path.join(FONT_DIR, 'fonts', 'tabler-icons.woff2')
CSS = os.path.join(FONT_DIR, 'tabler-icons.min.css')
CHECK = '--check' in sys.argv

TOKEN_RE = re.compile(r'ti-[a-z0-9-]+')
RULE_RE = re.compile(r'\.(ti-[a-z0-9-]+):before\{content:"(\\[0-9a-f]+)"\}')
# True prefix-building only: an empty 'ti-' string being concatenated, or ${} inside.
DYNAMIC_RE = re.compile(r"""['"]ti-['"]|ti-\$\{""")


def repo_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.git', 'coverage', '.wrangler')]
        for fn in filenames:
            if fn.endswith(('.html', '.js')):
                p = os.path.join(dirpath, fn)
                if os.path.abspath(p) == os.path.abspath(CSS):
                    continue
                yield p


def main():
    used = set()
    suspects = []
    files_scanned = 0
    for path in repo_files():
        try:
            with open(path, encoding='utf-8', errors='replace') as f:
                text = f.read()
        except OSError:
            continue
        files_scanned += 1
        for tok in TOKEN_RE.findall(text):
            if tok != 'ti-':
                used.add(tok)
        for i, line in enumerate(text.splitlines(), 1):
            if 'ti-' in line and DYNAMIC_RE.search(line):
                suspects.append('%s:%d: %s' % (os.path.relpath(path, ROOT), i, line.strip()[:110]))

    with open(CSS, encoding='utf-8') as f:
        css = f.read()
    rules = dict(RULE_RE.findall(css))  # name -> \xxxx
    # tokens used in markup with no matching icon rule (typos / utilities)
    missing_rules = sorted(u for u in used if u not in rules)
    keep = sorted(u for u in used if u in rules)

    css_size = os.path.getsize(CSS)
    woff2_size = os.path.getsize(WOFF2)
    print('files scanned : %d' % files_scanned)
    print('used tokens   : %d (with CSS rule: %d, without rule: %d)' % (len(used), len(keep), len(missing_rules)))
    if missing_rules:
        print('tokens WITHOUT css rule (will not render today either):')
        for m in missing_rules[:30]:
            print('  - %s' % m)
    if suspects:
        print('DYNAMIC SUSPECTS (%d) - hand-check before trusting subset:' % len(suspects))
        for s in suspects[:20]:
            print('  ! %s' % s)
    print('css now       : %.1fKB, woff2 now: %.1fKB' % (css_size / 1024, woff2_size / 1024))

    if CHECK:
        return 1 if suspects else 0

    # --- rebuild woff2 ---
    unicodes = ['U+%04X' % int(code[1:], 16) for code in (rules[k] for k in keep)]
    tmp = WOFF2 + '.subset-tmp.woff2'
    cmd = [sys.executable, '-m', 'fontTools.subset', WOFF2,
           '--output-file=' + tmp,
           '--flavor=woff2',
           '--unicodes=' + ','.join(unicodes),
           '--layout-features=',
           '--no-hinting',
           '--desubroutinize',
           '--name-IDs=',
           '--glyph-names=False',
           '--recalc-bounds',
           '--drop-tables+=DSIG']
    print('subset: %d codepoints -> pyftsubset' % len(unicodes))
    subprocess.run(cmd, check=True)
    shutil.move(tmp, WOFF2)

    # --- rebuild css: header comment + @font-face (new query, woff2 only) + base .ti + kept rules ---
    header = css.split('@font-face')[0]
    base_m = re.search(r'\.ti\{[^}]+\}', css)
    base = base_m.group(0) if base_m else ''
    parts = [header,
             '@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;'
             'font-display:swap;src:url("./fonts/tabler-icons.woff2?v=subset1") format("woff2")}',
             base]
    for name in keep:
        parts.append('.%s:before{content:"%s"}' % (name, rules[name]))
    new_css = ''.join(parts)
    with open(CSS, 'w', encoding='utf-8', newline='') as f:
        f.write(new_css)
    print('css rebuilt   : %.1fKB -> %.1fKB' % (css_size / 1024, os.path.getsize(CSS) / 1024))
    print('woff2 rebuilt : %.1fKB -> %.1fKB' % (woff2_size / 1024, os.path.getsize(WOFF2) / 1024))
    print('kept rules    : %d' % len(keep))
    return 0


if __name__ == '__main__':
    sys.exit(main())
