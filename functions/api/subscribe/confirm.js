import { queueEmail, welcomeFollowup, daysFromNow } from '../email/_send.js';

export async function onRequest(context) {
  var { request, env } = context;
  var url = new URL(request.url);
  var token = url.searchParams.get('token') || '';

  if (!token) {
    return new Response(htmlResponse('Missing confirmation token.', false), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }

  if (!env.DB) {
    return new Response(htmlResponse('Service unavailable. Please try again later.', false), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }

  try {
    var sub = await env.DB.prepare(
      "SELECT id, name, email, ref_code, edition, confirmed FROM subscribers WHERE confirm_token = ?"
    ).bind(token).first();

    if (!sub) {
      return new Response(htmlResponse('Invalid or expired confirmation link.', false), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    if (sub.confirmed === 1) {
      return new Response(htmlResponse('Your subscription is already confirmed. Welcome!', true), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // Mark as confirmed and clear token
    await env.DB.prepare(
      "UPDATE subscribers SET confirmed = 1, confirm_token = '' WHERE id = ?"
    ).bind(sub.id).run();

    // Add to Brevo and send welcome
    if (env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            email: sub.email,
            attributes: { NOME: sub.name || '', SOURCE: 'newsletter', REF_CODE: sub.ref_code || '', EDITION: sub.edition || '' },
            listIds: [2],
            updateEnabled: true
          })
        });
      } catch (_) {}
    }

    // Send welcome email with referral link
    var refCode = sub.ref_code || '';
    var name = sub.name || '';
    if (env.BREVO_API_KEY) {
      try {
        var welcomeHtml = '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px"><table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px"><tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED"><span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">GideonAbochie Studio</span></td></tr><tr><td style="padding:32px 0 24px"><h1 style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:700;color:#0A1628;margin:0 0 8px">Welcome to <span style="color:#C9A84C">The Studio Weekly</span></h1><p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">' + (name ? 'Hi ' + name + ',' : 'Hello,') + '</p><p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">You are now part of a growing community of creators, thinkers, and changemakers who believe that education — and the world — can be rebuilt better.</p><p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">Every week, you will receive essays on creativity, love, wisdom, and the future of learning — plus curated news from Ghana and the diaspora.</p>' + (refCode ? '<div style="background:#0A1628;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px"><p style="font-family:\'Barlow Condensed\',sans-serif;font-size:14px;color:#C9A84C;margin:0 0 8px;text-transform:uppercase;letter-spacing:.15em">Your Referral Link</p><p style="font-family:\'Courier Prime\',monospace;font-size:15px;color:#fff;margin:0;word-break:break-all">https://news.gideonabochie.org/?ref=' + refCode + '</p></div><p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Share your referral link to earn free ad space. Refer 3 friends → Footer Banner ad. Refer 10 → Leaderboard ad. Refer 50 → Premium Package. Full details in your dashboard.</p>' : '') + '</td></tr><tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED"><p style="font-family:\'Courier Prime\',monospace;font-size:10px;color:#94A3B8;margin:0">GideonAbochie Studio &mdash; Accra, Ghana</p></td></tr></table></body></html>';

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Gideon Abochie', email: 'newsletter@gideonabochie.org' },
            to: [{ email: sub.email, name: name }],
            subject: 'Welcome to The Studio Weekly!',
            htmlContent: welcomeHtml
          })
        });
      } catch (_) {}

      // Queue day 3 follow-up
      try {
        await queueEmail(env, sub.email, name, 'Have You Explored the School?', welcomeFollowup(name), 'welcome_followup', daysFromNow(3));
      } catch (_) {}
    }

    return new Response(htmlResponse('Your subscription is confirmed! Welcome to The Studio Weekly.', true, refCode), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  } catch (err) {
    return new Response(htmlResponse('Something went wrong. Please try again.', false), { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }
}

function htmlResponse(message, success, refCode) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subscription Confirmed — GideonAbochie Studio</title><link rel="icon" type="image/x-icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><rect width=\'32\' height=\'32\' rx=\'6\' fill=\'%23C9A84C\'/><text x=\'16\' y=\'22\' font-size=\'18\' font-weight=\'bold\' text-anchor=\'middle\' fill=\'%230A1628\'>G</text></svg>"><style>body{font-family:Georgia,serif;background:#0A1628;color:#CBD5E1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}.card{background:#0F1E38;border:1px solid #1E3250;border-radius:14px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.icon{font-size:48px;margin-bottom:12px}.icon.success{color:#22C55E}.icon.error{color:#E8637A}h1{font-family:\'Barlow Condensed\',sans-serif;font-size:24px;color:#fff;margin:0 0 8px}p{font-size:15px;color:#8A9BB5;line-height:1.6;margin:0 0 24px}.btn{display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;padding:12px 28px;border-radius:8px}#refBox{background:#0A1628;border-radius:8px;padding:16px;margin-bottom:24px;display:none}#refBox.show{display:block}#refBox label{font-family:\'Barlow Condensed\',sans-serif;font-size:11px;color:#C9A84C;text-transform:uppercase;letter-spacing:.15em;display:block;margin-bottom:6px}#refBox code{font-family:\'Courier Prime\',monospace;font-size:13px;color:#fff;word-break:break-all}</style></head><body><div class="card"><div class="icon ' + (success ? 'success' : 'error') + '">' + (success ? '&#10003;' : '&#10007;') + '</div><h1>' + (success ? 'You\'re Confirmed!' : 'Oops') + '</h1><p>' + message + '</p>' + (success && refCode ? '<div id="refBox" class="show"><label>Your Referral Link</label><code>https://news.gideonabochie.org/?ref=' + refCode + '</code></div>' : '') + '<a href="/" class="btn">Back to Home</a></div></body></html>';
}
