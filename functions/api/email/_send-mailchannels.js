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
  var res = await fetch(MC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res;
}
