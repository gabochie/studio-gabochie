export async function onRequest(_context) {
  return new Response(null, {
    status: 301,
    headers: { 'Location': '/guitar/' }
  });
}
