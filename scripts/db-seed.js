import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';

const DB = 'gahq';

const SQL = `
DELETE FROM testimonials WHERE id NOT IN (SELECT MIN(id) FROM testimonials GROUP BY author, content);
DELETE FROM stats WHERE id NOT IN (SELECT MIN(id) FROM stats GROUP BY label, value);
DELETE FROM gallery WHERE id NOT IN (SELECT MIN(id) FROM gallery GROUP BY title, image_url);

INSERT OR IGNORE INTO testimonials (author, role, content, rating) VALUES
  ('Sarah', 'Creative Professional', 'Gideon''s teaching on creativity as worship completely shifted how I see my work.', 5),
  ('James', 'Bible Study Leader', 'The Bible as Kingdom OS opened my eyes to see Scripture in a whole new way.', 5),
  ('Grace', 'Young Professional', 'This ministry helped me understand that my faith and my career are not separate.', 5);

INSERT OR IGNORE INTO stats (label, value, icon, sort_order, active) VALUES
  ('TikTok Followers & Growing', '10000', '\u{1F4F1}', 1, 1),
  ('Books Published', '2', '\u{1F4D6}', 2, 1),
  ('Daily Video Views', '500', '\u{1F3AC}', 3, 1),
  ('Mission Year', '1', '\u{1F31F}', 4, 1);

INSERT OR IGNORE INTO gallery (title, description, image_url, category, sort_order) VALUES
  ('Teaching Session', 'Gideon teaching at a community event', 'assets/images/gallery/teaching-session.jpg', 'events', 1),
  ('Creative Workshop', 'Interactive creative workshop session', 'assets/images/gallery/creative-workshop.jpg', 'events', 2),
  ('Community Outreach', 'Engaging with the local community', 'assets/images/gallery/community-outreach.jpg', 'outreach', 3);

INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (1, 'admin'), (2, 'admin'), (3, 'admin'), (5, 'admin'), (6, 'admin'), (7, 'admin');
`;

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('This will reset testimonials, stats, gallery, and phase_verifications to defaults. Continue? [y/N] ', (answer) => {
  rl.close();
  if (!/^y/i.test(answer)) {
    console.log('Aborted.');
    process.exit(0);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'db-seed-'));
  const tmpFile = join(tmpDir, 'seed.sql');
  writeFileSync(tmpFile, SQL, 'utf8');

  try {
    const out = execSync(`npx wrangler d1 execute ${DB} --file="${tmpFile}" --json 2>&1`, {
      encoding: 'utf8', timeout: 60000
    });
    console.log(out);
    console.log('Seed complete.');
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup */ }
    try { unlinkSync(tmpDir); } catch { /* ignore cleanup */ }
  }
});
