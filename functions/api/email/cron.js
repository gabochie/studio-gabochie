import { sendBrevoEmail, queueEmail, abandonedDonationReminder, abandonedCheckoutReminder, tierRenewalReminder, sampleUpgrade7d, daysFromNow } from './_send.js';
import { processEmailQueue } from './_process-queue.js';
import { enqueueLotlDaily, lotlDailyEnabled, todayKey } from './_lotl-daily.js';
import { personalize } from '../../admin/api/newsletter/send.js';
import { enqueueBroadcast } from '../../admin/api/newsletter/_enqueue.js';
import { saturdaySendDue } from '../../admin/api/newsletter/schedule.js';
import { sendWhatsApp } from '../_whatsapp.js';

function dbStamp(value) {
  return String(value || '').replace('T', ' ').replace('Z', '').slice(0, 19);
}

export async function onRequest(context) {
  var { request, env } = context;
  var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Secret' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Header only: ?secret= leaks the cron secret into logs and cache keys.
  var cronSecret = request.headers.get('X-Cron-Secret') || '';
  if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    var result = { abandoned: { checked: 0, queued: 0 }, upgrade: { checked: 0, queued: 0 }, checkout: { checked: 0, queued: 0 }, renewal: { checked: 0, queued: 0 }, process: { sent: 0, pending: 0 }, posts: { published: 0, due: 0 }, social_queue: { due: 0, checked: 0 }, errors: [] };

    // Step 1: Abandoned donation recovery
    try {
      var { results: abandonedResults } = await env.DB.prepare(
        `SELECT DISTINCT e.email, e.event_data
         FROM events e
         WHERE e.event_type = 'donation_started'
           AND e.email != ''
           AND e.created_at <= datetime('now', '-24 hours')
           AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_email = e.email AND d.status = 'completed')
           AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = e.email AND q.email_type = 'abandoned_donation' AND q.created_at >= datetime('now', '-30 days') AND q.status != 'failed')
         ORDER BY e.created_at ASC LIMIT 50`
      ).all();

      result.abandoned.checked = abandonedResults.length;
      for (var row of abandonedResults) {
        var name = '';
        try { var d = JSON.parse(row.event_data); name = d.name || ''; } catch (_) {}
        await queueEmail(env, row.email, name, 'You Were About to Make a Difference — Studio Gabochie', abandonedDonationReminder(name), 'abandoned_donation', daysFromNow(0));
        result.abandoned.queued++;
      }
    } catch (err) {
      result.errors.push('abandoned: ' + err.message);
    }

    // Step 1b: Sample -> paid upgrade nudge (7 days after free Module 1, still on sample)
    try {
      var { results: sampleResults } = await env.DB.prepare(
        `SELECT e.student_name, e.student_email, e.access_token, p.title AS program_title, p.price_label AS price_label
         FROM enrollments e JOIN programs p ON e.program_id = p.id
         WHERE e.status = 'sample'
           AND e.student_email != ''
           AND e.enrolled_at <= datetime('now', '-7 days')
           AND NOT EXISTS (SELECT 1 FROM enrollments a WHERE a.student_email = e.student_email AND a.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = e.student_email AND q.email_type = 'sample_upgrade_7d' AND q.created_at >= datetime('now', '-30 days') AND q.status != 'failed')
         ORDER BY e.enrolled_at ASC LIMIT 50`
      ).all();

      result.upgrade.checked = sampleResults.length;
      for (var s of sampleResults) {
        var dashUrl = 'https://studio.gabochie.com/dashboard/?token=' + s.access_token;
        await queueEmail(env, s.student_email, s.student_name, 'Your free module was just the start — Studio Gabochie', sampleUpgrade7d(s.student_name, s.program_title, s.price_label, dashUrl), 'sample_upgrade_7d', daysFromNow(0));
        result.upgrade.queued++;
      }
    } catch (err) {
      result.errors.push('upgrade: ' + err.message);
    }

    // Step 1c: Abandoned checkout recovery (closed/failed checkout, nothing completed since)
    try {
      var { results: checkoutResults } = await env.DB.prepare(
        `SELECT DISTINCT e.email, e.page
         FROM events e
         WHERE e.event_type IN ('checkout_closed', 'checkout_failed', 'subscription_cancelled')
           AND e.email != ''
           AND e.created_at <= datetime('now', '-24 hours')
           AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_email = e.email AND d.status IN ('completed', 'successful'))
           AND NOT EXISTS (SELECT 1 FROM enrollments en WHERE en.student_email = e.email AND en.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.email = e.email AND s.status = 'active')
           AND NOT EXISTS (SELECT 1 FROM store_orders o WHERE o.customer_email = e.email AND o.status = 'completed')
           AND NOT EXISTS (SELECT 1 FROM book_purchases b WHERE b.email = e.email AND b.status = 'completed')
           AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = e.email AND q.email_type = 'abandoned_checkout' AND q.created_at >= datetime('now', '-30 days') AND q.status != 'failed')
         ORDER BY e.created_at ASC LIMIT 50`
      ).all();

      result.checkout.checked = checkoutResults.length;
      for (var c of checkoutResults) {
        var page = '';
        try { page = (c.page || '').replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, ''); } catch (_) {}
        await queueEmail(env, c.email, '', 'Still interested? No charge was made — Studio Gabochie', abandonedCheckoutReminder('', page), 'abandoned_checkout', daysFromNow(0));
        result.checkout.queued++;
      }
    } catch (err) {
      result.errors.push('checkout: ' + err.message);
    }

    // Step 1d: Tier renewal reminders (one-time periods, no auto-charge)
    try {
      var { results: renewalResults } = await env.DB.prepare(
        `SELECT u.name, u.email, u.membership_tier, u.membership_expires_at
         FROM users u
         WHERE u.membership_expires_at IS NOT NULL
           AND u.membership_expires_at != ''
           AND u.membership_expires_at <= datetime('now', '+7 days')
           AND u.email != ''
           AND NOT EXISTS (SELECT 1 FROM email_queue q WHERE q.to_email = u.email AND q.email_type = 'tier_renewal' AND q.created_at >= datetime('now', '-30 days') AND q.status != 'failed' AND q.created_at >= u.membership_expires_at)
         ORDER BY u.membership_expires_at ASC LIMIT 50`
      ).all();

      result.renewal.checked = renewalResults.length;
      var tierLabels = { supporter: 'Supporter', premium: 'Scholar', vip: 'Patron', founding: 'Founding Partner', scholar: 'Scholar', patron: 'Patron' };
      for (var rn of renewalResults) {
        var rName = rn.membership_tier ? (tierLabels[rn.membership_tier] || rn.membership_tier) : 'Membership';
        var rDate = String(rn.membership_expires_at || '').slice(0, 10);
        await queueEmail(env, rn.email, rn.name || '', 'Your ' + rName + ' renews soon — Studio Gabochie', tierRenewalReminder(rn.name || '', rName, rDate), 'tier_renewal', daysFromNow(0));
        result.renewal.queued++;
      }
    } catch (err) {
      result.errors.push('renewal: ' + err.message);
    }

    // Step 1e: Daily LOTL devotional broadcast (opt-in only, once per day).
    // Enqueued before the drain so the same tick carries it out. Off by default.
    try {
      if (await lotlDailyEnabled(env)) {
        var lotlQueued = await enqueueLotlDaily(env, { date: todayKey() });
        result.lotl_daily = lotlQueued;
        if (!lotlQueued.ok && lotlQueued.error && lotlQueued.error.indexOf('Already sent') !== 0) {
          result.lotl_daily.note = lotlQueued.error;
        }
      }
    } catch (err) {
      result.errors.push('lotl-daily: ' + err.message);
    }

    // Step 2: Process email queue (shared processor — signed unsubscribe,
    // open/click tracking, suppression list, retries, daily Brevo cap).
    try {
      if (!env.BREVO_API_KEY) {
        var pendingRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM email_queue WHERE status = 'pending' AND scheduled_at <= datetime('now')"
        ).first();
        if (pendingRow && pendingRow.c > 0) {
          result.errors.push('brevo: BREVO_API_KEY is missing; ' + pendingRow.c + ' pending email(s) were not sent');
        }
      }
      var proc = await processEmailQueue(env, env.DB);
      result.process.sent = proc.sent;
      result.process.pending = proc.pending;
      if (proc.failed) result.process.failed = proc.failed;
      if (proc.skipped_limited) result.process.skipped_limited = true;
      if (proc.errors && proc.errors.length) result.errors = result.errors.concat(proc.errors);
    } catch (err) {
      result.errors.push('process: ' + err.message);
    }

    // Step 3: Process WhatsApp queue. Claim each row conditionally so two
    // ticks never deliver the same message twice; retry with backoff.
    try {
      var { results: waResults } = await env.DB.prepare(
        "SELECT * FROM whatsapp_queue WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 20"
      ).all();
      var waSent = 0;
      var waPending = waResults.length;
      for (var wa of waResults) {
        var waClaim = await env.DB.prepare(
          "UPDATE whatsapp_queue SET status = 'sending' WHERE id = ? AND status = 'pending'"
        ).bind(wa.id).run();
        if (!waClaim || !waClaim.meta || waClaim.meta.changes === 0) continue;
        waPending--;
        try {
          await sendWhatsApp(env, wa.to_phone, wa.message_text);
          await env.DB.prepare(
            "UPDATE whatsapp_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'sending'"
          ).bind(wa.id).run();
          waSent++;
        } catch (err) {
          var waAttempts = (wa.attempts || 0) + 1;
          var waMsg = String((err && err.message) || err).slice(0, 300);
          await env.DB.prepare(
            "UPDATE whatsapp_queue SET status = ?, attempts = ?, last_error = ?, scheduled_at = datetime('now', '+5 minutes') WHERE id = ? AND status = 'sending'"
          ).bind(waAttempts >= 3 ? 'failed' : 'pending', waAttempts, waMsg, wa.id).run();
          result.errors.push('whatsapp-' + wa.id + ': ' + waMsg);
        }
      }
      result.whatsapp = { sent: waSent, pending: waPending };
    } catch (err) {
      result.errors.push('whatsapp-process: ' + err.message);
    }

    // Step 4: Drain the newsletter outbox (bounded batch per tick)
    try {
      var { results: outRows } = await env.DB.prepare(
        `SELECT o.id, o.issue_id, o.email, o.name, o.edition, o.ref_code, i.subject, i.html, i.issue_number
         FROM newsletter_outbox o JOIN newsletter_issues i ON i.id = o.issue_id
         WHERE o.status = 'pending' AND o.attempts < 3
         ORDER BY o.id ASC LIMIT 50`
      ).all();

      var nlSent = 0, nlFail = 0;
      var touchedIssues = {};
      for (var n = 0; n < outRows.length; n++) {
        var item = outRows[n];
        touchedIssues[item.issue_id] = true;
        // Claim before sending so two overlapping cron ticks cannot both
        // deliver the same outbox row.
        var outClaim = await env.DB.prepare(
          "UPDATE newsletter_outbox SET status = 'sending' WHERE id = ? AND status = 'pending'"
        ).bind(item.id).run();
        if (!outClaim || !outClaim.meta || outClaim.meta.changes === 0) continue;
        try {
          const tag = 'newsletter-issue-' + (item.issue_number || item.issue_id || 'x');
          await sendBrevoEmail(env, item.email, item.name, item.subject, personalize(item.html || '', item.name, item.edition, item.ref_code), { tags: ['newsletter', tag] });
          var sentNl = await env.DB.prepare(
            "UPDATE newsletter_outbox SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'sending'"
          ).bind(item.id).run();
          if (sentNl && sentNl.meta && sentNl.meta.changes > 0) nlSent++;
        } catch (err) {
          var errMsg = String((err && err.message) || err).slice(0, 200);
          try {
            var cur = await env.DB.prepare('SELECT attempts FROM newsletter_outbox WHERE id = ?').bind(item.id).first();
            var nextAttempts = ((cur && cur.attempts) || 0) + 1;
            await env.DB.prepare("UPDATE newsletter_outbox SET attempts = ?, last_error = ?, status = ? WHERE id = ? AND status = 'sending'").bind(nextAttempts, errMsg, nextAttempts >= 3 ? 'failed' : 'pending', item.id).run();
          } catch (_e) {}
          nlFail++;
        }
      }
      for (var issueId in touchedIssues) {
        try {
          var sentN = await env.DB.prepare("SELECT COUNT(*) AS n FROM newsletter_outbox WHERE issue_id = ? AND status = 'sent'").bind(issueId).first();
          var failN = await env.DB.prepare("SELECT COUNT(*) AS n FROM newsletter_outbox WHERE issue_id = ? AND status = 'failed'").bind(issueId).first();
          var activeN = await env.DB.prepare("SELECT COUNT(*) AS n FROM newsletter_outbox WHERE issue_id = ? AND status IN ('pending', 'sending')").bind(issueId).first();
          var sentCount = (sentN && sentN.n) || 0;
          var failCount = (failN && failN.n) || 0;
          var activeCount = (activeN && activeN.n) || 0;
          var issueStatus = activeCount > 0 ? 'sending' : (failCount > 0 ? (sentCount > 0 ? 'partial' : 'failed') : 'sent');
          await env.DB.prepare("UPDATE newsletter_issues SET sent_count = ?, failed_count = ?, status = ? WHERE id = ?")
            .bind(sentCount, failCount, issueStatus, issueId).run();
        } catch (_e) {}
      }
      result.newsletter = { sent: nlSent, failed: nlFail, attempted: outRows.length };
    } catch (err) {
      result.errors.push('newsletter: ' + err.message);
    }

    // Step 5: Saturday scheduled send (approved issues only — never auto-send drafts)
    try {
      const weekOf = saturdaySendDue(new Date());
      if (weekOf) {
        const sched = await env.DB.prepare(
          "SELECT id, subject, theme, html FROM newsletter_schedule WHERE week_of = ? AND status = 'approved' ORDER BY id DESC LIMIT 1"
        ).bind(weekOf).first();
        if (sched) {
          const queued = await enqueueBroadcast(env, { subject: sched.subject, theme: sched.theme, html: sched.html });
          if (queued.ok) {
            var scheduleClaim = await env.DB.prepare(
              "UPDATE newsletter_schedule SET status = 'queued', issue_id = ?, updated_at = datetime('now') WHERE id = ? AND status = 'approved'"
            ).bind(queued.issueId, sched.id).run();
            if (scheduleClaim && scheduleClaim.meta && scheduleClaim.meta.changes === 0) {
              result.errors.push('scheduled: issue ' + sched.id + ' is no longer approved');
            } else {
              result.scheduled = { sent: true, week_of: weekOf, issue_number: queued.issueNumber, enqueued: queued.enqueued };
            }
          } else {
            result.errors.push('scheduled: ' + queued.error);
          }
        }
      }
    } catch (err) {
      result.errors.push('scheduled: ' + err.message);
    }

    // Step 6: publish scheduled blog posts once their date is due.
    try {
      var nowDb = new Date().toISOString().slice(0, 19).replace('T', ' ');
      var { results: duePosts } = await env.DB.prepare(
        "SELECT id, slug, published_at, scheduled_at FROM posts WHERE status = 'scheduled' AND scheduled_at != '' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 50"
      ).all();
      var published = 0;
      for (var dp of duePosts) {
        var when = dbStamp(dp.scheduled_at || dp.published_at) || nowDb;
        var postClaim = await env.DB.prepare("UPDATE posts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'")
          .bind(when, nowDb, dp.id).run();
        if (postClaim && postClaim.meta && postClaim.meta.changes > 0) published++;
      }
      result.posts = { published: published, due: duePosts.length };
    } catch (err) {
      result.errors.push('scheduled-posts: ' + err.message);
    }

    // Step 7: flag due social-queue items as "due" so the admin calendar can
    // show a copy + post reminder. No platform auto-posting is attempted.
    try {
      var nowSocial = new Date().toISOString().slice(0, 19).replace('T', ' ');
      var { results: dueSocial } = await env.DB.prepare(
        "SELECT id FROM social_queue WHERE status IN ('planned', 'ready') AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC LIMIT 50"
      ).all();
      var flagged = 0;
      for (var sq of dueSocial) {
        var socialClaim = await env.DB.prepare("UPDATE social_queue SET status = 'due', updated_at = ? WHERE id = ? AND status IN ('planned', 'ready')")
          .bind(nowSocial, sq.id).run();
        if (socialClaim && socialClaim.meta && socialClaim.meta.changes > 0) flagged++;
      }
      result.social_queue = { due: flagged, checked: dueSocial.length };
    } catch (err) {
      result.errors.push('social-queue: ' + err.message);
    }

    return new Response(JSON.stringify({ status: 'ok', ...result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
