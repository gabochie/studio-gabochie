import { requireAdmin } from '../_auth.js';

/*
 * Combined revenue dashboard API.
 *
 * Golden rule: a status recorded on a redirect/success URL is NEVER revenue.
 * Only rows whose status was written by a server-side re-verification step
 * (gateway callback re-query, or an admin checking a manual proof of payment)
 * are counted as `settled`. Everything else is `pending`. Known-bad states
 * are `failed`. Selar has no callback/webhook here, so it is deliberately
 * reported as a manual bucket — it must be reconciled from Selar's dashboard.
 */

var JSON_HEADERS = { 'Content-Type': 'application/json' };

var FAILED_DONATION = ['failed', 'transfer_failed', 'refund_failed'];
var FAILED_ORDER = ['failed', 'refunded', 'cancelled', 'expired', 'declined'];

// One-time, server-verified streams. `column` is the money column;
// `dateColumn` is the timestamp used for the 12-month series.
var ONE_OFF_STREAMS = [
  { key: 'donations', label: 'Donations', table: 'donations', column: 'amount', dateColumn: 'created_at', settled: ['successful', 'completed'], failed: FAILED_DONATION, note: 'Gateway re-query or admin-confirmed manual rail' },
  { key: 'bookings', label: 'Bookings & ads', table: 'bookings', column: 'amount', dateColumn: 'created_at', settled: ['paid', 'active', 'completed'], failed: FAILED_ORDER, note: 'Paid bookings only' },
  { key: 'books', label: 'Books', table: 'book_purchases', column: 'amount', dateColumn: 'created_at', settled: ['completed'], failed: FAILED_ORDER, note: 'Download unlocked only after verification' },
  { key: 'store', label: 'Merch & store', table: 'store_orders', column: 'amount', dateColumn: 'created_at', settled: ['completed'], failed: FAILED_ORDER, note: 'Download/shipment only after verification' },
  { key: 'guitar', label: 'Guitar School', table: 'guitar_payments', column: 'amount', dateColumn: 'created_at', settled: ['completed'], failed: FAILED_ORDER, note: 'Plan unlocked only after verification' },
  { key: 'courses', label: 'Courses', table: 'enrollments', column: 'payment_amount', dateColumn: 'enrolled_at', settled: ['active', 'paid', 'completed'], failed: FAILED_ORDER, note: 'Paid enrollments only' }
];

var CONSULTATION_PRICES = { anchor: 1500, sprint: 5000, retainer: 10000 };

