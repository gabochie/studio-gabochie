export default {
  async scheduled(event, env, ctx) {
    const resp = await fetch('https://gideonabochie.org/api/email/process');
    const data = await resp.json();
    console.log('[Email Cron]', JSON.stringify(data));
  },
};
