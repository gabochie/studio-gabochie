import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const DB = 'gahq';
const BACKUP_DIR = resolve('d1-backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const OUT_DIR = join(BACKUP_DIR, TIMESTAMP);

mkdirSync(OUT_DIR, { recursive: true });

const tmpDir = mkdtempSync(join(tmpdir(), 'db-backup-'));
const listSql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
const listFile = join(tmpDir, 'tables.sql');
writeFileSync(listFile, listSql, 'utf8');

let tables;
try {
  const out = execSync(`npx wrangler d1 execute ${DB} --remote --file="${listFile}" --json`, {
    encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = parseWranglerJson(out);
  tables = (parsed?.[0]?.results || []).map(r => r.name).filter(Boolean);
} catch (e) {
  // execSync hides stderr unless we read it back, so surface wrangler's real message.
  console.error('Failed to list tables:', e.message);
  if (e.stderr) console.error('wrangler stderr:', e.stderr.toString().trim());
  if (e.stdout) console.error('wrangler stdout:', e.stdout.toString().trim().slice(0, 500));
  process.exit(1);
}

if (tables.length === 0) {
  console.log('No tables found.');
  process.exit(0);
}

let exported = 0;
let failed = 0;

for (const table of tables) {
  const sql = `SELECT * FROM "${table}"`;
  const sqlFile = join(tmpDir, `${table}.sql`);
  writeFileSync(sqlFile, sql, 'utf8');
  try {
    const out = execSync(`npx wrangler d1 execute ${DB} --remote --file="${sqlFile}" --json`, {
      encoding: 'utf8', timeout: 60000
    });
    const parsed = parseWranglerJson(out);
    const rows = parsed?.[0]?.results || [];
    writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
    exported++;
    process.stdout.write(`  ${table}: ${rows.length} rows\n`);
  } catch (e) {
    console.error(`  ${table}: ERROR — ${e.message}`);
    failed++;
  }
}

try { unlinkSync(listFile); } catch { /* ignore */ }
try { unlinkSync(tmpDir); } catch { /* ignore */ }

// Wrangler --json output is not guaranteed to be a single trailing line:
// newer versions pretty-print across lines and may prefix log lines.
// Extract the first balanced [...] or {...} block and parse that.
function parseWranglerJson(out) {
  const text = String(out || '').trim();
  if (!text) throw new Error('empty wrangler output');
  try {
    return JSON.parse(text);
  } catch { /* fall through to extraction */ }
  const startIdx = text.search(/[[{]/);
  if (startIdx === -1) throw new Error('no JSON found in wrangler output: ' + text.slice(0, 120));
  const open = text[startIdx];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(startIdx, i + 1));
    }
  }
  throw new Error('unterminated JSON in wrangler output: ' + text.slice(startIdx, startIdx + 120));
}

console.log(`\nBackup saved to ${OUT_DIR}`);
console.log(`${exported} tables exported, ${failed} failed`);
process.exit(failed > 0 && exported === 0 ? 1 : 0);
