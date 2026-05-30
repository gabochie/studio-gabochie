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
