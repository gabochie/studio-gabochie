import fs from 'fs';
import path from 'path';

const MIGRATION_SQL = `
-- Outreach tracking & delivery tables
-- Run via: npx wrangler d1 execute gahq --file=scripts/migrate-outreach-tracking.sql

-- Add tracking columns to email_queue
ALTER TABLE email_queue ADD COLUMN opened_at TEXT;
ALTER TABLE email_queue ADD COLUMN clicked_at TEXT;
ALTER TABLE email_queue ADD COLUMN provider_id TEXT;
ALTER TABLE email_queue ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN last_error TEXT;

-- Suppression list (compliance)
CREATE TABLE IF NOT EXISTS suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT, -- 'unsubscribe', 'bounce', 'complaint'
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tracking events
CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER,
  contact_id INTEGER,
  event_type TEXT, -- 'open', 'click', 'unsubscribe'
  event_data TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_events_message ON tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_contact ON tracking_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON suppression_list(email);

-- WhatsApp queue (placeholder for future)
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  segment TEXT,
  status TEXT DEFAULT 'pending',
  scheduled_at TEXT,
  sent_at TEXT,
  provider_id TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

async function main() {
  const outFile = path.join('scripts', 'migrate-outreach-tracking.sql');
  fs.writeFileSync(outFile, MIGRATION_SQL.trim() + '\n', 'utf8');
  console.log(`Written ${outFile}`);

  // Also create a .js version for programmatic execution
  const jsVersion = `
import { execSync } from 'child_process';

const sql = \`${MIGRATION_SQL.trim()}\`;

async function runMigration() {
  try {
    // Write temp SQL file
    const tempFile = '/tmp/migrate-outreach-tracking.sql';
    require('fs').writeFileSync(tempFile, sql);

    // Execute via wrangler
    execSync(\`npx wrangler d1 execute gahq --file=\${tempFile} --remote\`, { stdio: 'inherit' });
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
  `.trim();

  fs.writeFileSync(path.join('scripts', 'migrate-outreach-tracking.js'), jsVersion, 'utf8');
  console.log(`Written scripts/migrate-outreach-tracking.js`);
}

main();