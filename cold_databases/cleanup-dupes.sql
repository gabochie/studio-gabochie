-- Remove duplicate workflow_steps (keep only those belonging to the latest workflow per name)
DELETE FROM workflow_steps WHERE workflow_id NOT IN (
  SELECT MAX(id) FROM workflows GROUP BY name
);

-- Remove duplicate workflows (keep only the latest entry per name)
DELETE FROM workflows WHERE id NOT IN (
  SELECT MAX(id) FROM workflows GROUP BY name
);

-- Add UNIQUE constraint so setup.js can't create duplicates again
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
