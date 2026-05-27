import { writeFileSync, chmodSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const hookContent = `#!/usr/bin/env node
try {
  require('child_process').execSync('npx lint-staged', {
    stdio: 'inherit',
    cwd: require('path').resolve(__dirname, '..'),
  });
} catch (e) {
  process.exit(1);
}
`;

const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim();
const hookPath = gitDir + '/hooks/pre-commit';

if (!existsSync(gitDir + '/hooks')) {
  execSync('mkdir ' + gitDir + '/hooks', { shell: true });
}

writeFileSync(hookPath, hookContent, 'utf8');
chmodSync(hookPath, '755');
console.log('pre-commit hook installed at ' + hookPath);
