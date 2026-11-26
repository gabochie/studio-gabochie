import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getStatements } from '../functions/api/db/setup.js';

const DB = 'gahq';
const tmpDir = mkdtempSync(join(tmpdir(), 'db-setup-'));

// Single source of truth: no regex extraction from setup.js source (that used
// to leak raw `${...}` placeholders into the generated SQL and skipped the
// 30-day social_queue seed entirely).
const statements = getStatements();
const plain = [];
const columnMigrations = [];
const onceMigrations = [];
for (const statement of statements) {
  if (typeof statement === 'string') plain.push(statement);
  else if (statement.kind === 'column') columnMigrations.push(statement);
  else if (statement.kind === 'once') onceMigrations.push(statement);
  else plain.push(statement.sql);
}

function runSql(sql, json) {
  const file = join(tmpDir, 'setup-' + runSql.n++ + '.sql');
  writeFileSync(file, sql + '\n', 'utf8');
  const args = ['npx', 'wrangler', 'd1', 'execute', DB, `--file="${file}"`, '--remote'];
  if (json) args.push('--json');
  return execSync(args.join(' '), { encoding: 'utf8', timeout: 120000 });
}

runSql.n = 1;

function parseWranglerJson(out) {
  const text = String(out || '').trim();
  if (!text) return [];
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const start = text.search(/[[{]/);
  if (start < 0) return [];
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
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
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('Could not parse wrangler JSON output');
}

function rowsOf(out) {
  const parsed = parseWranglerJson(out);
  // Wrangler --json emits either a single { results: [...] } object or an
  // array of them, depending on version. Handle both so PRAGMA checks see
  // the real columns instead of treating every column as missing.
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.results)) return parsed.results;
  if (Array.isArray(parsed)) {
    if (parsed[0] && Array.isArray(parsed[0].results)) return parsed[0].results;
    if (parsed[0] && Array.isArray(parsed[0].rows)) return parsed[0].rows;
  }
  return [];
}

function fail(message, err) {
  console.error(message);
  if (err && err.stderr) console.error(String(err.stderr).trim());
  if (err && err.stdout) console.error(String(err.stdout).trim().slice(0, 1000));
  process.exitCode = 1;
  throw err || new Error(message);
}

const isCreateTable = (sql) => /^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(sql);
const createTables = plain.filter(isCreateTable);
const otherPlain = plain.filter((sql) => !isCreateTable(sql));

console.log(`Running ${plain.length} setup statements (plus ${columnMigrations.length} guarded columns and ${onceMigrations.length} one-time migrations)...`);
try {
  // Tables exist before any column migration or data statement runs. This is
  // essential for legacy production DBs whose tables predate several columns.
  const out = runSql(createTables.join(';\n\n') + ';', false);
  console.log(out);
  if (/\bERROR\b/i.test(out)) fail('D1 setup reported errors');

  // Only emit ALTER TABLE for columns that are actually missing. Fresh DBs
  // already have them from CREATE TABLE; legacy DBs get them once.
  const byTable = {};
  for (const migration of columnMigrations) {
    (byTable[migration.table] = byTable[migration.table] || []).push(migration);
  }
  const extra = [];
  for (const table of Object.keys(byTable)) {
    const rows = rowsOf(runSql(`PRAGMA table_info(${table});`, true));
    const present = new Set(rows.map((r) => r && r.name).filter(Boolean));
    for (const migration of byTable[table]) {
      if (!present.has(migration.column)) extra.push(migration.sql);
    }
  }

  // Indexes, inserts and updates run only after every guarded column exists.
  if (otherPlain.length) {
    const plainOut = runSql(otherPlain.join(';\n\n') + ';', false);
    console.log(plainOut);
    if (/\bERROR\b/i.test(plainOut)) fail('D1 setup reported errors');
  }

  const applied = new Set(rowsOf(runSql('SELECT name FROM setup_migrations', true)).map((r) => r && r.name));
  for (const migration of onceMigrations) {
    if (applied.has(migration.name)) continue;
    extra.push(migration.sql);
    extra.push(`INSERT OR IGNORE INTO setup_migrations (name) VALUES ('${migration.name.replace(/'/g, "''")}')`);
  }

  if (extra.length) {
    console.log(`Applying ${extra.length} guarded migration statement(s)...`);
    const extraOut = runSql(extra.join(';\n\n') + ';', false);
    console.log(extraOut);
    if (/\bERROR\b/i.test(extraOut)) fail('D1 guarded migrations reported errors');
  } else {
    console.log('Schema already up to date (no guarded migrations needed).');
  }
  console.log('D1 setup complete.');
} catch (e) {
  console.error('Setup failed:', e.message);
  process.exitCode = 1;
} finally {
  try {
    for (const name of readdirSync(tmpDir)) { try { unlinkSync(join(tmpDir, name)); } catch { /* ignore */ } }
    rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* ignore cleanup */ }
}
