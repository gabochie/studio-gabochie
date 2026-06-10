import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const DB = 'gahq';

// Skip FK checks if wrangler isn't authenticated (e.g. local dev without CLOUDFLARE_API_TOKEN)
try {
  execSync('npx wrangler whoami 2>&1', { encoding: 'utf8', timeout: 10000 });
} catch {
  console.warn('⚠ wrangler not authenticated — skipping FK checks (CI will enforce them)');
  process.exit(0);
}

const CHECKS = [
  ['orphaned enrollments (no program)',
    'SELECT COUNT(*) AS cnt FROM enrollments WHERE program_id NOT IN (SELECT id FROM programs)'],
  ['orphaned modules (no program)',
    'SELECT COUNT(*) AS cnt FROM modules WHERE program_id NOT IN (SELECT id FROM programs)'],
  ['orphaned module_completions (no enrollment)',
    'SELECT COUNT(*) AS cnt FROM module_completions WHERE enrollment_id NOT IN (SELECT id FROM enrollments)'],
  ['orphaned module_completions (no module)',
    'SELECT COUNT(*) AS cnt FROM module_completions WHERE module_id NOT IN (SELECT id FROM modules)'],
  ['orphaned certificates (no enrollment)',
    'SELECT COUNT(*) AS cnt FROM certificates WHERE enrollment_id NOT IN (SELECT id FROM enrollments)'],
  ['orphaned sponsor_sessions (no sponsor)',
    'SELECT COUNT(*) AS cnt FROM sponsor_sessions WHERE email NOT IN (SELECT email FROM sponsors)'],
  ['orphaned agent_instances (no agent_type)',
    'SELECT COUNT(*) AS cnt FROM agent_instances WHERE agent_type_id NOT IN (SELECT id FROM agent_types)'],
  ['orphaned agent_runs (no agent_instance)',
    'SELECT COUNT(*) AS cnt FROM agent_runs WHERE agent_instance_id NOT IN (SELECT id FROM agent_instances)'],
  ['orphaned workflow_steps (no workflow)',
    'SELECT COUNT(*) AS cnt FROM workflow_steps WHERE workflow_id NOT IN (SELECT id FROM workflows)'],
  ['orphaned sessions (no user)',
    'SELECT COUNT(*) AS cnt FROM sessions WHERE user_id NOT IN (SELECT id FROM users)'],
  ['orphaned student_achievements (no enrollment)',
    'SELECT COUNT(*) AS cnt FROM student_achievements WHERE enrollment_id NOT IN (SELECT id FROM enrollments)']
];

const tmpDir = mkdtempSync(join(tmpdir(), 'fk-check-'));
let failed = 0;

for (const [label, sql] of CHECKS) {
  const tmpFile = join(tmpDir, 'check.sql');
  writeFileSync(tmpFile, sql, 'utf8');
  try {
    const out = execSync(`npx wrangler d1 execute ${DB} --file="${tmpFile}" --json 2>&1`, {
      encoding: 'utf8', timeout: 30000
    });
    const lines = out.trim().split('\n');
    const last = lines[lines.length - 1];
    const parsed = JSON.parse(last);
    const row = parsed?.[0]?.results?.[0];
    const count = Number(row?.cnt) || 0;
    if (count > 0) {
      console.error(`FAIL: ${count} ${label}`);
      failed++;
    }
  } catch (e) {
    console.error(`ERROR: ${label} — ${e.message}`);
    failed++;
  }
}

try { unlinkSync(join(tmpDir, 'check.sql')); } catch { /* ignore */ }
try { unlinkSync(tmpDir); } catch { /* ignore */ }

if (failed === 0) {
  console.log(`PASS: ${CHECKS.length} FK checks — no orphans`);
} else {
  console.error(`FAILED: ${failed} FK check(s) have orphans`);
}
process.exit(failed > 0 ? 1 : 0);
