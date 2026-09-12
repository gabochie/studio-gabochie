export function moolreBase(env) {
  if (env.MOOLRE_BASE_URL) return env.MOOLRE_BASE_URL;
  return env.MOOLRE_SANDBOX ? 'https://sandbox.moolre.com' : 'https://api.moolre.com';
}

export function moolreHeaders(env) {
  const headers = { 'Content-Type': 'application/json' };
  // Sandbox omits placeholder private/public key headers; only send when configured.
  if (env.MOOLRE_API_USER && env.MOOLRE_PUBLIC_KEY) {
    headers['X-API-USER'] = env.MOOLRE_API_USER;
    headers['X-API-PUBKEY'] = env.MOOLRE_PUBLIC_KEY;
  }
  return headers;
}

// Verify a Moolre payment via the Payment Status API. Returns { success, amount, transactionid }.
export async function verifyMoolre(env, opts) {
  try {
    const base = moolreBase(env);
    const headers = moolreHeaders(env);
    const accountnumber = env.MOOLRE_ACCOUNT_NUMBER || '';
    // Prefer externalref (idtype 1), then Moolre transaction id (idtype 2), then thirdpartyref.
    if (opts.externalref) {
      const r = await fetch(base + '/open/transact/status', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 1, idtype: 1, id: opts.externalref, accountnumber })
      });
      if (r.ok) {
        const d = await r.json();
        if (d.status === 1 && d.data && d.data.txstatus === 1) {
          return { success: true, amount: d.data.amount, transactionid: d.data.transactionid, externalref: d.data.externalref };
        }
      } else {
        return { success: false, error: 'status_http_' + r.status };
      }
    }
    if (opts.transactionid) {
      const r2 = await fetch(base + '/open/transact/status', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 1, idtype: 2, id: opts.transactionid, accountnumber })
      });
      if (r2.ok) {
        const d2 = await r2.json();
        if (d2.status === 1 && d2.data && d2.data.txstatus === 1) {
          return { success: true, amount: d2.data.amount, transactionid: d2.data.transactionid, externalref: d2.data.externalref };
        }
      } else {
        return { success: false, error: 'status_http_' + r2.status };
      }
    }
    return { success: false, error: 'not_verified' };
  } catch (_e) {
    return { success: false, error: 'exception' };
  }
}

export function publicBase(env) {
  return env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
}