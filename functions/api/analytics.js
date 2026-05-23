export async function onRequest(context) {
  return new Response(JSON.stringify({
    status: 'deprecated',
    message: 'Cloudflare GraphQL analytics has been replaced by D1-based tracking. Use /admin/api/summary instead.'
  }), { headers: { 'Content-Type': 'application/json' } });
}
