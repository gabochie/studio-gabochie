const CF_API = 'https://api.cloudflare.com/client/v4/graphql';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function graphql(token, zoneId, query) {
  const resp = await fetch(CF_API, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await resp.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '7d';
  const days = range === '30d' ? 30 : range === 'today' ? 0 : 7;
  const since = daysAgo(days + 1);
  const until = daysAgo(0);

  const token = env.CF_API_TOKEN;
  const zoneId = env.CF_ZONE_ID;

  if (!token || !zoneId) {
    return new Response(JSON.stringify({
      status: 'not_configured',
      message: 'Set CF_API_TOKEN and CF_ZONE_ID env vars in Cloudflare Pages dashboard'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const timeseriesQuery = `{
      viewer {
        zones(filter: {zoneTag: "${zoneId}"}) {
          httpRequests1mGroups(
            orderBy: [datetimeMinute_ASC]
            limit: 5000
            filter: { datetimeMinute_geq: "${since}", datetimeMinute_leq: "${until}" }
          ) {
            dimensions { datetimeMinute }
            sum { requests bytes }
            uniq { uniques }
          }
        }
      }
    }`;

    const pagesQuery = `{
      viewer {
        zones(filter: {zoneTag: "${zoneId}"}) {
          httpRequestsAdaptiveGroups(
            limit: 200
            filter: { datetime_geq: "${since}", datetime_leq: "${until}" }
          ) {
            dimensions { requestPath clientCountryName }
            sum { requests }
          }
        }
      }
    }`;

    const [timeseriesResult, breakdownsResult] = await Promise.all([
      graphql(token, zoneId, timeseriesQuery),
      graphql(token, zoneId, pagesQuery)
    ]);

    const rawGroups = timeseriesResult.viewer.zones[0].httpRequests1mGroups || [];
    const rawBreakdowns = breakdownsResult.viewer.zones[0].httpRequestsAdaptiveGroups || [];

    const topPagesMap = {};
    const countryMap = {};

    (rawBreakdowns || []).forEach(g => {
      const path = g.dimensions.requestPath || '/';
      const country = g.dimensions.clientCountryName || 'Unknown';
      const reqs = g.sum.requests || 0;
      topPagesMap[path] = (topPagesMap[path] || 0) + reqs;
      countryMap[country] = (countryMap[country] || 0) + reqs;
    });

    let byDay = {};
    let totalRequests = 0, totalBandwidth = 0, totalUniques = 0;

    (rawGroups || []).forEach(g => {
      const day = g.dimensions.datetimeMinute.slice(0, 10);
      if (!byDay[day]) byDay[day] = { requests: 0, bytes: 0, uniques: 0 };
      byDay[day].requests += g.sum.requests || 0;
      byDay[day].bytes += g.sum.bytes || 0;
      byDay[day].uniques += g.uniq ? g.uniq.uniques || 0 : 0;
      totalRequests += g.sum.requests || 0;
      totalBandwidth += g.sum.bytes || 0;
      totalUniques += g.uniq ? g.uniq.uniques || 0 : 0;
    });

    const daily = Object.keys(byDay).sort().map(d => ({
      date: d,
      requests: byDay[d].requests,
      bytes: byDay[d].bytes,
      uniques: byDay[d].uniques || 0
    }));

    const topPages = Object.keys(topPagesMap)
      .sort((a, b) => topPagesMap[b] - topPagesMap[a])
      .slice(0, 10)
      .map(path => ({ path, count: topPagesMap[path] }));

    const countries = Object.keys(countryMap)
      .sort((a, b) => countryMap[b] - countryMap[a])
      .slice(0, 15)
      .map(c => ({ country: c, count: countryMap[c] }));

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
      top_pages: topPages,
      top_countries: countries,
      last_updated: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
