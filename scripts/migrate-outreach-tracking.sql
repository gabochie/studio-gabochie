-- NO-OP / HISTORICAL MIGRATION
--
-- These objects are now defined by functions/api/db/setup.js (the single
-- source of truth): email_queue with opened_at/clicked_at/provider_id/
-- retry_count/last_error/status/updated_at, suppression_list, tracking_events
-- and whatsapp_queue (to_phone/message_text/status/scheduled_at/attempts/
-- last_error). The old version of this file DROPped and recreated
-- email_queue with weaker constraints and created an incompatible
-- whatsapp_queue schema, so it must never be run against a live database.
--
-- To apply schema updates safely: npm run db:setup (scripts/db-setup.js),
-- which imports getStatements() from setup.js and guards column migrations
-- with PRAGMA table_info.

SELECT 'migrate-outreach-tracking.sql is a no-op; run npm run db:setup' AS note;
