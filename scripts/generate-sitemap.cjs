const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://studio.gabochie.com';
const today = new Date().toISOString().slice(0, 10);

const PAGES = [
  ['/', 1.0, 'weekly'],
  ['/school/', 0.9, 'monthly'],
  ['/guitar/', 0.9, 'weekly'],
  ['/books/', 0.8, 'monthly'],
  ['/membership/', 0.8, 'monthly'],
  ['/support/', 0.8, 'monthly'],
  ['/donate/', 0.8, 'monthly'],
  ['/merch/', 0.7, 'monthly'],
  ['/music/', 0.7, 'monthly'],
  ['/art/', 0.7, 'monthly'],
  ['/news/', 0.7, 'weekly'],
  ['/content/', 0.7, 'monthly'],
  ['/services/', 0.7, 'monthly'],
  ['/campaigns/', 0.6, 'monthly'],
  ['/campaigns/1-million-systems-thinkers', 0.6, 'monthly'],
  ['/careers/', 0.6, 'monthly'],
  ['/tutoring/', 0.6, 'monthly'],
  ['/nationbuilding/', 0.6, 'monthly'],
  ['/partners/', 0.6, 'monthly'],
  ['/press/', 0.6, 'monthly'],
  ['/manifesto/', 0.6, 'monthly'],
  ['/survey/', 0.5, 'monthly'],
  ['/contact/', 0.5, 'monthly'],
  ['/certificate/', 0.5, 'monthly'],
  ['/login/', 0.5, 'monthly'],
  ['/register/', 0.5, 'monthly'],
  ['/member/', 0.5, 'monthly'],
  ['/store/', 0.5, 'monthly'],
  ['/unsubscribe/', 0.3, 'monthly'],
  ['/legal/disclaimer', 0.2, 'yearly'],
  ['/legal/donations', 0.2, 'yearly'],
  ['/legal/privacy', 0.2, 'yearly'],
  ['/legal/refund', 0.2, 'yearly'],
  ['/legal/terms', 0.2, 'yearly'],
  ['/style-guide/', 0.2, 'monthly']
];

const VALID_PREFIX = new Set([
  'art', 'books', 'campaigns', 'careers', 'certificate', 'contact', 'content',
  'donate', 'guitar', 'legal', 'login', 'manifesto', 'member', 'membership',
  'merch', 'music', 'nationbuilding', 'news', 'partners', 'press', 'register',
  'school', 'services', 'store', 'style-guide', 'support', 'survey', 'tutoring', 'unsubscribe'
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