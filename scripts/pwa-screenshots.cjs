// Generates PWA install screenshots by screenshotting the local static build.
// Usage: npx serve . -l 4173 & node scripts/pwa-screenshots.cjs [baseUrl]
const { chromium } = require('playwright');

(async () => {
  const base = process.argv[2] || 'http://localhost:4173';
  const browser = await chromium.launch();
  const shots = [
    { name: 'home-mobile.png', width: 390, height: 844, path: '/' },
    { name: 'home-wide.png', width: 1280, height: 720, path: '/' },
  ];
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    await page.goto(base + s.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'assets/screenshots/' + s.name });
    console.log('saved assets/screenshots/' + s.name);
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
