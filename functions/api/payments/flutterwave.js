import { queueEmail, donationImpactFollowup, daysFromNow, bookUpsell } from '../email/_send.js';
import { generateInvoice } from '../invoices/generate.js';

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
    const expectedHash = env.FLW_SECRET_HASH;
    if (expectedHash && signature !== expectedHash) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const body = await request.json();
    const { event, data } = body;
    const tx_ref = data.tx_ref || '';
    const flw_id = String(data.id || '');
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'GHS';
    const rawStatus = data.status || 'pending';
    const customer = data.customer || {};
    const donor_name = customer.name || customer.fullName || data.full_name || '';
    const donor_email = customer.email || data.email || '';
    const donor_phone = customer.phone || data.phone || '';
    const created_at = data.created_at || new Date().toISOString();

    // Map Flutterwave event types to canonical statuses
    const eventStatusMap = {
      'charge.completed': 'successful',
      'charge.failed': 'failed',
      'charge.chargeback': 'chargeback',
      'charge.chargeback.reversed': 'chargeback_reversed',
      'refund.completed': 'refunded',
      'refund.failed': 'refund_failed',
      'transfer.completed': 'successful',
      'transfer.failed': 'transfer_failed'
    };
    let canonicalStatus = eventStatusMap[event] || rawStatus;

    // Verify transaction with Flutterwave API (only for completed charges)
    let verifiedAmount = amount;
    let verifiedStatus = canonicalStatus;
    let verifiedCurrency = currency;
    if ((event === 'charge.completed' || event === 'charge.failed') && env.FLW_SECRET_KEY && flw_id) {
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

    // Attribute donation to campaign if tx_ref starts with camp_
    if (tx_ref.startsWith('camp_') && event === 'charge.completed') {
      var campSlug = tx_ref.split('_')[1] || '';
      if (campSlug) {
        try {
          var campRow = await db.prepare("SELECT id FROM campaigns WHERE slug = ?").bind(campSlug).first();
          if (campRow) {
            await db.prepare("UPDATE donations SET campaign_id = ?, metadata = json_set(COALESCE(NULLIF(metadata,''), '{}'), '$.campaign_slug', ?) WHERE tx_ref = ?").bind(campRow.id, campSlug, tx_ref).run();
          }
        } catch (_ce) {}
      }
    }

    // Update booking status on successful charge
    if (event === 'charge.completed' && tx_ref.startsWith('booking_')) {
      await db.prepare(
        `UPDATE bookings SET status = ? WHERE payment_tx_ref = ?`
      ).bind('confirmed', tx_ref).run();
      try { await generateInvoice(env, 'booking', 'bookings', { name: donor_name, email: donor_email, company: '', phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: 'Ad Booking', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
    }

    // Mark book purchase as completed
    if (event === 'charge.completed' && tx_ref.startsWith('books_')) {
      const bName = donor_name || customer.name || data.full_name || '';
      const bEmail = donor_email || customer.email || data.email || '';
      await db.prepare(
        `UPDATE book_purchases SET status = 'completed', name = COALESCE(NULLIF(name, ''), ?), email = COALESCE(NULLIF(email, ''), ?) WHERE tx_ref = ?`
      ).bind(bName, bEmail, tx_ref).run();
      // Send download link email
      if (bEmail && env.BREVO_API_KEY && bEmail !== 'donor@anonymous.invalid') {
        try {
          const downloadHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
          <tr><td style="background:#0A1628;padding:32px;text-align:center">
          <h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>
          <p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Your Books Are Ready</p>
          </td></tr>
          <tr><td style="padding:32px">
          <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ${bName},</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for your purchase! Your premium books bundle is ready to download.</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">
          <tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Transaction</td><td style="color:#1E293B;font-size:13px;font-weight:600;font-family:monospace;text-align:right;padding:8px 16px">${tx_ref}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">GHS ${verifiedAmount.toFixed(2)}</td></tr>
          </table>
          <a href="https://gideonabochie.org/books/download?tx_ref=${tx_ref}" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Download Your Books</a>
          <p style="color:#64748B;font-size:12px;line-height:1.6;margin:24px 0 0">This download link is unique to your purchase. Do not share it.</p>
          </td></tr></table></td></tr></table></body></html>`;
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
              to: [{ email: bEmail, name: bName }],
              subject: 'Your Books Are Ready — GideonAbochie Studio',
              htmlContent: downloadHtml
            })
          });
        } catch (_e) {}

        // Queue day-3 book upsell
        try {
          await queueEmail(env, bEmail, bName, 'Go Deeper with the Premium Bundle — GideonAbochie Studio', bookUpsell(bName), 'book_upsell', daysFromNow(3));
        } catch (_e) {}
      }
      try { await generateInvoice(env, 'books', 'book_purchases', { name: bName, email: bEmail, phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: 'Book Purchase', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
    }

    // Handle enrollment upgrade payments (tx_ref prefix: upgrade_)
    if (event === 'charge.completed' && tx_ref.startsWith('upgrade_')) {
      var upgradeResult = await db.prepare(
        `UPDATE enrollments SET status = 'active', payment_amount = ? WHERE payment_ref = ? AND status = 'sample'`
      ).bind(verifiedAmount, tx_ref).run();
      if (upgradeResult && upgradeResult.changes > 0 && donor_email && donor_email !== 'donor@anonymous.invalid' && env.BREVO_API_KEY) {
        try {
          var upgEnrollment = await db.prepare(
            'SELECT e.access_token, e.student_name, p.title FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.payment_ref = ?'
          ).bind(tx_ref).first();
          if (upgEnrollment) {
            var upgHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
              '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
              '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
              '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
              '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>' +
              '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Full Access Activated</p></td></tr>' +
              '<tr><td style="padding:32px">' +
              '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + upgEnrollment.student_name + ',</p>' +
              '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Your full access to <strong style="color:#C9A84C">' + upgEnrollment.title + '</strong> is now active. Start learning at your own pace.</p>' +
              '<a href="https://gideonabochie.org/dashboard/?token=' + upgEnrollment.access_token + '" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Go to Dashboard</a>' +
              '<p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:24px 0 0">GideonAbochie Studio &mdash; Accra, Ghana</p>' +
              '</td></tr></table></td></tr></table></body></html>';
            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
              body: JSON.stringify({
                sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
                to: [{ email: donor_email, name: upgEnrollment.student_name }],
                subject: 'Full Access Activated — ' + upgEnrollment.title,
                htmlContent: upgHtml
              })
            });
          }
        } catch (_e) {}
      }
    }

    // Handle membership subscription payments (tx_ref prefix: memb_)
    if (event === 'charge.completed' && tx_ref.startsWith('memb_')) {
      var membSub = await db.prepare('SELECT email, tier, amount FROM subscriptions WHERE tx_ref = ?').bind(tx_ref).first();
      if (membSub) {
        var membUser = await db.prepare('SELECT id, name FROM users WHERE email = ?').bind(membSub.email).first();
        if (membUser) {
          var membTier = membSub.tier === 'vip' ? 'vip' : 'premium';
          await db.prepare(
            "UPDATE users SET membership_tier = ?, membership_expires_at = datetime('now', '+1 month') WHERE id = ?"
          ).bind(membTier, membUser.id).run();
          await db.prepare(
            "UPDATE subscriptions SET status = 'active', amount = ? WHERE tx_ref = ?"
          ).bind(verifiedAmount, tx_ref).run();
          if (env.BREVO_API_KEY && donor_email) {
            try {
              var membHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
                '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
                '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
                '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
                '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>' +
                '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">' + (membTier === 'vip' ? 'VIP' : 'Premium') + ' Membership Active</p></td></tr>' +
                '<tr><td style="padding:32px">' +
                '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + (membUser.name || donor_name) + ',</p>' +
                '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Your <strong style="color:#C9A84C">' + (membTier === 'vip' ? 'VIP' : 'Premium') + '</strong> membership is now active. Enjoy full access to all courses, resources, and features.</p>' +
                '<a href="https://gideonabochie.org/member/" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Go to Membership</a>' +
                '<p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:24px 0 0">GideonAbochie Studio &mdash; Accra, Ghana</p>' +
                '</td></tr></table></td></tr></table></body></html>';
              await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
                body: JSON.stringify({
                  sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
                  to: [{ email: donor_email, name: membUser.name || donor_name }],
                  subject: 'Welcome to ' + (membTier === 'vip' ? 'VIP' : 'Premium') + ' Membership',
                  htmlContent: membHtml
                })
              });
            } catch (_e) {}
          }
        }
      }
    }

    // Handle subscription payments (tx_ref prefix: sub_)
    if (event === 'charge.completed' && tx_ref.startsWith('sub_')) {
      const tierMap = { monthly: 'Monthly Supporter', annual: 'Annual Patron', founding: 'Founding Partner' };
      const tier = data.plan ? (data.plan.name || '').toLowerCase().replace(/[^a-z]/g, '') : 'monthly';
      const subAmount = parseFloat(data.plan ? data.plan.amount : verifiedAmount) || 50;
      const subCurrency = data.plan ? (data.plan.currency || 'GHS') : verifiedCurrency;
      const flwSubscriptionId = String(data.id || data.subscription_id || '');
      const flwPlanId = String(data.plan ? data.plan.id : '');
      const nextBilling = data.next_payment_date || data.next_charge_date || '';
      await db.prepare(
        `UPDATE subscriptions SET status = 'active', amount = ?, currency = ?, flw_subscription_id = ?, flw_plan_id = ?, next_billing = ? WHERE tx_ref = ?`
      ).bind(subAmount, subCurrency, flwSubscriptionId, flwPlanId, nextBilling, tx_ref).run();
      const tierName = tierMap[tier] || 'Supporter';
      if (donor_email && donor_email !== 'donor@anonymous.invalid' && env.BREVO_API_KEY) {
        try {
          const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          const welcomeHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
          <tr><td style="background:#0A1628;padding:32px;text-align:center">
          <h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>
          <p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Welcome, ${tierName}!</p>
          </td></tr>
          <tr><td style="padding:32px">
          <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ${donor_name},</p>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for becoming a <strong style="color:#C9A84C">${tierName}</strong>. Your recurring support makes every book, video, and teaching possible.</p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">
          <tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Plan</td><td style="color:#1E293B;font-size:13px;font-weight:600;text-align:right;padding:8px 16px">${tierName}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${subCurrency} ${subAmount.toFixed(2)}</td></tr>
          <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Transaction</td><td style="color:#1E293B;font-size:12px;font-family:monospace;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${tx_ref}</td></tr>
          </table>
          <p style="color:#64748B;font-size:13px;line-height:1.6;margin:0 0 20px">What happens next?</p>
          <ul style="color:#475569;font-size:13px;line-height:1.7;padding-left:20px;margin:0 0 24px">
          <li>You will receive your supporter benefits within 24 hours</li>
          <li>Your recurring payment will be processed automatically each period</li>
          <li>You can cancel or change your plan anytime by replying to this email</li>
          </ul>
          <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:0">GideonAbochie Studio &mdash; Accra, Ghana &bull; <a href="mailto:info@gideonabochie.com" style="color:#C9A84C">info@gideonabochie.com</a></p>
          </td></tr></table></td></tr></table></body></html>`;
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
              to: [{ email: donor_email, name: donor_name }],
              subject: 'Welcome to the ' + tierName + ' Tier — GideonAbochie Studio',
              htmlContent: welcomeHtml
            })
          });
        } catch (_e) {}
      }
      try { await generateInvoice(env, 'subscription', 'subscriptions', { name: donor_name, email: donor_email, phone: donor_phone, amount: subAmount, currency: subCurrency, tx_ref: tx_ref, items: [{ description: tierName + ' Subscription', quantity: 1, unit_price: subAmount, total: subAmount }] }); } catch (_) {}
    }

    // Handle unified tier payments (tx_ref prefix: tier_)
    if (event === 'charge.completed' && tx_ref.startsWith('tier_')) {
      var tierSub = await db.prepare('SELECT email, tier, amount, name FROM subscriptions WHERE tx_ref = ?').bind(tx_ref).first();
      if (tierSub) {
        var tierSlug = tierSub.tier;
        var tierUser = await db.prepare('SELECT id, name FROM users WHERE email = ?').bind(tierSub.email).first();
        var membershipMap = { supporter: 'supporter', scholar: 'premium', patron: 'vip', founding: 'founding' };
        var newTier = membershipMap[tierSlug] || 'free';
        var tierNames = { supporter: 'Supporter', scholar: 'Scholar', patron: 'Patron', founding: 'Founding Partner' };
        var displayName = tierNames[tierSlug] || 'Supporter';
        var expiresAt = tierSlug === 'founding' || tierSlug === 'supporter' ? "datetime('now', '+1 year')" : "datetime('now', '+1 month')";
        if (tierUser && newTier !== 'free' && newTier !== 'supporter') {
          await db.prepare("UPDATE users SET membership_tier = ?, membership_expires_at = " + expiresAt + " WHERE id = ?").bind(newTier, tierUser.id).run();
        }
        await db.prepare("UPDATE subscriptions SET status = 'active', amount = ? WHERE tx_ref = ?").bind(verifiedAmount, tx_ref).run();
        if (env.BREVO_API_KEY && donor_email && donor_email !== 'donor@anonymous.invalid') {
          try {
            var tierHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
              '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
              '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
              '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
              '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>' +
              '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">' + displayName + ' Tier Active</p></td></tr>' +
              '<tr><td style="padding:32px">' +
              '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + (tierUser ? tierUser.name : (tierSub.name || donor_name)) + ',</p>' +
              '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Your <strong style="color:#C9A84C">' + displayName + '</strong> tier is now active. Thank you for supporting the mission.</p>' +
              '<a href="https://gideonabochie.org/member/" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Go to Membership</a>' +
              '<p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:24px 0 0">GideonAbochie Studio &mdash; Accra, Ghana</p>' +
              '</td></tr></table></td></tr></table></body></html>';
            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
              body: JSON.stringify({
                sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
                to: [{ email: donor_email, name: tierUser ? tierUser.name : (tierSub.name || donor_name) }],
                subject: 'Welcome to the ' + displayName + ' Tier — GideonAbochie Studio',
                htmlContent: tierHtml
              })
            });
          } catch (_e) {}
        }
        try { await generateInvoice(env, 'tier', 'subscriptions', { name: donor_name, email: donor_email, phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: displayName + ' Tier', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
      }
    }

    // Handle recurring subscription payment notifications
    if (tx_ref.startsWith('sub_') && data.subscription_id && event !== 'charge.completed') {
      const subStatus = verifiedStatus === 'successful' ? 'active' : (verifiedStatus === 'failed' ? 'past_due' : verifiedStatus);
      const nextBilling = data.next_payment_date || data.next_charge_date || '';
      await db.prepare(
        `UPDATE subscriptions SET status = ?, next_billing = ? WHERE flw_subscription_id = ?`
      ).bind(subStatus, nextBilling, String(data.subscription_id)).run();
    }

    // Handle store purchases (art, merch, music)
    if (event === 'charge.completed' && tx_ref.startsWith('store_')) {
      var storeItemType = '';
      var storeItemName = '';
      try {
        var parts = tx_ref.split('_');
        storeItemType = parts.length > 1 ? parts[1] : '';
      } catch (_e) {}
      var orderRec = null;
      try {
        orderRec = await db.prepare('SELECT * FROM store_orders WHERE tx_ref = ?').bind(tx_ref).first();
      } catch (_e) {}
      if (orderRec) {
        await db.prepare(
          `UPDATE store_orders SET status = 'completed', customer_name = COALESCE(NULLIF(customer_name, ''), ?), customer_email = COALESCE(NULLIF(customer_email, ''), ?) WHERE tx_ref = ?`
        ).bind(donor_name, donor_email, tx_ref).run();
      } else {
        await db.prepare(
          `INSERT INTO store_orders (tx_ref, item_type, item_name, amount, currency, customer_name, customer_email, status, flw_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`
        ).bind(tx_ref, storeItemType, storeItemName, verifiedAmount, verifiedCurrency, donor_name, donor_email, flw_id).run();
      }
      if (donor_email && donor_email !== 'donor@anonymous.invalid' && env.BREVO_API_KEY) {
        try {
          var sName = orderRec ? orderRec.item_name : storeItemName;
          var sType = orderRec ? orderRec.item_type : storeItemType;
          var sVariant = orderRec ? orderRec.item_variant : '';
          var displayName = sName || 'Item';
          if (sVariant) { displayName = displayName + ' (' + sVariant + ')'; }
          var deliverySection = '<a href="https://gideonabochie.org/store/download?tx_ref=' + tx_ref + '" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;margin-bottom:16px">Download Your Purchase</a>' +
            '<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0">Your download link is unique to this purchase. Do not share it.</p>';
          var receiptHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
            '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
            '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
            '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
            '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">GideonAbochie Studio</h1>' +
            '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Thank You for Your Purchase</p></td></tr>' +
            '<tr><td style="padding:32px">' +
            '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + donor_name + ',</p>' +
            '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for purchasing <strong style="color:#C9A84C">' + displayName + '</strong>. Your payment of <strong style="color:#C9A84C">' + verifiedCurrency + ' ' + verifiedAmount.toFixed(2) + '</strong> has been confirmed.</p>' +
            '<table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">' +
            '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Item</td><td style="color:#1E293B;font-size:13px;font-weight:600;text-align:right;padding:8px 16px">' + displayName + '</td></tr>' +
            '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Transaction</td><td style="color:#1E293B;font-size:13px;font-family:monospace;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">' + tx_ref + '</td></tr>' +
            '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">' + verifiedCurrency + ' ' + verifiedAmount.toFixed(2) + '</td></tr>' +
            '</table>' +
            deliverySection +
            '</td></tr></table></td></tr></table></body></html>';
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'GideonAbochie Studio', email: 'newsletter@gideonabochie.org' },
              to: [{ email: donor_email, name: donor_name }],
              subject: 'Purchase Confirmed — GideonAbochie Studio',
              htmlContent: receiptHtml
            })
          });
        } catch (_e) {}
      }
      try { await generateInvoice(env, 'store', 'store_orders', { name: donor_name, email: donor_email, phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: displayName || 'Store Purchase', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
    }

    // Send receipt email via Brevo for successful donations
    if (!tx_ref.startsWith('store_') && (event === 'charge.completed' || event === 'transfer.completed') && verifiedStatus === 'successful' && donor_email && donor_email !== 'donor@anonymous.invalid' && env.BREVO_API_KEY) {
      var invNum = '';
      if (!tx_ref.startsWith('booking_') && !tx_ref.startsWith('books_') && !tx_ref.startsWith('sub_') && !tx_ref.startsWith('upgrade_')) {
        try { invNum = await generateInvoice(env, 'donation', 'donations', { name: donor_name, email: donor_email, phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: 'Donation', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
      }
      try {
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const invLink = invNum ? '<p style="margin:12px 0 0"><a href="https://gideonabochie.org/api/invoices/' + invNum + '?token=' + invNum + '" style="color:#C9A84C;text-decoration:underline;font-size:13px">View Invoice &rsaquo;</a></p>' : '';
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
        ${invLink}
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
        try {
          await queueEmail(env, donor_email, donor_name, 'Your Impact in Action', donationImpactFollowup(donor_name), 'donation_impact', daysFromNow(3));
        } catch (_e2) {}
      } catch (_e) {}
    }

    // Generate invoice for enrollment upgrades
    if (event === 'charge.completed' && tx_ref.startsWith('upgrade_')) {
      try { await generateInvoice(env, 'enrollment', 'enrollments', { name: donor_name, email: donor_email, phone: donor_phone, amount: verifiedAmount, currency: verifiedCurrency, tx_ref: tx_ref, items: [{ description: 'Program Enrollment Upgrade', quantity: 1, unit_price: verifiedAmount, total: verifiedAmount }] }); } catch (_) {}
    }

    return new Response(JSON.stringify({ status: 'ok', event, canonicalStatus }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
