var ensured = false;

export async function ensureAgentTables(db) {
  if (ensured || !db) return;
  ensured = true;
  var stmts = [
    `CREATE TABLE IF NOT EXISTS agent_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'active', max_sub_agents INTEGER DEFAULT 5, max_run_time_seconds INTEGER DEFAULT 60, retry_policy TEXT DEFAULT '{"max_retries":3,"backoff":"exponential"}', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `INSERT OR IGNORE INTO agent_types (name, description, max_sub_agents, max_run_time_seconds) VALUES ('orchestrator', 'Manages sub-agents, delegates tasks, monitors execution', 10, 120), ('content', 'Drafts newsletters, blog posts, SEO meta, social copy', 3, 60), ('outreach', 'Segments audience, sends follow-ups, dormant subscriber reactivation', 3, 60), ('analytics', 'Generates reports, forecasts revenue, detects anomalies', 2, 120), ('fulfillment', 'Monitors payments, triggers sequences, processes orders', 5, 30), ('task_processor', 'Reads the agent queue, executes or escalates tasks', 3, 30)`,
    `CREATE TABLE IF NOT EXISTS agent_instances (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_type_id INTEGER NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'idle', config TEXT DEFAULT '{}', last_run_at TEXT DEFAULT '', total_runs INTEGER DEFAULT 0, total_errors INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (agent_type_id) REFERENCES agent_types(id))`,
    `CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status)`,
    `CREATE TABLE IF NOT EXISTS agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_instance_id INTEGER NOT NULL, workflow_id INTEGER DEFAULT 0, queue_item_id INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', result TEXT DEFAULT '', error TEXT DEFAULT '', duration_ms INTEGER DEFAULT 0, prompt_used TEXT DEFAULT '', response_summary TEXT DEFAULT '', sub_agent_count INTEGER DEFAULT 0, started_at TEXT DEFAULT '', completed_at TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (agent_instance_id) REFERENCES agent_instances(id))`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_instance_id)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at)`,
    `CREATE TABLE IF NOT EXISTS agent_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_type TEXT NOT NULL, workflow_id INTEGER DEFAULT 0, priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', payload TEXT DEFAULT '{}', result TEXT DEFAULT '', error TEXT DEFAULT '', scheduled_at TEXT DEFAULT '', started_at TEXT DEFAULT '', completed_at TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS idx_agent_queue_status ON agent_queue(status)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_queue_priority ON agent_queue(priority, created_at)`,
    `CREATE TABLE IF NOT EXISTS workflows (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'inactive', trigger_type TEXT NOT NULL DEFAULT 'manual', trigger_config TEXT DEFAULT '{}', revenue_tracked REAL DEFAULT 0, total_runs INTEGER DEFAULT 0, last_run_at TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS workflow_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id INTEGER NOT NULL, step_order INTEGER NOT NULL, step_type TEXT NOT NULL, config TEXT DEFAULT '{}', agent_type TEXT DEFAULT '', timeout_seconds INTEGER DEFAULT 60, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (workflow_id) REFERENCES workflows(id))`,
    `CREATE TABLE IF NOT EXISTS agent_tools (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_type_id INTEGER NOT NULL, tool_name TEXT NOT NULL, tool_description TEXT DEFAULT '', tool_schema TEXT DEFAULT '{}', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (agent_type_id) REFERENCES agent_types(id), UNIQUE(agent_type_id, tool_name))`,
    `CREATE TABLE IF NOT EXISTS agent_prompts (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_type TEXT NOT NULL, prompt_key TEXT NOT NULL, system_prompt TEXT NOT NULL DEFAULT '', user_template TEXT NOT NULL DEFAULT '', model TEXT DEFAULT 'gpt-4o-mini', temperature REAL DEFAULT 0.7, max_tokens INTEGER DEFAULT 1024, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(agent_type, prompt_key))`,
  ];
  for (var s of stmts) {
    try { await db.prepare(s).run(); } catch (e) {
      // Ignore errors from indexes that already exist or minor conflicts
    }
  }
}

export async function ensureAdminTables(db) {
  if (!db) return;
  var stmts = [
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT '', entity_id TEXT DEFAULT '', admin_key TEXT DEFAULT '', ip TEXT DEFAULT '', details TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`,
    `CREATE TABLE IF NOT EXISTS contact_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', subject TEXT DEFAULT '', message TEXT DEFAULT '', source TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  ];
  for (var s of stmts) {
    try { await db.prepare(s).run(); } catch (e) {}
  }
}
