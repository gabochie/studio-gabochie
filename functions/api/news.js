export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rssUrl = url.searchParams.get('url');

  if (!rssUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const resp = await fetch(rssUrl);
    const xml = await resp.text();
    const items = parseRSS(xml, rssUrl);
    return new Response(JSON.stringify({ status: 'ok', items }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

function parseRSS(xml, feedUrl) {
  const items = [];
  const source = extractDomain(feedUrl);
  const itemRegex = /<item>[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[0];
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
      image: extractImage(block),
      source
    });
  }
  return items;
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  if (!m) return '';
  return (m[1] || m[2] || '').replace(/<[^>]+>/g, '').trim();
}

function extractImage(xml) {
  var m;
  m = /<media:content[^>]*\surl="([^"]*)"[^>]*medium="image"/i.exec(xml);
  if (m) return m[1];
  m = /<media:thumbnail[^>]*\surl="([^"]*)"/i.exec(xml);
  if (m) return m[1];
  m = /<enclosure[^>]*\surl="([^"]*)"[^>]*type="image\//i.exec(xml);
  if (m) return m[1];
  m = /<img[^>]*\ssrc="([^"]*)"/i.exec(xml);
  if (m) return m[1];
  return '';
}

function extractDomain(url) {
  const m = url.match(/https?:\/\/([^/]+)/);
  return m ? m[1].replace('www.', '') : '';
}
