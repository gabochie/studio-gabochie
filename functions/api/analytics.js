const CF_API = 'https://api.cloudflare.com/client/v4/graphql';

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

    const query = `{
      viewer {
        zones(filter: {zoneTag: "${zoneId}"}) {
          httpRequests1mGroups(
            limit: 1000
            filter: { datetime_geq: "${since}" }
            orderBy: [datetime_ASC]
          ) {
            dimensions { date }
            sum { requests bytes }
            uniq { uniques }
          }
        }
      }
    }`;

    const resp = await fetch(CF_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await resp.json();

    if (data.errors) {
      // Try without uniq if that's the issue
      if (data.errors[0].message.includes('uniques') || data.errors[0].message.includes('uniq')) {
        const query2 = `{
          viewer {
            zones(filter: {zoneTag: "${zoneId}"}) {
              httpRequests1mGroups(
                limit: 1000
                filter: { datetime_geq: "${since}" }
                orderBy: [datetime_ASC]
              ) {
                dimensions { date }
                sum { requests bytes }
              }
            }
          }
        }`;
        const resp2 = await fetch(CF_API, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: query2 })
        });
        const data2 = await resp2.json();
        if (data2.errors) throw new Error(data2.errors[0].message);
        data.data = data2.data;
      } else {
        throw new Error(data.errors[0].message);
      }
    }

    const rawGroups = data.data?.viewer?.zones?.[0]?.httpRequests1mGroups || [];

    let byDay = {};
    let totalRequests = 0, totalBandwidth = 0, totalUniques = 0;

    rawGroups.forEach(g => {
      const day = g.dimensions.date || g.dimensions.datetime || g.dimensions.datetimeMinute;
      if (!day) return;
      const d = day.slice(0, 10);
      if (!byDay[d]) byDay[d] = { requests: 0, bytes: 0, uniques: 0 };
      byDay[d].requests += g.sum?.requests || 0;
      byDay[d].bytes += g.sum?.bytes || 0;
      byDay[d].uniques += g.uniq?.uniques || 0;
      totalRequests += g.sum?.requests || 0;
      totalBandwidth += g.sum?.bytes || 0;
      totalUniques += g.uniq?.uniques || 0;
    });

    const daily = Object.keys(byDay).sort().map(d => ({
      date: d,
      requests: byDay[d].requests,
      bytes: byDay[d].bytes,
      uniques: byDay[d].uniques || 0
    }));

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
      last_updated: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
