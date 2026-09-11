var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

var CATEGORY_MAP = {
  '103': { slug: 'music', label: 'Music', icon: '🎵' },
  '104': { slug: 'film', label: 'Film & Media', icon: '🎬' },
  '105': { slug: 'sports', label: 'Sports & Fitness', icon: '⚽' },
  '106': { slug: 'conference', label: 'Conference', icon: '📊' },
  '107': { slug: 'community', label: 'Community', icon: '🤝' },
  '108': { slug: 'arts', label: 'Arts & Culture', icon: '🎨' },
  '109': { slug: 'food', label: 'Food & Drink', icon: '🍽️' },
  '110': { slug: 'education', label: 'Education', icon: '📚' },
  '111': { slug: 'fashion', label: 'Fashion', icon: '👗' },
  '112': { slug: 'health', label: 'Health & Wellness', icon: '🧘' },
  '113': { slug: 'business', label: 'Business & Networking', icon: '💼' },
  '114': { slug: 'religion', label: 'Religion & Spirituality', icon: '⛪' },
  '115': { slug: 'government', label: 'Government & Politics', icon: '🏛️' },
  '116': { slug: 'party', label: 'Nightlife & Parties', icon: '🎉' },
};

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  var url = new URL(request.url);
  var maxEvents = parseInt(url.searchParams.get('limit')) || 50;

  var results = [];

  // 1. Fetch from Eventbrite
  var ebToken = env.EVENTBRITE_API_KEY || '';
  if (ebToken) {
    try {
      var ebUrl = 'https://www.eventbriteapi.com/v3/events/search/?location.address=' + encodeURIComponent('Accra, Ghana') + '&location.within=50km&sort_by=date&expand=venue,category&size=' + Math.min(maxEvents, 50);
      var ebRes = await fetch(ebUrl, {
        headers: { 'Authorization': 'Bearer ' + ebToken, 'Accept': 'application/json' }
      });
      if (ebRes.ok) {
        var ebData = await ebRes.json();
        (ebData.events || []).forEach(function(e) {
          var cat = e.category_id ? CATEGORY_MAP[e.category_id] : null;
          var start = e.start && e.start.utc ? e.start.utc : '';
          var end = e.end && e.end.utc ? e.end.utc : '';
          var venue = e.venue || {};
          results.push({
            id: 'eb-' + e.id,
            source: 'eventbrite',
            title: e.name && e.name.text ? e.name.text : 'Untitled',
            description: e.description && e.description.text ? e.description.text.slice(0, 500) : '',
            url: e.url || '',
            start: start,
            end: end,
            category: cat ? cat.slug : 'community',
            category_label: cat ? cat.label : 'Community',
            category_icon: cat ? cat.icon : '📌',
            venue: venue.name ? venue.name.text : '',
            address: (venue.address || {}).localized_address_display || '',
            image: e.logo && e.logo.url ? e.logo.url : '',
            price: e.is_free ? 'Free' : (e.ticket_availability && e.ticket_availability.minimum_ticket_price ? e.ticket_availability.minimum_ticket_price.display : 'Paid'),
            created_at: e.created || start,
          });
        });
      }
    } catch (_) {}
  }

  // 2. Fetch from DB (admin-curated events)
  if (env.DB) {
    try {
      var dbRes = await env.DB.prepare(
        "SELECT id, title, description, category, price, location, contact_email, contact_phone, website, created_at, featured FROM classifieds WHERE status = 'approved' AND category = 'events' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT ?"
      ).bind(maxEvents).all();
      (dbRes.results || []).forEach(function(r) {
        results.push({
          id: 'db-' + r.id,
          source: 'curated',
          title: r.title || '',
          description: (r.description || '').slice(0, 500),
          url: r.website || '',
          start: r.created_at || '',
          end: '',
          category: 'curated',
          category_label: 'Curated',
          category_icon: '⭐',
          venue: r.location || '',
          address: '',
          image: '',
          price: r.price || 'Free',
          created_at: r.created_at || '',
        });
      });
    } catch (_) {}
  }

  // 3. Sort by start date (earliest first), deduplicate by title
  var seen = {};
  results = results.filter(function(e) {
    var key = e.title.toLowerCase().trim();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function(a, b) {
    return (a.start || '').localeCompare(b.start || '');
  }).slice(0, maxEvents);

  return new Response(JSON.stringify({ status: 'ok', events: results, total: results.length }), {
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}