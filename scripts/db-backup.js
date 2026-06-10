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
  const out = execSync(`npx wrangler d1 execute ${DB} --file="${listFile}" --json 2>&1`, {
    encoding: 'utf8', timeout: 30000
  });
  const lines = out.trim().split('\n');
  const last = lines[lines.length - 1];
  const parsed = JSON.parse(last);
  tables = (parsed?.[0]?.results || []).map(r => r.name).filter(Boolean);
} catch (e) {
  console.error('Failed to list tables:', e.message);
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
    const out = execSync(`npx wrangler d1 execute ${DB} --file="${sqlFile}" --json 2>&1`, {
      encoding: 'utf8', timeout: 60000
    });
    const lines = out.trim().split('\n');
    const last = lines[lines.length - 1];
    const parsed = JSON.parse(last);
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

console.log(`\nBackup saved to ${OUT_DIR}`);
console.log(`${exported} tables exported, ${failed} failed`);
process.exit(failed > 0 && exported === 0 ? 1 : 0);
