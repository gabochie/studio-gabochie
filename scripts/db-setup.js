import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const DB = 'gahq';

// Extract SQL from setup.js template-literal array
const src = readFileSync(join('functions', 'api', 'db', 'setup.js'), 'utf8');
const regex = /`([^`]+)`/g;
const statements = [];
let match;
while ((match = regex.exec(src)) !== null) {
  const sql = match[1].trim();
  if (sql.length > 10) statements.push(sql);
}

// Write to temp file
const tmpDir = mkdtempSync(join(tmpdir(), 'db-setup-'));
const tmpFile = join(tmpDir, 'setup.sql');
writeFileSync(tmpFile, statements.join(';\n\n') + ';', 'utf8');

console.log(`Running ${statements.length} setup statements...`);

try {
  const out = execSync(`npx wrangler d1 execute ${DB} --file="${tmpFile}" --remote 2>&1`, {
    encoding: 'utf8', timeout: 120000
  });
  console.log(out);

  // Check for ALTER TABLE errors (harmless on re-run)
  const lines = out.split('\n');
  let errors = 0;
  let alterErrors = 0;
  for (const line of lines) {
    if (line.includes('ERROR')) {
      if (line.includes('ALTER') || line.includes('duplicate column')) {
        alterErrors++;
      } else {
        console.error('UNEXPECTED:', line);
        errors++;
      }
    }
  }
  if (alterErrors > 0) {
    console.log(`(${alterErrors} ALTER TABLE warnings — columns already exist, harmless)`);
  }
  if (errors > 0) {
    console.error(`${errors} unexpected errors — check above`);
    process.exit(1);
  }
  console.log('D1 setup complete.');
} catch (e) {
  // wrangler may exit non-zero even for harmless ALTER errors
  const stderr = e.stderr || '';
  if (stderr.includes('duplicate column') || stderr.includes('already exists')) {
    console.log('Setup complete (schema already up-to-date, ALTER TABLE warnings ignored).');
  } else {
    console.error('Setup failed:', e.message);
    process.exit(1);
  }
} finally {
  try { unlinkSync(tmpFile); } catch { /* ignore cleanup */ }
  try { unlinkSync(tmpDir); } catch { /* ignore cleanup */ }
}
