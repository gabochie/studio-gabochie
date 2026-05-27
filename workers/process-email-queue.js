export default {
  async scheduled(_event, _env, _ctx) {
    const processResp = await fetch('https://gideonabochie.org/api/email/process');
    const processData = await processResp.json();
    console.log('[Email Cron] process:', JSON.stringify(processData));

    const abandonedResp = await fetch('https://gideonabochie.org/api/email/process-abandoned');
    const abandonedData = await abandonedResp.json();
    console.log('[Email Cron] abandoned:', JSON.stringify(abandonedData));
  },
};
