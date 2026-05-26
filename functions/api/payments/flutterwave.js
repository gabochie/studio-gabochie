export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const signature = request.headers.get('verif-hash');
    if (!signature) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Verify signature against FLW_SECRET_HASH
    const expectedHash = env.FLW_SECRET_HASH;
    if (expectedHash && signature !== expectedHash) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const body = await request.json();
    const { event, data } = body;
    if (event !== 'charge.completed' && event !== 'transfer.completed') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Ignored event' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tx_ref = data.tx_ref || '';
    const flw_id = String(data.id || '');
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'GHS';
    const status = data.status || 'pending';
    const customer = data.customer || {};
    const donor_name = customer.name || customer.fullName || data.full_name || '';
    const donor_email = customer.email || data.email || '';
    const donor_phone = customer.phone || data.phone || '';
    const created_at = data.created_at || new Date().toISOString();

    // Verify transaction with Flutterwave API
    let verifiedAmount = amount;
    let verifiedStatus = status;
    let verifiedCurrency = currency;
    if (env.FLW_SECRET_KEY && flw_id) {
      try {
        const verifyResp = await fetch(
          `https://api.flutterwave.com/v3/transactions/${flw_id}/verify`,
          { headers: { 'Authorization': 'Bearer ' + env.FLW_SECRET_KEY } }
        );
        if (verifyResp.ok) {
          const verifyData = await verifyResp.json();
          if (verifyData.status === 'success' && verifyData.data) {
            verifiedAmount = parseFloat(verifyData.data.amount) || verifiedAmount;
            verifiedCurrency = verifyData.data.currency || verifiedCurrency;
            verifiedStatus = verifyData.data.status || verifiedStatus;
          }
        }
      } catch (_e) {}
    }

    await db.prepare(
      `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, flw_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_ref) DO UPDATE SET
         amount = excluded.amount,
         currency = excluded.currency,
         status = excluded.status,
         flw_id = excluded.flw_id,
         donor_phone = excluded.donor_phone`
    ).bind(tx_ref, verifiedAmount, verifiedCurrency, donor_name, donor_email, donor_phone, verifiedStatus, flw_id, created_at).run();

    if (tx_ref.startsWith('booking_')) {
      await db.prepare(
        `UPDATE bookings SET status = ? WHERE payment_tx_ref = ?`
      ).bind('confirmed', tx_ref).run();
    }

    // Send receipt email via Brevo for successful donations
    if (verifiedStatus === 'successful' && donor_email && donor_email !== 'donor@anonymous.invalid' && env.BREVO_API_KEY) {
      try {
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const receiptHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <tr><td style="background:#0A1628;padding:32px;text-align:center">
        <h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>
        <p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Donation Receipt</p>
        </td></tr>
        <tr><td style="padding:32px">
        <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ${donor_name},</p>
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for your generous gift of <strong style="color:#C9A84C">${verifiedCurrency} ${verifiedAmount.toFixed(2)}</strong>. Your support makes every book, video, and teaching possible.</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Receipt No.</td><td style="color:#1E293B;font-size:13px;font-weight:600;font-family:monospace;text-align:right;padding:8px 16px">${tx_ref}</td></tr>
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Date</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${dateStr}</td></tr>
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${verifiedCurrency} ${verifiedAmount.toFixed(2)}</td></tr>
        ${donor_phone ? `<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Phone</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${donor_phone}</td></tr>` : ''}
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Status</td><td style="color:#22C55E;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">Confirmed</td></tr>
        </table>
        <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0 0 6px">This receipt was issued automatically. Keep it for your records.</p>
        <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:0">GideonAbochie Studio &mdash; Accra, Ghana &bull; <a href="mailto:info@gideonabochie.com" style="color:#C9A84C">info@gideonabochie.com</a></p>
        </td></tr></table></td></tr></table></body></html>`;

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
            to: [{ email: donor_email, name: donor_name }],
            subject: 'Your Donation Receipt — GideonAbochie Studio',
            htmlContent: receiptHtml
          })
        });
      } catch (_e) {}
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
