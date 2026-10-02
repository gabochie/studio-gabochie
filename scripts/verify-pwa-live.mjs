/**
 * Live PWA verification against production, for desktop + mobile form factors.
 * Run: node scripts/verify-pwa-live.mjs
 * Requires: playwright (already a dependency)
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'https://studio.gabochie.com';
const results = [];
let failures = 0;

function check(name, pass, detail) {
  results.push({ name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function verify(label, contextOptions) {
  console.log(`\n===== ${label} =====`);
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);

  // Surface SW/CSP failures that would otherwise be silent
  const swErrors = [];
  context.on('weberror', (e) => swErrors.push(e.error().message));

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 1. manifest linked + parses
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href').catch(() => null);
  check(`${label}: manifest link present`, !!manifestHref, manifestHref || 'missing');

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    const res = await fetch(link.href);
    return { ok: res.ok, type: res.headers.get('content-type'), body: await res.json() };
  });
  check(`${label}: manifest fetches OK`, !!manifest?.ok, manifest?.type || 'n/a');
  check(
    `${label}: manifest has name/short_name/start_url/display`,
    !!manifest?.body?.name && !!manifest?.body?.short_name && !!manifest?.body?.start_url && !!manifest?.body?.display,
    manifest?.body ? `display=${manifest.body.display}` : 'n/a'
  );
  const has192 = manifest?.body?.icons?.some((i) => i.sizes === '192x192');
  const has512 = manifest?.body?.icons?.some((i) => i.sizes === '512x512');
  check(`${label}: manifest has 192 + 512 icons`, has192 && has512);
  const maskable = manifest?.body?.icons?.some((i) => (i.purpose || '').includes('maskable'));
  check(`${label}: manifest has maskable icon`, maskable);

  // 2. icons actually resolve
  for (const icon of manifest?.body?.icons || []) {
    const status = await page.evaluate(async (src) => {
      const r = await fetch(src);
      return r.status;
    }, icon.src);
    check(`${label}: icon ${icon.src}`, status === 200, `HTTP ${status}`);
  }

  // 3. service worker registers
  const reg = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const r = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return {
      supported: true,
      scope: r.scope,
      active: !!r.active,
      state: r.active?.state || null,
    };
  });
  check(`${label}: service worker registers`, reg.supported && reg.active, reg.state || 'not active');
  check(`${label}: scope is root`, reg.scope?.endsWith('/'), reg.scope || 'n/a');

  // 4. worker controls the page after reload
  await page.reload({ waitUntil: 'networkidle' });
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check(`${label}: SW controls page after reload`, controlled);

  // 5. cache populated
  const cacheInfo = await page.evaluate(async () => {
    const names = await caches.keys();
    let total = 0;
    for (const n of names) {
      const c = await caches.open(n);
      total += (await c.keys()).length;
    }
    return { names, total };
  });
  check(`${label}: caches populated`, cacheInfo.total > 0, `${cacheInfo.total} entries in ${cacheInfo.names.join(', ')}`);

  // 6. mobile meta tags
  if (contextOptions.isMobile) {
    const apple = await page.evaluate(() => ({
      touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href || null,
      capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
      statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content || null,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
      viewport: document.querySelector('meta[name="viewport"]')?.content || null,
    }));
    check(`${label}: apple-touch-icon`, !!apple.touchIcon, apple.touchIcon || 'missing');
    check(`${label}: apple-mobile-web-app-capable`, apple.capable);
    check(`${label}: status-bar-style`, !!apple.statusBar, apple.statusBar || 'missing');
    check(`${label}: theme-color`, !!apple.themeColor, apple.themeColor || 'missing');
    check(`${label}: viewport set`, /width=device-width/.test(apple.viewport || ''), apple.viewport || 'missing');
  }

  // 7. OFFLINE: the real test
  await context.setOffline(true);
  let offlineRendered = false;
  let offlineDetail = '';
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const text = await page.evaluate(() => document.body.innerText.length);
    offlineRendered = text > 200;
    offlineDetail = `body text ${text} chars`;
  } catch (e) {
    offlineDetail = e.message.slice(0, 80);
  }
  check(`${label}: offline reload renders`, offlineRendered, offlineDetail);
  await context.setOffline(false);

  // 8. no SW/CSP console errors
  const swNoise = consoleErrors.filter(
    (e) => /service ?worker|sw\.js|Content Security Policy/i.test(e)
  );
  check(`${label}: no SW/CSP console errors`, swNoise.length === 0, swNoise.slice(0, 2).join(' | ') || 'clean');
  check(`${label}: no uncaught page errors`, swErrors.length === 0, swErrors.slice(0, 1).join(' | ') || 'clean');

  await browser.close();
}

await verify('DESKTOP', { viewport: { width: 1280, height: 720 } });
await verify('MOBILE', { ...devices['iPhone 13'] });

console.log(`\n===== SUMMARY =====`);
console.log(`checks: ${results.length}, failures: ${failures}`);
process.exit(failures > 0 ? 1 : 0);