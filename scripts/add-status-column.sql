-- NO-OP / HISTORICAL MIGRATION
-- email_queue.status is part of the canonical CREATE TABLE in
-- functions/api/db/setup.js and is guarded by PRAGMA in scripts/db-setup.js.
-- Never run unconditional ALTER TABLE statements against a live queue.

SELECT 'add-status-column.sql is a no-op; run npm run db:setup' AS note;
