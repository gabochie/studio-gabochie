// Both admin URL trees (/admin/ and /api/admin/) must apply exactly the same
// authorization rules. Delegate to the canonical helper rather than
// re-implementing it — the /api/ version also accepts named console role
// sessions, and a divergent copy let the same operator be authorized by one
// prefix and denied by the other.
import { requireAdminAuth as sharedRequireAdminAuth } from '../api/admin/_admin-auth.js';

export async function requireAdmin(request, env) {
  return sharedRequireAdminAuth(request, env);
}
