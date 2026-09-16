/**
 * Audit nav/footer across all public site pages.
 *
 * The site now renders nav + footer from `nav.js` into the
 * `#nav-placeholder` / `#footer-placeholder` elements, so the old
 * one-off "add Contact link / Contact column" transformations no
 * longer apply. This script keeps every public page consistent:
 *   - has `id="nav-placeholder"` (shared nav)
 *   - has `id="footer-placeholder"` (shared footer)
 *   - loads `nav.js`
 *   - loads the shared `assets/js/main.js`
 *
 * Admin pages (own sidebar shell) and generated coverage output are
 * intentionally excluded.
 *
 * Run: node scripts/update-nav-footer.cjs
 */
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');

// Directory roots to scan for public pages
var scanRoots = [
  '', 'courses', 'dashboard', 'books', 'donate', 'legal',
  'manifesto', 'support', 'press', 'partners', 'content',
  'services', 'membership', 'campaigns', 'nationbuilding',
  'newsletter', 'contact', 'certificate', 'careers', 'art',
  'music', 'merch', 'tutoring', 'survey', 'store', 'style-guide', 'school'
];

// Files that intentionally keep their own template (auth / standalone landing flows)
var skip = ['start/index.html', 'dashboard/reset-code.html'];

function collectHtml() {
  var files = [];
  scanRoots.forEach(function(dir) {
    var base = path.join(root, dir);
    if (!fs.existsSync(base)) return;
    var entries = fs.readdirSync(base, { withFileTypes: true });
    entries
      .filter(function(e) { return e.isFile() && /\.html$/i.test(e.name); })
      .forEach(function(e) { files.push(path.join(dir, e.name)); });
  });
  return files.filter(function(f) { return skip.indexOf(normalize(f)) === -1; });
}

function normalize(p) { return p.split(path.sep).join('/'); }

var total = 0;
var issues = [];

collectHtml().forEach(function(f) {
  var filePath = path.join(root, f);
  var html = fs.readFileSync(filePath, 'utf8');
  var hasNav = html.indexOf('id="nav-placeholder"') !== -1;
  var hasFooter = html.indexOf('id="footer-placeholder"') !== -1;
  var loadsNavJs = /<script[^>]+src=["'][^"']*nav\.js/.test(html);
  var loadsMainJs = /<script[^>]+src=["'][^"']*assets\/js\/main\.js/.test(html);

  var missing = [];
  if (!hasNav) missing.push('nav-placeholder');
  if (!hasFooter) missing.push('footer-placeholder');
  if (!loadsNavJs) missing.push('nav.js');
  if (!loadsMainJs) missing.push('main.js');

  if (missing.length) {
    issues.push(f + ': missing ' + missing.join(', '));
    console.log('ISSUE: ' + f + ' -> missing ' + missing.join(', '));
  } else {
    console.log('OK: ' + f);
  }
  total++;
});

console.log('\nScanned ' + total + ' public pages.');
if (issues.length) {
  console.log(issues.length + ' page(s) out of sync.');
  process.exit(1);
} else {
  console.log('All public pages use the shared nav/footer. In sync.');
}