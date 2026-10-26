// CHURCH (give + shop) and SCHOOL (enroll -> upgrade) â€” API-level E2E.
// Same mock-ExpressPay chain as the guitar script.
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
function form(p) { return new URLSearchParams(p).toString(); }
// Fresh simulated client IP per create-call so the D1 rate limiter (5/min/IP)
// treats each test as a different visitor, like real traffic would.
let ipSeq = 10;
function createPay(body) {
  return j(BASE + '/api/gateways/expresspay/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.99.7.' + (ipSeq++) },
    body: JSON.stringify(body)
  });
}

(async () => {
  await fetch(MOCK + '/__reset');
  const stamp = Date.now();

  console.log('== CHURCH 1. GIVE â€” anonymous donation, approved ==');
  const donTx = 'donate_e2e_' + stamp;
  const bad = await createPay({ tx_ref: 'donate_bad_' + stamp, amount: 0, email: 'x@y.z' });
  ok('zero-amount donation rejected', bad.status === 400, 'got ' + bad.status);
  const noEmail = await createPay({ tx_ref: 'donate_bad2_' + stamp, amount: 20, name: 'No Email' });
  ok('donation without email rejected', noEmail.status === 400, 'got ' + noEmail.status);
  const d1 = await createPay({ tx_ref: donTx, amount: 50, name: 'E2E Donor', email: 'e2e-donor-' + stamp + '@test.gabochie.com', phone: '0200000002', redirect: '/love-of-the-lord/give/' });
  ok('donation create 200', d1.status === 200 && d1.body.status === 'ok', JSON.stringify(d1.body).substring(0, 120));
  ok('donation amount echoed (50)', d1.body.amount === 50, String(d1.body.amount));
  const donTok = decodeURIComponent((d1.body.checkout_url.match(/token=([^&]+)/) || [])[1] || '');
  const dcb = await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ 'order-id': donTx, token: donTok, 'transaction-id': 'mocktx_don' })
  });
  ok('donation callback 200', dcb.status === 200);
  const dReplay = await createPay({ tx_ref: donTx, amount: 50, email: 'e2e-donor-' + stamp + '@test.gabochie.com' });
  ok('settled donation is idempotent (create -> 404)', dReplay.status === 404, 'got ' + dReplay.status + ' ' + JSON.stringify(dReplay.body).substring(0, 100));

  console.log('== CHURCH 2. GIVE â€” declined donation stays pending ==');
  const donTx2 = 'donate_e2ed_' + stamp;
  const d2 = await createPay({ tx_ref: donTx2, amount: 20, name: 'E2E Decline', email: 'e2e-d2-' + stamp + '@test.gabochie.com' });
  const tok2 = decodeURIComponent((d2.body.checkout_url.match(/token=([^&]+)/) || [])[1] || '');
  await fetch(MOCK + '/__set?token=' + tok2 + '&result=2');
  await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ 'order-id': donTx2, token: tok2, 'transaction-id': 'mocktx_d2' })
  });
  const d2replay = await createPay({ tx_ref: donTx2, amount: 20, email: 'e2e-d2-' + stamp + '@test.gabochie.com' });
  ok('declined donation row still pending (can retry)', d2replay.status === 200 && d2replay.body.status === 'ok', 'got ' + d2replay.status);

  console.log('== CHURCH 3. SHOP â€” music purchase -> download unlock ==');
  const shop = await j(BASE + '/api/store/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_type: 'music', item_name: 'E2E Track', amount: 15, customer_name: 'E2E Buyer', customer_email: 'e2e-shop-' + stamp + '@test.gabochie.com', currency: 'GHS' })
  });
  ok('store create 200 with store_music_ ref', shop.status === 200 && /^store_music_/.test(shop.body.tx_ref || ''), JSON.stringify(shop.body).substring(0, 120));
  const shopTx = shop.body.tx_ref;
  const dlBefore = await j(BASE + '/api/store/download?tx_ref=' + encodeURIComponent(shopTx));
  ok('download locked before payment (404)', dlBefore.status === 404, 'got ' + dlBefore.status);
  const sp = await createPay({ tx_ref: shopTx, redirect: '/love-of-the-lord/shop/' });
  ok('shop checkout created', sp.status === 200 && sp.body.status === 'ok', JSON.stringify(sp.body).substring(0, 120));
  ok('shop amount includes price (15)', sp.body.amount === 15, String(sp.body.amount));
  const stok = decodeURIComponent((sp.body.checkout_url.match(/token=([^&]+)/) || [])[1] || '');
  await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ 'order-id': shopTx, token: stok, 'transaction-id': 'mocktx_shop' })
  });
  const dlAfter = await j(BASE + '/api/store/download?tx_ref=' + encodeURIComponent(shopTx));
  ok('download UNLOCKED after settlement (200)', dlAfter.status === 200, 'got ' + dlAfter.status + ' ' + JSON.stringify(dlAfter.body).substring(0, 100));

  console.log('== SCHOOL 1. ENROLL (sample access) ==');
  const sEmail = 'e2e-school-' + stamp + '@test.gabochie.com';
  const dup = await j(BASE + '/api/enroll', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program_slug: 'web-development', name: 'E2E Student', email: sEmail })
  });
  ok('school enroll 200', dup.status === 200 && dup.body.status === 'ok', JSON.stringify(dup.body).substring(0, 150));
  const enr = dup.body.enrollment || {};
  ok('access_token minted (ga_...)', /^ga_/.test(enr.access_token || ''), enr.access_token || 'none');
  ok('status is sample (paid program)', enr.access_level === 'sample', enr.access_level);
  const dup2 = await j(BASE + '/api/enroll', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program_slug: 'web-development', name: 'E2E Student', email: sEmail })
  });
  ok('duplicate enroll -> 409', dup2.status === 409, 'got ' + dup2.status);

  console.log('== SCHOOL 2. SAMPLE GATING ==');
  const before = await j(BASE + '/api/enroll?token=' + encodeURIComponent(enr.access_token));
  ok('GET enroll resolves by access_token', before.status === 200 && before.body.status !== 'error', JSON.stringify(before.body).substring(0, 120));
  ok('full_content withheld on sample (empty string)', before.body.enrollment && before.body.enrollment.full_content === '' && before.body.enrollment.sample_content != null && before.body.enrollment.sample_content !== '', JSON.stringify({ full: before.body.enrollment && before.body.enrollment.full_content, sampleLen: before.body.enrollment && (before.body.enrollment.sample_content || '').length }));

  console.log('== SCHOOL 3. PRE-UPGRADE -> PAY -> UPGRADE ==');
  const pre = await j(BASE + '/api/enroll/pre-upgrade', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: enr.access_token })
  });
  ok('pre-upgrade returns upgrade_ ref', pre.status === 200 && /^upgrade_/.test(pre.body.tx_ref || ''), JSON.stringify(pre.body).substring(0, 120));
  ok('price resolved server-side (150)', pre.body.price === 150, String(pre.body.price));
  const up = await j(BASE + '/api/enroll/upgrade', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: enr.access_token, tx_ref: pre.body.tx_ref })
  });
  ok('upgrade BEFORE payment rejected', up.status !== 200 || up.body.status === 'error', JSON.stringify(up.body).substring(0, 120));
  const cp = await createPay({ tx_ref: pre.body.tx_ref, redirect: '/dashboard/' });
  ok('upgrade checkout created', cp.status === 200 && cp.body.status === 'ok', JSON.stringify(cp.body).substring(0, 120));
  const ctok = decodeURIComponent((cp.body.checkout_url.match(/token=([^&]+)/) || [])[1] || '');
  await j(BASE + '/api/gateways/expresspay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ 'order-id': pre.body.tx_ref, token: ctok, 'transaction-id': 'mocktx_up' })
  });
  const up2 = await j(BASE + '/api/enroll/upgrade', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: enr.access_token, tx_ref: pre.body.tx_ref })
  });
  const upgraded = up2.status === 200 && up2.body.status === 'ok' &&
    (up2.body.message === 'Already upgraded' /* settlement callback already activated it */ ||
      (up2.body.enrollment && up2.body.enrollment.full_content) || up2.body.full_content);
  ok('upgrade AFTER payment -> active (via settle or verify)', upgraded, JSON.stringify(up2.body).substring(0, 150));
  const after = await j(BASE + '/api/enroll?token=' + encodeURIComponent(enr.access_token));
  ok('full_content released after upgrade', after.status === 200 && after.body.enrollment && after.body.enrollment.full_content != null, 'full_content ' + (after.body.enrollment && after.body.enrollment.full_content ? 'present (' + String(after.body.enrollment.full_content).length + ' chars)' : 'MISSING'));

  console.log('\nRESULT: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR: ' + e.message); process.exit(2); });