function q(values) {
  return values.map(function (v) { return "'" + String(v).replace(/'/g, "''") + "'"; }).join(',');
}

function num(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

async function safeFirst(db, sql, fallback) {
  try {
    var row = await db.prepare(sql).first();
    return row || fallback;
  } catch (_e) {
    return fallback;
  }
}

async function safeAll(db, sql) {
  try {
    var res = await db.prepare(sql).all();
    return res.results || [];
  } catch (_e) {
    return [];
  }
}

function aggregateSql(stream) {
  var settled = q(stream.settled);
  var failed = q(stream.failed);
  var finalStates = q(stream.settled.concat(stream.failed));
  return 'SELECT ' +
    'COALESCE(SUM(CASE WHEN status IN (' + settled + ') THEN ' + stream.column + ' ELSE 0 END),0) AS settled, ' +
    'COALESCE(SUM(CASE WHEN status NOT IN (' + finalStates + ') THEN ' + stream.column + ' ELSE 0 END),0) AS pending, ' +
    'COALESCE(SUM(CASE WHEN status IN (' + failed + ') THEN ' + stream.column + ' ELSE 0 END),0) AS failed, ' +
    'COALESCE(SUM(CASE WHEN status IN (' + settled + ') THEN 1 ELSE 0 END),0) AS count, ' +
    'MAX(CASE WHEN status IN (' + settled + ') THEN ' + stream.dateColumn + ' END) AS last_at ' +
    'FROM ' + stream.table;
}

function monthlySql(stream) {
  return 'SELECT strftime(\'%Y-%m\', ' + stream.dateColumn + ') AS month, ' +
    'COALESCE(SUM(' + stream.column + '),0) AS total FROM ' + stream.table +
    ' WHERE status IN (' + q(stream.settled) + ')' +
    ' AND ' + stream.dateColumn + ' >= datetime(\'now\', \'-12 months\')' +
    ' GROUP BY month ORDER BY month';
}

function lastTwelveMonths() {
  var months = [];
  var now = new Date();
  for (var i = 11; i >= 0; i--) {
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function consultationPotential(service) {
  var s = String(service || '').toLowerCase();
  if (s.indexOf('anchor') >= 0) return CONSULTATION_PRICES.anchor;
  if (s.indexOf('sprint') >= 0) return CONSULTATION_PRICES.sprint;
  if (s.indexOf('retainer') >= 0) return CONSULTATION_PRICES.retainer;
  return 0;
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;

  var authError = await requireAdmin(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: JSON_HEADERS
    });
  }

  var db = env.DB;
  try {
    // Each stream is independent: one missing/renamed table cannot blank the dashboard.
    var streamResults = await Promise.all(ONE_OFF_STREAMS.map(async function (stream) {
      var row = await safeFirst(db, aggregateSql(stream), {});
      var series = await safeAll(db, monthlySql(stream));
      return {
        key: stream.key,
        label: stream.label,
        kind: 'one_off',
        settled: num(row.settled),
        pending: num(row.pending),
        failed: num(row.failed),
        count: num(row.count),
        last_at: row.last_at || '',
        note: stream.note,
        series: series
      };
    }));

    // Recurring subscriptions: active ARR/MRR, not a lifetime sales total.
    var subscriptionRow = await safeFirst(db,
      "SELECT COALESCE(SUM(amount),0) AS mrr, COUNT(*) AS count FROM subscriptions WHERE status = 'active'", {});

    // Consultation leads are pipeline, never revenue until an invoice is verified.
    var leadRows = await safeAll(db,
      "SELECT service, COUNT(*) AS count, MAX(created_at) AS last_at FROM service_inquiries WHERE service LIKE '%onsult%' GROUP BY service");
    var consultation = {
      leads: 0,
      new_leads: 0,
      potential: 0,
      by_level: leadRows.map(function (row) {
        var price = consultationPotential(row.service);
        var count = num(row.count);
        return {
          service: row.service || '',
          count: count,
          unit_price: price,
          potential: price * count,
          last_at: row.last_at || ''
        };
      })
    };
    consultation.leads = consultation.by_level.reduce(function (s, r) { return s + r.count; }, 0);
    consultation.potential = consultation.by_level.reduce(function (s, r) { return s + r.potential; }, 0);
    var sourceRows = await safeAll(db,
      "SELECT COALESCE(NULLIF(referral,''), 'direct') AS source, COUNT(*) AS count FROM service_inquiries WHERE service LIKE '%onsult%' GROUP BY source ORDER BY count DESC");
    consultation.by_source = sourceRows.map(function (row) {
      return { source: row.source || 'direct', count: num(row.count) };
    });
    var newLeadRow = await safeFirst(db,
      "SELECT COUNT(*) AS count FROM service_inquiries WHERE service LIKE '%onsult%' AND status = 'new'", {});
    consultation.new_leads = num(newLeadRow.count);

    // Reconciliation signals — deliberately separate from settled totals.
    var claimRows = await safeAll(db, 'SELECT status, COUNT(*) AS count FROM momo_manual_claims GROUP BY status');
    var claims = { submitted: 0, approved: 0, rejected: 0, other: 0 };
    claimRows.forEach(function (row) {
      var key = String(row.status || '');
      if (Object.prototype.hasOwnProperty.call(claims, key)) claims[key] += num(row.count);
      else claims.other += num(row.count);
    });

    // Merge per-stream monthly series into one 12-bucket chart.
    var months = lastTwelveMonths();
    var byMonth = {};
    months.forEach(function (m) { byMonth[m] = { month: m, total: 0 }; });
    streamResults.forEach(function (stream) {
      stream.series.forEach(function (point) {
        var month = String(point.month || '');
        if (byMonth[month]) byMonth[month][stream.key] = num(point.total);
        if (byMonth[month]) byMonth[month].total += num(point.total);
      });
      delete stream.series;
    });
    var monthly = months.map(function (m) { return byMonth[m]; });

    var totals = {
      settled: streamResults.reduce(function (s, r) { return s + r.settled; }, 0),
      pending: streamResults.reduce(function (s, r) { return s + r.pending; }, 0),
      failed: streamResults.reduce(function (s, r) { return s + r.failed; }, 0),
      mrr: num(subscriptionRow.mrr),
      subscription_count: num(subscriptionRow.count)
    };
    totals.verified_12m = monthly.reduce(function (s, r) { return s + r.total; }, 0);

    return new Response(JSON.stringify({
      status: 'ok',
      generated_at: new Date().toISOString(),
      currency: 'GHS',
      streams: streamResults,
      totals: totals,
      monthly: monthly,
      consultation: consultation,
      reconciliation: {
        manual_claims: claims,
        unverified_donations: streamResults[0].pending,
        failed_donations: streamResults[0].failed
      },
      manual_channels: [
        {
          key: 'selar',
          label: 'Selar (hosted checkout)',
          settled: null,
          note: 'Settles inside Selar. No webhook here — reconcile from the Selar dashboard before counting it.'
        },
        {
          key: 'consultation',
          label: 'Consultation (high-ticket)',
          settled: null,
          note: 'Leads only. Count as revenue only when the invoice is confirmed paid on a server-verified rail.'
        }
      ],
      verification_rule: 'settled = server re-verified only; pending = awaiting verification; failed = never counted'
    }), { headers: JSON_HEADERS });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: JSON_HEADERS
    });
  }
}
