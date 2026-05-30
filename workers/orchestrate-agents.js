export default {
  async scheduled(_event, env, _ctx) {
    var DB = env.DB;
    if (!DB) return;
    var authKey = env.AGENT_AUTH_KEY || '';
    if (!authKey) return;

    try {
      var pendingItems = await DB.prepare(
        "SELECT COUNT(*) as c FROM agent_queue WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))"
      ).first();

      if (pendingItems && pendingItems.c > 0) {
        await fetch('https://gideonabochie.org/api/agents/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Auth': authKey },
          body: JSON.stringify({ max_items: Math.min(pendingItems.c, 20) })
        });
      }

      var workflowsToRun = await DB.prepare(
        "SELECT * FROM workflows WHERE status = 'active' AND trigger_type = 'cron'"
      ).all();

      if (workflowsToRun && workflowsToRun.results) {
        for (var wf of workflowsToRun.results) {
          var triggerConfig = typeof wf.trigger_config === 'string' ? JSON.parse(wf.trigger_config) : (wf.trigger_config || {});
          if (triggerConfig.auto_run !== false) {
            await DB.prepare(
              "INSERT INTO agent_queue (agent_type, workflow_id, priority, payload) VALUES ('orchestrator', ?, 1, ?)"
            ).bind(wf.id, JSON.stringify({ action: 'run_workflow', workflow_id: wf.id })).run();
          }
        }
      }
    } catch (_err) {}
  }
};
