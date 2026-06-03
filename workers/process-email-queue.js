function getAuthToken(env) {
  return env.AGENT_AUTH_KEY || env.ADMIN_API_KEY || '';
}

export default {
  async scheduled(_event, _env, _ctx) {
    const processResp = await fetch('https://gideonabochie.org/api/email/process');
    const processData = await processResp.json();

    const abandonedResp = await fetch('https://gideonabochie.org/api/email/process-abandoned');
    const abandonedData = await abandonedResp.json();

    const authKey = getAuthToken(_env);
    if (authKey) {
      try {
        const agentResp = await fetch('https://gideonabochie.org/api/agents/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Agent-Auth': authKey },
          body: JSON.stringify({ max_items: 10 })
        });
        const agentData = await agentResp.json();
      } catch (_e) {}
    }
  },
};
