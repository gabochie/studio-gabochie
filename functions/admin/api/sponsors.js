import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const rows = await env.DB.prepare("SELECT * FROM sponsors ORDER BY created_at DESC").all();
      return new Response(JSON.stringify({ status: 'ok', count: rows.results.length, items: rows.results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { email, company, access_code } = body;
      if (!email || !access_code) {
        return new Response(JSON.stringify({ error: 'Email and access code required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      try {
        await env.DB.prepare(
          'INSERT INTO sponsors (email, company, access_code) VALUES (?, ?, ?)'
        ).bind(email.trim().toLowerCase(), company || '', access_code.trim()).run();
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          return new Response(JSON.stringify({ error: 'A sponsor with this email already exists' }), {
            status: 409, headers: { 'Content-Type': 'application/json' }
          });
        }
        throw e;
      }
      return new Response(JSON.stringify({ status: 'ok', message: 'Sponsor created' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PATCH' && id) {
      const body = await request.json();
      const { company, access_code, status } = body;
      const sets = [];
      const vals = [];
      if (company !== undefined) { sets.push('company = ?'); vals.push(company); }
      if (access_code !== undefined) { sets.push('access_code = ?'); vals.push(access_code); }
      if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
      if (sets.length > 0) {
        vals.push(id);
        await env.DB.prepare('UPDATE sponsors SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
      }
      return new Response(JSON.stringify({ status: 'ok', updated: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM sponsors WHERE id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM sponsor_sessions WHERE email = (SELECT email FROM sponsors WHERE id = ?)').bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', deleted: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message || 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
