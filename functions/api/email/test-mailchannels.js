import { sendMailChannels } from './_send-mailchannels.js';

export async function onRequest(context) {
  var { env } = context;
  var hasKey = !!env.DKIM_PRIVATE_KEY;
  var keyStart = hasKey ? env.DKIM_PRIVATE_KEY.substring(0, 27) + '...' : '(not set)';
  try {
    var res = await sendMailChannels(env, env.NOTIFY_EMAIL || 'gid@gideonabochie.com', 'Test', 'MailChannels DKIM Test', '<p>If you see this, MailChannels + DKIM is working.</p>');
    return new Response(JSON.stringify({
      dkim_key_set: hasKey,
      dkim_key_preview: keyStart,
      mailchannels_status: res.status,
      mailchannels_ok: res.ok,
      message: hasKey ? 'DKIM key found. MailChannels returned ' + res.status : 'DKIM_PRIVATE_KEY env var is NOT set.'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      dkim_key_set: hasKey,
      dkim_key_preview: keyStart,
      error: err.message,
      message: 'DKIM key check completed. MailChannels call failed.'
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
