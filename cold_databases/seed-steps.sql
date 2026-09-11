-- Deduplicate workflow_steps
DELETE FROM workflow_steps WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM workflow_steps GROUP BY workflow_id, step_order
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_steps_unique ON workflow_steps(workflow_id, step_order);

-- Re-seed all abandoned checkout steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'detect', '{"query":"SELECT * FROM donations WHERE status=''pending'' AND created_at < datetime(''now'', ''-24 hours'')"}', 'fulfillment'
FROM workflows w WHERE w.name = 'Abandoned Checkout Recovery' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'dispatch', '{"agent":"outreach","action":"send_reminder"}', 'outreach'
FROM workflows w WHERE w.name = 'Abandoned Checkout Recovery' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 3, 'monitor', '{"wait_hours":24,"escalate_after":1}', 'orchestrator'
FROM workflows w WHERE w.name = 'Abandoned Checkout Recovery' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 3);

-- Re-seed dormant subscriber steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'detect', '{"query":"SELECT * FROM subscribers WHERE confirmed=1 AND subscribed_at < datetime(''now'', ''-30 days'')"}', 'outreach'
FROM workflows w WHERE w.name = 'Dormant Subscriber Reactivation' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'dispatch', '{"agent":"outreach","action":"send_reengagement"}', 'outreach'
FROM workflows w WHERE w.name = 'Dormant Subscriber Reactivation' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

-- Re-seed weekly analytics steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'query', '{"tables":["donations","subscriptions","subscribers","store_orders"]}', 'analytics'
FROM workflows w WHERE w.name = 'Weekly Analytics Report' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'analyze', '{"prompt_key":"weekly_report"}', 'analytics'
FROM workflows w WHERE w.name = 'Weekly Analytics Report' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 3, 'save', '{"to":"tasks","title":"Weekly Analytics Report"}', 'task_processor'
FROM workflows w WHERE w.name = 'Weekly Analytics Report' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 3);

-- Re-seed daily fulfillment steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'query', '{"query":"SELECT * FROM store_orders WHERE status=''pending''"}', 'fulfillment'
FROM workflows w WHERE w.name = 'Daily Fulfillment Check' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'process', '{"auto_complete":true}', 'fulfillment'
FROM workflows w WHERE w.name = 'Daily Fulfillment Check' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

-- Re-seed post-purchase upsell steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'detect', '{"query":"SELECT * FROM store_orders WHERE status=''completed'' AND created_at > datetime(''now'', ''-48 hours'') ORDER BY id"}', 'fulfillment'
FROM workflows w WHERE w.name = 'Post-Purchase Upsell' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'recommend', '{"action":"generate_recommendations","source":"purchase_history"}', 'content'
FROM workflows w WHERE w.name = 'Post-Purchase Upsell' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 3, 'send', '{"agent":"outreach","action":"send_recommendations","delay_minutes":1440}', 'outreach'
FROM workflows w WHERE w.name = 'Post-Purchase Upsell' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 3);

-- Re-seed newsletter campaign steps
INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 1, 'detect', '{"query":"SELECT * FROM cold_outreach WHERE status=''pending'' ORDER BY id LIMIT 50"}', 'outreach'
FROM workflows w WHERE w.name = 'Newsletter Campaign' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 1);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 2, 'dispatch', '{"action":"send_newsletter","batch_size":10}', 'outreach'
FROM workflows w WHERE w.name = 'Newsletter Campaign' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 2);

INSERT OR IGNORE INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type)
SELECT w.id, 3, 'monitor', '{"wait_hours":72,"update_status":"responded"}', 'orchestrator'
FROM workflows w WHERE w.name = 'Newsletter Campaign' AND NOT EXISTS (SELECT 1 FROM workflow_steps ws WHERE ws.workflow_id = w.id AND ws.step_order = 3);
