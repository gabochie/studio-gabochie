export async function onRequest(context) {
  return new Response(JSON.stringify({ status: 'ok', message: 'New file in existing directory works!' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
