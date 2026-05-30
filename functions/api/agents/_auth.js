export function requireAgentAuth(request, env) {
  var key = request.headers.get('X-Agent-Auth') || '';
  var expected = env.AGENT_AUTH_KEY || '';
  if (!expected) {
    return new Response(JSON.stringify({ status: 'error', message: 'Agent auth not configured' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (key !== expected) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}

export function getAgentToken(request) {
  var auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  var url = new URL(request.url);
  return url.searchParams.get('token') || '';
}
