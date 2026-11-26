-- NO-OP / HISTORICAL MIGRATION
-- email_queue.updated_at is part of the canonical CREATE TABLE in
-- functions/api/db/setup.js and is guarded by PRAGMA in scripts/db-setup.js.
-- Never run unconditional ALTER TABLE statements against a live queue.

SELECT 'add-updated-at-column.sql is a no-op; run npm run db:setup' AS note;
