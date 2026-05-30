export async function onRequest(context) {
  const { request } = context;
  try {
    const body = request.method === 'POST' ? await request.json() : {};
    return new Response(JSON.stringify({
      method: request.method,
      body: body,
      ok: true
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
