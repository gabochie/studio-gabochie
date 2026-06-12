export async function onRequest(context) {
  return new Response(JSON.stringify({ status: 'ok', message: 'New root API file works!' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
