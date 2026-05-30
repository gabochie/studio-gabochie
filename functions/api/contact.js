import { queueEmail, manifestoFollowup, daysFromNow } from './email/_send.js';

export async function onRequest(context) {
  const { request, env } = context;

  // GET — admin subscriber listing (protected by referer check)
  if (request.method === 'GET') {
    const referer = request.headers.get('Referer') || '';
    if (!referer.includes('/admin/')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const { results } = await db.prepare(
        "SELECT * FROM subscribers ORDER BY subscribed_at DESC"
      ).all();
      return new Response(JSON.stringify({ status: 'ok', count: results.length, items: results }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST — form submission
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST' }
    });
  }
  try {
    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const book = formData.get('book') || formData.get('_subject') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    // Store in D1
    const db = env.DB;
    if (db && email) {
      await db.prepare(
        `INSERT OR IGNORE INTO subscribers (name, email, source, book) VALUES (?, ?, ?, ?)`
      ).bind(name, email, book || 'contact', book || '').run();
      // Queue manifesto follow-up (day 3) if a book download
      if (book) {
        try {
          const slugMap = { 'The Bible as Kingdom OS': 'the-bible-as-kingdom-os', 'The Divine Algorithm': 'divine-algorithm', 'AI-Powered Strategic Development': 'ai-national-development', '1 Million Coders Manifesto': '1-million-coders-manifesto' };
          const slug = slugMap[book] || 'the-bible-as-kingdom-os';
          await queueEmail(env, email, name, 'Did You Get Your Free Copy?', manifestoFollowup(name, book, email, slug), 'manifesto_followup', daysFromNow(3));
        } catch (_) {}
      }
    }

    // Forward to Formspree as email fallback
    const fp = new FormData();
    fp.append('name', name);
    fp.append('email', email);
    fp.append('_subject', book || 'New contact form submission');
    fp.append('_next', formData.get('_next') || 'https://gideonabochie.org');
    await fetch('https://formspree.io/f/xgoplkoe', {
      method: 'POST', body: fp, headers: { 'Accept': 'application/json' }
    }).catch(function(){});

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
