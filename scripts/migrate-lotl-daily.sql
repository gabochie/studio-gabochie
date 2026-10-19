-- Daily LOTL devotional broadcast (opt-in)
-- Run via: npx wrangler d1 execute gahq --file=scripts/migrate-lotl-daily.sql --remote

-- Opt-in flag on subscribers (0 = no daily devotional emails)
ALTER TABLE subscribers ADD COLUMN lotl_daily INTEGER DEFAULT 0;

-- Master switch, controlled from admin/lotl.html. Off until deliberately enabled.
INSERT OR IGNORE INTO settings (key, value) VALUES ('lotl_daily_enabled', '0');

-- Once-per-day guard so a cron tick can never double-send a broadcast.
CREATE TABLE IF NOT EXISTS lotl_daily_sends (
  send_date TEXT PRIMARY KEY,
  total INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
