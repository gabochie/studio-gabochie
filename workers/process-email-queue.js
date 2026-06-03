var MC_ENDPOINT = 'https://api.mailchannels.net/tx/v1/send';

async function sendMailChannels(toEmail, toName, subject, htmlContent, dkimKey) {
  var personalization = { to: [{ email: toEmail, name: toName || '' }] };
  if (dkimKey) {
    personalization.dkim = {
      domain: 'gideonabochie.org',
      selector: 'newsletter',
      privateKey: dkimKey
    };
  }
  var payload = {
    personalizations: [personalization],
    from: { email: 'newsletter@gideonabochie.org', name: 'GideonAbochie Studio' },
    subject: subject,
    content: [{ type: 'text/html', value: htmlContent }]
  };
  return await fetch(MC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function getAuthToken(env) {
  return env.AGENT_AUTH_KEY || env.ADMIN_API_KEY || '';
}

async function processQueue(env) {
  var mcSent = 0, mcFailed = 0, brevoSent = 0;
  try {
    var queueResp = await fetch('https://gideonabochie.org/api/email/process?list=1');
    var queueData = await queueResp.json();
    if (queueData && queueData.items) {
      for (var row of queueData.items) {
        try {
          var mcRes = await sendMailChannels(row.to_email, row.to_name, row.subject, row.html_content, env.DKIM_PRIVATE_KEY);
          if (mcRes.ok) {
            await fetch('https://gideonabochie.org/api/email/process?mark_sent=' + row.id);
            mcSent++;
          } else {
            mcFailed++;
          }
        } catch (_e) { mcFailed++; }
      }
    }
  } catch (_e) {}
  try {
    var fallbackResp = await fetch('https://gideonabochie.org/api/email/process');
    var fallbackData = await fallbackResp.json();
    brevoSent = (fallbackData && fallbackData.sent) || 0;
  } catch (_e) {}
  try { await fetch('https://gideonabochie.org/api/email/process-abandoned'); } catch (_e) {}
  var authKey = getAuthToken(env);
  if (authKey) {
    try {
      await fetch('https://gideonabochie.org/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agent-Auth': authKey },
        body: JSON.stringify({ max_items: 10 })
      });
    } catch (_e) {}
  }
  return { mcSent: mcSent, mcFailed: mcFailed, brevoSent: brevoSent };
}

export default {
  async scheduled(_event, _env, _ctx) {
    await processQueue(_env);
  },
  async fetch(request, env, _ctx) {
    var url = new URL(request.url);
    if (url.pathname === '/__test') {
      try {
        var mcRes = await sendMailChannels(env.NOTIFY_EMAIL || 'gid@gideonabochie.com', 'Test', 'MC Worker Test', '<p>From cron Worker via Cloudflare IP</p>', env.DKIM_PRIVATE_KEY);
        var body = '';
        try { body = await mcRes.text(); } catch(_) {}
        return new Response(JSON.stringify({
          status: mcRes.status,
          ok: mcRes.ok,
          body: body.substring(0, 500),
          dkim_key_set: !!env.DKIM_PRIVATE_KEY
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    var result = await processQueue(env);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }
};
