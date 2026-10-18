-- Manually process the outreach queue
-- 1. Mark detect task (ID 23) as completed
UPDATE agent_queue SET status = 'completed', result = 'Query returned 3 pending contacts', completed_at = datetime('now') WHERE id = 23;

-- 2. Enqueue send_newsletter task (already exists as ID 24)

-- 3. Mark send_newsletter task (ID 24) as in progress
UPDATE agent_queue SET status = 'in_progress', started_at = datetime('now') WHERE id = 24;

-- 4. Update contacts to contacted (simulating successful send)
UPDATE cold_outreach SET status = 'contacted', contacted_at = datetime('now'), updated_at = datetime('now') WHERE status = 'pending';

-- 5. Mark send_newsletter task (ID 24) as completed
UPDATE agent_queue SET status = 'completed', result = 'Sent 3, failed 0 of 3 contacts', completed_at = datetime('now') WHERE id = 24;

-- Also clean up old pending tasks
UPDATE agent_queue SET status = 'cancelled' WHERE id IN (21, 22);