export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return json({ error: 'D1 not bound' }, 501);
  }
  try {
    var body = await context.request.json();
    var interests = body.interests;
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return json({ error: 'Please select at least one interest' }, 400);
    }
    var other_text = (body.other_text || '').trim();
    var name = (body.name || '').trim();
    var email = (body.email || '').trim();
    var phone = (body.phone || '').trim();
    await db.prepare(
      'INSERT INTO survey_responses (name, email, phone, interests, other_text) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, email, phone, JSON.stringify(interests), other_text).run();
    return json({ status: 'ok' });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
