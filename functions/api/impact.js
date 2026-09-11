export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'ok', fallback: true, items: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  try {
    await db.prepare(
      "SELECT COUNT(*) AS n FROM donations WHERE status = 'successful'"
    ).first();
    var subscribers = await db.prepare(
      "SELECT COUNT(*) AS n FROM subscribers WHERE confirmed = 1"
    ).first();
    var studentsRaw = await db.prepare("SELECT COUNT(*) AS n FROM students").first();
    var enrolls = await db.prepare(
      "SELECT COUNT(*) AS n FROM enrollments WHERE status = 'active'"
    ).first();
    var orders = await db.prepare(
      "SELECT COUNT(*) AS n FROM store_orders WHERE status IN ('successful', 'completed')"
    ).first();

    var items = [];
    items.push({ label: 'Community Members', value: String(subscribers.n || 0) });
    items.push({ label: 'Students Enrolled', value: String(studentsRaw.n || 0) });
    items.push({ label: 'Active Courses', value: String(enrolls.n || 0) });
    items.push({ label: 'Orders Fulfilled', value: String(orders.n || 0) });

    return new Response(JSON.stringify({ status: 'ok', fallback: false, items: items }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'ok', fallback: true, items: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}