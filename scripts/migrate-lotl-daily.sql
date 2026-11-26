-- NO-OP / HISTORICAL MIGRATION
--
-- subscribers.lotl_daily, settings(lotl_daily_enabled) and
-- lotl_daily_sends are already created by functions/api/db/setup.js.
-- The old unconditional ALTER TABLE failed on re-runs; use the guarded
-- setup script instead: npm run db:setup.

SELECT 'migrate-lotl-daily.sql is a no-op; run npm run db:setup' AS note;
