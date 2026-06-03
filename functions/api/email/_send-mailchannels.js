var MC_ENDPOINT = 'https://api.mailchannels.net/tx/v1/send';

export async function sendMailChannels(env, toEmail, toName, subject, htmlContent) {
  var payload = {
    personalizations: [
      {
        to: [{ email: toEmail, name: toName || '' }]
      }
    ],
    from: { email: 'newsletter@gideonabochie.org', name: 'GideonAbochie Studio' },
    subject: subject,
    content: [{ type: 'text/html', value: htmlContent }]
  };
  var dkimKey = env.DKIM_PRIVATE_KEY;
  if (dkimKey) {
    payload.personalizations[0].dkim = {
      domain: env.DKIM_DOMAIN || 'gideonabochie.org',
      selector: env.DKIM_SELECTOR || 'newsletter',
      privateKey: dkimKey
    };
  }
  var res = await fetch(MC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res;
}
