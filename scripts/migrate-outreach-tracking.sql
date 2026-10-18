-- Outreach tracking & delivery tables
-- Run via: npx wrangler d1 execute gahq --file=scripts/migrate-outreach-tracking.sql --remote

-- Add tracking columns to email_queue (idempotent - ignore errors if column exists)
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we use a workaround
-- Create temp table with new schema, copy data, drop old, rename

-- Check and add opened_at
CREATE TABLE IF NOT EXISTS email_queue_new AS
SELECT *,
       NULL as opened_at,
       NULL as clicked_at,
       NULL as provider_id,
       0 as retry_count,
       NULL as last_error
FROM email_queue;

DROP TABLE email_queue;

ALTER TABLE email_queue_new RENAME TO email_queue;

CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_sent ON email_queue(sent_at);

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