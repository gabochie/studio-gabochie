ALTER TABLE email_queue ADD COLUMN updated_at TEXT;
UPDATE email_queue SET updated_at = datetime('now') WHERE updated_at IS NULL;