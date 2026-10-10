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
