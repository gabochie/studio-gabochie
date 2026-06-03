import { sendMailChannels } from './_send-mailchannels.js';

export async function onRequest(context) {
  var { env, request } = context;
  var hasKey = !!env.DKIM_PRIVATE_KEY;
  var keyStart = hasKey ? env.DKIM_PRIVATE_KEY.substring(0, 27) + '...' : '(not set)';
  try {
    var res = await sendMailChannels(env, env.NOTIFY_EMAIL || 'gid@gideonabochie.com', 'Test', 'MailChannels DKIM Test', '<p>If you see this, MailChannels + DKIM is working.</p>');
    var body = '';
    try { body = await res.text(); } catch (_) {}
    return new Response(JSON.stringify({
      dkim_key_set: hasKey,
      dkim_key_preview: keyStart,
      mailchannels_status: res.status,
      mailchannels_ok: res.ok,
      mailchannels_body: body.substring(0, 500),
      message: 'DKIM key ' + (hasKey ? 'found' : 'NOT set') + '. MailChannels returned ' + res.status
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      dkim_key_set: hasKey,
      dkim_key_preview: keyStart,
      error: err.message,
      message: 'MailChannels call threw exception: ' + err.message
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
