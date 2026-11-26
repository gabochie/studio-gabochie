import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const DB = 'gahq';
const BACKUP_DIR = resolve('d1-backups');
// One timestamp for the entire run: every table file and the manifest describe
// the same snapshot instead of drifting while a slow export is in progress.
const SNAPSHOT_AT = new Date().toISOString();
const TIMESTAMP = SNAPSHOT_AT.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const OUT_DIR = join(BACKUP_DIR, TIMESTAMP);
// These tables must survive a restore, so their exported row counts are
// verified against the database rather than trusted from the export alone.
const CRITICAL_TABLES = ['donations', 'subscribers'];

mkdirSync(OUT_DIR, { recursive: true });

const tmpDir = mkdtempSync(join(tmpdir(), 'db-backup-'));
const listSql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
let tables = [];

function runQuery(sql, label) {
  const file = join(tmpDir, label.replace(/[^\w]/g, '_') + '.sql');
  writeFileSync(file, sql + '\n', 'utf8');
  const out = execSync(`npx wrangler d1 execute ${DB} --remote --file="${file}" --json`, {
    encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return (parseWranglerJson(out)[0] || {}).results || [];
}

try {
  tables = runQuery(listSql, 'list_tables').map((r) => r.name).filter((n) => /^[A-Za-z_][\w]*$/.test(n));
} catch (e) {
  console.error('Failed to list tables:', e.message);
  if (e.stderr) console.error('wrangler stderr:', e.stderr.toString().trim());
  if (e.stdout) console.error('wrangler stdout:', e.stdout.toString().trim().slice(0, 500));
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

if (tables.length === 0) {
  console.log('No tables found.');
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

let exported = 0;
let failed = [];
const manifest = {
  database: DB,
  snapshot_at: SNAPSHOT_AT,
  created_at: SNAPSHOT_AT,
  critical_tables: CRITICAL_TABLES,
  tables: {},
  critical_row_counts: {},
  failed: failed
};

try {
  // Schema definition is part of a restorable backup; rows alone are not.
  const schema = runQuery("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name", 'schema');
  writeFileSync(join(OUT_DIR, '_schema.json'), JSON.stringify(schema, null, 2), 'utf8');

  for (const table of tables) {
    try {
      const rows = runQuery(`SELECT * FROM "${table}"`, 'table_' + table);
      // Stage the payload before writing the destination; a thrown
      // stringify/write leaves no truncated file in the backup directory.
      const staging = join(tmpDir, `${table}.json`);
      const payload = JSON.stringify(rows, null, 2);
      writeFileSync(staging, payload, 'utf8');
      writeFileSync(join(OUT_DIR, `${table}.json`), payload, 'utf8');
      manifest.tables[table] = rows.length;
      if (CRITICAL_TABLES.indexOf(table) !== -1) {
        // Re-count immediately after export. A mismatch (or a failed count)
        // invalidates the whole backup, not just this one table.
        var countRows = runQuery(`SELECT COUNT(*) AS cnt FROM "${table}"`, 'count_' + table);
        var counted = Number((countRows[0] || {}).cnt);
        if (!Number.isFinite(counted) || counted !== rows.length) {
          throw new Error(`Row-count verification failed for critical table ${table}: exported ${rows.length}, database reports ${counted}`);
        }
        manifest.critical_row_counts[table] = { exported: rows.length, verified: counted };
      }
      exported++;
      process.stdout.write(`  ${table}: ${rows.length} rows\n`);
    } catch (e) {
      failed.push({ table: table, error: String((e && e.message) || e), critical: CRITICAL_TABLES.indexOf(table) !== -1 });
      // Never leave an unverified table file that looks like a valid snapshot.
      try { rmSync(join(OUT_DIR, `${table}.json`), { force: true }); } catch { /* ignore cleanup */ }
      console.error(`  ${table}: ERROR — ${String((e && e.message) || e)}`);
      if (e.stderr) console.error(String(e.stderr).trim().slice(0, 300));
    }
  }
} finally {
  // The old code tried unlinkSync() on the temp directory itself, so every
  // run leaked a directory in the OS temp folder.
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
}

writeFileSync(join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`\nBackup saved to ${OUT_DIR}`);
console.log(`${exported} tables exported, ${failed.length} failed (snapshot ${SNAPSHOT_AT})`);
// A partial backup must not look successful to the GitHub Action.
process.exit(failed.length > 0 ? 1 : 0);

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
