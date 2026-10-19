const fs = require('fs');
const path = require('path');

const root = '.';

// Known garbled patterns (from UTF-8 → Windows-1252 double-encoding)
const PATTERNS = [
  // â + € + " (RIGHT DOUBLE QUOTE) — corrupted em dash U+2014
  { pattern: '\u00e2\u20ac\u201d', label: 'corrupted em dash (\\u2014)' },
  // â + € + " (LEFT DOUBLE QUOTE) — corrupted en dash U+2013
  { pattern: '\u00e2\u20ac\u201c', label: 'corrupted en dash (\\u2013)' },
  // â + • + \x90 — corrupted box-drawing double U+2550
  { pattern: '\u00e2\u2022\u0090', label: 'corrupted double box-draw (\\u2550)' },
  // â + — + ˆ — corrupted diamond U+25C8
  { pattern: '\u00e2\u2014\u02c6', label: 'corrupted diamond (\\u25C8)' },
  // â + — + ‰ — corrupted fisheye U+25C9
  { pattern: '\u00e2\u2014\u2030', label: 'corrupted fisheye (\\u25C9)' },
  // â + soft-hyphen + \x90 — corrupted star U+2B50
  { pattern: '\u00e2\u00ad\u0090', label: 'corrupted star (\\u2B50)' },
  // â + † + ' — corrupted right-arrow U+2192
  { pattern: '\u00e2\u2020\u2018', label: 'corrupted arrow (\\u2192)' },
  // â + † + ' variant
  { pattern: '\u00e2\u2020\u2019', label: 'corrupted arrow (\\u2192)' },
  // Â· — corrupted middle dot U+00B7
  { pattern: '\u00c2\u00b7', label: 'corrupted middle dot (\\u00B7)' },
  // Â¢ — corrupted cent U+00A2
  { pattern: '\u00c2\u00a2', label: 'corrupted cent (\\u00A2)' },
  // Previous-generation mojibake from katakana corruption
  { pattern: '\u00e3\u201a', label: 'likely corrupted katakana' },
  // Love Of The Lord generation (UTF-8 read as Windows-1252, re-saved as UTF-8)
  { pattern: '\u00e2\u2014\u008f', label: 'corrupted black circle (\\u25CF)' },
  { pattern: '\u00e2\u0153\u201c', label: 'corrupted check mark (\\u2713)' },
  { pattern: '\u00e2\u0153\u2014', label: 'corrupted heavy check (\\u2714)' },
  { pattern: '\u00e2\u008f\u00ae', label: 'corrupted prev track (\\u23EE)' },
  { pattern: '\u00e2\u008f\u00ad', label: 'corrupted next track (\\u23ED)' },
  { pattern: '\u00f0\u0178\u2122\u008f', label: 'corrupted folded hands (\\u1F64F)' },
  { pattern: '\u00f0\u0178\u0152\u2122', label: 'corrupted mic (\\u1F399)' },
  { pattern: '\u00f0\u0178\u017d\u00a7', label: 'corrupted headphone (\\u1F3A7)' },
  { pattern: '\u00f0\u0178\u017d\u00b5', label: 'corrupted musical note (\\u1F3B5)' },
  { pattern: '\u00f0\u0178\u017d\u2030', label: 'corrupted party popper (\\u1F389)' },
  { pattern: '\u00f0\u0178\u2013\u00a8', label: 'corrupted printer (\\u1F5A8)' },
  { pattern: '\u00e2\u02dc\u2026', label: 'corrupted black star (\\u2605)' },
  { pattern: '\u00ef\u00bc\u2039', label: 'corrupted fullwidth plus (\\uFF0B)' },
  { pattern: '\u00e2\u20ac\u00a6', label: 'corrupted ellipsis (\\u2026)' },
  { pattern: '\u00e2\u201a\u00b5', label: 'corrupted cedi (\\u20B5)' },
  { pattern: '\u00e2\u2030\u02c6', label: 'corrupted almost-equal (\\u2248)' },
  { pattern: '\u00e2\u2020\u0090', label: 'corrupted left arrow (\\u2190)' },
  { pattern: '\u00e2\u2020\u00ba', label: 'corrupted anticlockwise arrow (\\u21BA)' },
  { pattern: '\u00e2\u2013\u00b4', label: 'corrupted up triangle (\\u25B4)' },
  { pattern: '\u00e2\u2013\u00be', label: 'corrupted down triangle (\\u25BE)' },
];

function walk(dir, exts, results) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full, exts, results);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.includes(ext)) {
          results.push(full);
        }
      }
    }
  } catch { /* permission denied, skip */ }
}

const exts = ['.html', '.css', '.js', '.json'];
const files = [];
walk(root, exts, files);

let exitCode = 0;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { pattern, label } of PATTERNS) {
    let idx = 0;
    while ((idx = content.indexOf(pattern, idx)) >= 0) {
      if (exitCode === 0) {
        console.error('Mojibake found:');
        exitCode = 1;
      }
      // Get surrounding line
      const before = content.lastIndexOf('\n', idx);
      const after = content.indexOf('\n', idx);
      const lineNum = (content.slice(0, idx).match(/\n/g) || []).length + 1;
      const line = content.slice(
        before < 0 ? 0 : before + 1,
        after < 0 ? undefined : after
      ).trim();
      const relPath = path.relative(root, file);
      console.error(`  ${relPath}:${lineNum}  ${label}  —  "${line.slice(0, 80)}"`);
      idx += 1;
    }
  }
}

if (exitCode === 0) {
  console.log('No mojibake found.');
} else {
  console.error('\nRun `node scripts/fix-mojibake.js` to repair.');
}
process.exit(exitCode);
