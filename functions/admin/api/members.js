import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  var url = new URL(request.url);
  var method = request.method;

  try {
    // GET /api/members — list all members (with optional search)
    if (method === 'GET') {
      var search = url.searchParams.get('search') || '';
      var page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      var limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
      var offset = (page - 1) * limit;

      var where = '';
      var binds = [];
      if (search) {
        where = 'WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?';
        var s = '%' + search + '%';
        binds = [s, s, s];
      }

      var countRow = await db.prepare('SELECT COUNT(*) AS total FROM users u ' + where).bind(...binds).first();
      var total = countRow ? countRow.total : 0;

      var rows = await db.prepare(
        'SELECT u.id, u.name, u.email, u.phone, u.membership_tier, u.membership_expires_at, u.email_verified, u.created_at, u.last_login_at ' +
        'FROM users u ' + where + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?'
      ).bind(...binds, limit, offset).all();

      // Attach subscription info per user
      var items = rows.results || [];
      for (var i = 0; i < items.length; i++) {
        var sub = await db.prepare(
          "SELECT id, tier, amount, currency, status, start_date, next_billing, cancelled_at FROM subscriptions WHERE email = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(items[i].email).first();
        items[i].subscription = sub || null;
      }

      return new Response(JSON.stringify({
        status: 'ok',
        total: total,
        page: page,
        limit: limit,
        items: items
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // PUT /api/members — update member tier/expiry
    if (method === 'PUT') {
      var body = await request.json();
      var { id, membership_tier, membership_expires_at } = body;
      if (!id) {
        return new Response(JSON.stringify({ status: 'error', message: 'Missing member id' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      var validTiers = ['free', 'premium', 'vip'];
      if (membership_tier && !validTiers.includes(membership_tier)) {
        return new Response(JSON.stringify({ status: 'error', message: 'Invalid tier. Must be free, premium, or vip' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      var sets = [];
      var b = [];
      if (membership_tier) { sets.push('membership_tier = ?'); b.push(membership_tier); }
      if (membership_expires_at !== undefined) { sets.push('membership_expires_at = ?'); b.push(membership_expires_at || ''); }
      if (sets.length === 0) {
        return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      b.push(id);
      await db.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').bind(...b).run();

      var user = await db.prepare('SELECT id, name, email, phone, membership_tier, membership_expires_at, created_at FROM users WHERE id = ?').bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', user: user }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
