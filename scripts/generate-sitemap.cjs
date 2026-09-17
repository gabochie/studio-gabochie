const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://studio.gabochie.com';
const today = new Date().toISOString().slice(0, 10);

const PAGES = [
  ['/', 1.0, 'weekly'],
  ['/courses/', 0.9, 'weekly'],
  ['/courses/systems-thinking/', 0.9, 'weekly'],
  ['/guitar/', 0.9, 'weekly'],
  ['/courses/web-development/', 0.9, 'weekly'],
  ['/courses/digital-marketing/', 0.9, 'weekly'],
  ['/courses/civic-intelligence/', 0.9, 'weekly'],
  ['/courses/freelancing-ai/', 0.8, 'weekly'],
  ['/courses/ai-fundamentals/', 0.8, 'weekly'],
  ['/courses/essential-values/', 0.8, 'weekly'],
  ['/courses/digital-entrepreneurship/', 0.8, 'weekly'],
  ['/courses/youth-leadership/', 0.8, 'weekly'],
  ['/courses/sketching-vision-builders/', 0.8, 'weekly'],
  ['/courses/systems-thinking-genesis/', 0.8, 'weekly'],
  ['/start/', 0.8, 'monthly'],
  ['/dashboard/', 0.6, 'monthly'],
  ['/certificate/', 0.5, 'monthly'],
  ['/login/', 0.5, 'monthly'],
  ['/register/', 0.5, 'monthly'],
  ['/unsubscribe/', 0.3, 'monthly'],
  ['/legal/disclaimer', 0.2, 'yearly'],
  ['/legal/donations', 0.2, 'yearly'],
  ['/legal/privacy', 0.2, 'yearly'],
  ['/legal/refund', 0.2, 'yearly'],
  ['/legal/terms', 0.2, 'yearly']
];

const VALID_PREFIX = new Set([
  'certificate', 'courses', 'dashboard', 'guitar', 'legal', 'login',
  'register', 'start', 'unsubscribe'
]);

function buildXml() {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const [loc, priority, changefreq] of PAGES) {
    lines.push(`  <url><loc>${DOMAIN}${loc}</loc><lastmod>${today}</lastmod><priority>${priority.toFixed(1)}</priority><changefreq>${changefreq}</changefreq></url>`);
  }
  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

function validate() {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>(https:\/\/studio\.gabochie\.com[^<]+)<\/loc>/g)].map(m => m[1]);
  const errors = [];
  for (const u of urls) {
    const p = u.replace(DOMAIN, '');
    let prefix = p.replace(/^\//, '').split('/')[0] || 'root';
    if (p === '/' || p === '/donate') continue;
    if (!VALID_PREFIX.has(prefix)) errors.push(`Unknown page prefix: ${u}`);
  }
  if (errors.length) {
    console.error('sitemap.xml validation FAILED:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log(`sitemap.xml validation OK — ${urls.length} URLs`);
}

if (process.argv.includes('--validate')) {
  validate();
} else {
  fs.mkdirSync(path.join(__dirname, '..'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), buildXml());
  console.log(`sitemap.xml regenerated — ${PAGES.length} URLs (lastmod ${today})`);
}