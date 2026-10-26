// GUITAR section — full API-level E2E of onboarding + payment chain.
// Drives the real backend: register -> enroll -> expresspay create -> mock
// hosted checkout -> server-to-server callback -> settlement -> unlock.
const BASE = 'http://localhost:8788';
const MOCK = 'http://localhost:8790';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  -- ' + detail : '')); }
}
async function j(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: r.status, body };
}
const email = 'e2e-guitar-' + Date.now() + '@test.gabochie.com';

(async () => {
  await fetch(MOCK + '/__reset');

  console.log('== 1. REGISTER (onboarding) ==');
  const reg = await j(BASE + '/api/guitar/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Tester', email: email, phone: '0200000001', skill_level: 'beginner' })
  });
  ok('register 200', reg.status === 200, JSON.stringify(reg.body).substring(0, 120));
  const token = reg.body && (reg.body.token || (reg.body.student && reg.body.student.token));
  ok('register returns token', !!token, JSON.stringify(reg.body).substring(0, 200));
  const auth = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  console.log('== 2. LADDER ENFORCEMENT ==');
  const goldFirst = await j(BASE + '/api/guitar/enroll', { method: 'POST', headers: auth, body: JSON.stringify({ plan: 'gold' }) });
  ok('gold without silver -> 400', goldFirst.status === 400, 'got ' + goldFirst.status + ' ' + JSON.stringify(goldFirst.body).substring(0, 100));
  const silverFirst = await j(BASE + '/api/guitar/enroll', { method: 'POST', headers: auth, body: JSON.stringify({ plan: 'silver' }) });
  ok('silver without bronze -> 400', silverFirst.status === 400, 'got ' + silverFirst.status);

  console.log('== 3. BRONZE ENROLL ==');
  const enr = await j(BASE + '/api/guitar/enroll', { method: 'POST', headers: auth, body: JSON.stringify({ plan: 'bronze' }) });
  ok('bronze enroll 200', enr.status === 200, JSON.stringify(enr.body).substring(0, 150));
  const tx = enr.body && enr.body.tx_ref;
  ok('tx_ref has GUITAR_ shape', /^GUITAR_\d+_[a-z0-9]+$/.test(tx || ''), tx || 'none');
  ok('amount resolved server-side (299)', enr.body && enr.body.amount === 299, String(enr.body && enr.body.amount));

  console.log('== 4. EXPRESSPAY CREATE -> MOCK CHECKOUT ==');
  const create = await j(BASE + '/api/gateways/expresspay/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_ref: tx, redirect: '/guitar/learn/' })
  });
  ok('create 200 ok', create.status === 200 && create.body.status === 'ok', JSON.stringify(create.body).substring(0, 150));
  ok('checkout_url points at mock gateway', /localhost:8790/.test(create.body.checkout_url || ''), create.body.checkout_url || 'none');
  const checkoutUrl = create.body.checkout_url;
  const page = await fetch(checkoutUrl);
  const pageText = await page.text();
  ok('mock hosted checkout renders', page.status === 200 && pageText.indexOf('Pay now') >= 0, 'status ' + page.status);
  const tokenInUrl = decodeURIComponent((checkoutUrl.match(/token=([^&]+)/) || [])[1] || '');

  console.log('== 5. BUYER PAYS -> S2S CALLBACK -> SETTLE ==');
  // Exactly what the mock checkout page's "Pay now" does:
  const cb = await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'order-id': tx, token: tokenInUrl, 'transaction-id': 'mocktx_e2e_' + Date.now() }).toString()
  });
  ok('callback 200', cb.status === 200, JSON.stringify(cb.body).substring(0, 120));
  const st1 = await j(BASE + '/api/guitar/enroll/status', { headers: { 'Authorization': 'Bearer ' + token } });
  ok('status reflects bronze unlock', st1.body && st1.body.bronzeUnlocked === true && st1.body.tier === 'bronze', JSON.stringify(st1.body).substring(0, 200));
  console.log('   status body: ' + JSON.stringify(st1.body).substring(0, 300));

  console.log('== 6. LADDER CONTINUES: silver now allowed ==');
  const enr2 = await j(BASE + '/api/guitar/enroll', { method: 'POST', headers: auth, body: JSON.stringify({ plan: 'silver' }) });
  ok('silver enroll allowed after bronze', enr2.status === 200, 'got ' + enr2.status + ' ' + JSON.stringify(enr2.body).substring(0, 120));

  console.log('== 7. DECLINE PATH (fresh user) ==');
  const email2 = 'e2e-guitar2-' + Date.now() + '@test.gabochie.com';
  const reg2 = await j(BASE + '/api/guitar/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Two', email: email2 })
  });
  const token2 = reg2.body && (reg2.body.token || (reg2.body.student && reg2.body.student.token));
  const auth2 = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token2 };
  const enr3 = await j(BASE + '/api/guitar/enroll', { method: 'POST', headers: auth2, body: JSON.stringify({ plan: 'bronze' }) });
  const tx3 = enr3.body.tx_ref;
  const create3 = await j(BASE + '/api/gateways/expresspay/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_ref: tx3, redirect: '/guitar/learn/' })
  });
  const tok3 = decodeURIComponent((create3.body.checkout_url.match(/token=([^&]+)/) || [])[1] || '');
  await fetch(MOCK + '/__set?token=' + tok3 + '&result=2'); // DECLINE
  const cb3 = await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'order-id': tx3, token: tok3, 'transaction-id': 'mocktx_declined' }).toString()
  });
  ok('declined callback still 200 (gateway stops retrying)', cb3.status === 200);
  const st3 = await j(BASE + '/api/guitar/enroll/status', { headers: { 'Authorization': 'Bearer ' + token2 } });
  const locked3 = st3.body && st3.body.bronzeUnlocked === false && st3.body.tier === 'none';
  ok('declined payment leaves course LOCKED', locked3, JSON.stringify(st3.body).substring(0, 200));

  console.log('\nRESULT: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR: ' + e.message); process.exit(2); });
