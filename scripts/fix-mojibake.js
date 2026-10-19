import fs from 'fs';
import path from 'path';

const root = '.';

// Corrupted (UTF-8 double-encoded) sequence -> intended character.
// Mirrors the PATTERNS table in scripts/check-mojibake.cjs.
const FIXES = [
  ['\u00e2\u20ac\u201d', '\u2014'], // em dash
  ['\u00e2\u20ac\u201c', '\u2013'], // en dash
  ['\u00e2\u2022\u0090', '\u2550'], // double box-draw
  ['\u00e2\u2014\u02c6', '\u25C8'], // diamond
  ['\u00e2\u2014\u2030', '\u25C9'], // fisheye
  ['\u00e2\u00ad\u0090', '\u2B50'], // star
  ['\u00e2\u2020\u2018', '\u2192'], // right arrow
  ['\u00e2\u2020\u2019', '\u2192'], // right arrow (variant)
  ['\u00c2\u00b7', '\u00B7'], // middle dot
  ['\u00c2\u00a2', '\u00A2'], // cent
  ['\u00e2\u2013\u00b6', '\u25B6'], // black right-pointing triangle (▶) mojibake
  // Love Of The Lord generation (UTF-8 read as Windows-1252, re-saved as UTF-8)
  ['\u00e2\u2014\u008f', '\u25CF'], // ● black circle
  ['\u00e2\u0153\u201c', '\u2713'], // ✓ check mark
  ['\u00e2\u0153\u2014', '\u2714'], // ✔ heavy check
  ['\u00e2\u008f\u00ae', '\u23EE'], // ⏮ prev track
  ['\u00e2\u008f\u00ad', '\u23ED'], // ⏭ next track
  ['\u00f0\u0178\u2122\u008f', '\u{1F64F}'], // 🙏 folded hands
  ['\u00f0\u0178\u0152\u2122', '\u{1F399}'], // 🎙 studio microphone
  ['\u00f0\u0178\u017d\u00a7', '\u{1F3A7}'], // 🎧 headphone
  ['\u00f0\u0178\u017d\u00b5', '\u{1F3B5}'], // 🎵 musical note
  ['\u00f0\u0178\u017d\u2030', '\u{1F389}'], // 🎉 party popper
  ['\u00f0\u0178\u2013\u00a8', '\u{1F5A8}'], // 🖨 printer
  ['\u00e2\u02dc\u2026', '\u2605'], // ★ black star
  ['\u00ef\u00bc\u2039', '\uFF0B'], // ＋ fullwidth plus
  ['\u00e2\u20ac\u00a6', '\u2026'], // … ellipsis
  ['\u00e2\u201a\u00b5', '\u20B5'], // ₵ cedi
  ['\u00e2\u2030\u02c6', '\u2248'], // ≈ almost equal
  ['\u00e2\u2020\u0090', '\u2190'], // ← left arrow
  ['\u00e2\u2020\u00ba', '\u21BA'], // ↺ anticlockwise arrow
  ['\u00e2\u2013\u00b4', '\u25B4'], // ▴ up triangle
  ['\u00e2\u2013\u00be', '\u25BE'], // ▾ down triangle
];

function walk(dir, exts, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, exts, results);
    } else if (entry.isFile() && exts.includes(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
}

const exts = ['.html', '.css', '.js', '.json'];
const files = [];
walk(root, exts, files);

let changed = 0;
let replacements = 0;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  let next = content;
  for (const [bad, good] of FIXES) {
    let idx = 0;
    while ((idx = next.indexOf(bad, idx)) >= 0) {
      next = next.slice(0, idx) + good + next.slice(idx + bad.length);
      replacements++;
      idx += good.length;
    }
  }
  if (next !== content) {
    fs.writeFileSync(file, next, 'utf8');
    console.log(`fixed  ${path.relative(root, file)}`);
    changed++;
  }
}

const filesWord = changed === 1 ? 'file' : 'files';
console.log(`\nRepaired ${replacements} occurrence(s) in ${changed} ${filesWord}.`);
