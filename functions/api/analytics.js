const CF_API = 'https://api.cloudflare.com/client/v4';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '7d';
  const days = range === '30d' ? 30 : range === 'today' ? 0 : 7;

  const token = env.CF_API_TOKEN;
  const zoneId = env.CF_ZONE_ID;

  if (!token || !zoneId) {
    return new Response(JSON.stringify({
      status: 'not_configured',
      message: 'Set CF_API_TOKEN and CF_ZONE_ID env vars in Cloudflare Pages dashboard'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const until = new Date().toISOString();

    const resp = await fetch(
      `${CF_API}/zones/${zoneId}/analytics/dashboard?since=${since}&until=${until}&continuous=true`,
      { headers: { 'Authorization': 'Bearer ' + token } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(resp.status + ': ' + errText.slice(0, 200));
    }

    const data = await resp.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'API error');

    const totals = data.result.totals || {};
    const timeseries = data.result.timeseries || [];

    const daily = timeseries.map(t => ({
      date: t.since.slice(0, 10),
      requests: t.requests?.all || 0,
      bytes: t.bandwidth?.all || 0,
      uniques: t.uniques?.all || 0
    }));

    const totalRequests = totals.requests?.all || 0;
    const totalBandwidth = totals.bandwidth?.all || 0;
    const totalUniques = totals.uniques?.all || 0;

    return new Response(JSON.stringify({
      status: 'ok',
      range,
      total: {
        requests: totalRequests,
        bandwidth_bytes: totalBandwidth,
        bandwidth_gb: +(totalBandwidth / 1073741824).toFixed(3),
        uniques: totalUniques
      },
      daily,
      top_countries: (totals.uniques?.uniques_by_country || []).slice(0, 15).map(c => ({
        country: c.country || c.name || 'Unknown',
        count: c.visits || c.value || 0
      })),
      top_pages: (totals.requests?.requests_by_path || []).slice(0, 10).map(p => ({
        path: p.path || p.name || '/',
        count: p.requests || p.value || 0
      })),
      last_updated: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
