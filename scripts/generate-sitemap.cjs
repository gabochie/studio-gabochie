/**
 * Auto-generate sitemap.xml by scanning all public HTML files.
 * Run: node scripts/generate-sitemap.cjs
 * Also validates that all sitemap URLs return 200 against the live site.
 */
var fs = require('fs');
var path = require('path');
// var glob = require('child_process').execSync;
var https = require('https');
var http = require('http');

var ROOT = path.resolve(__dirname, '..');
var SITEMAP = path.join(ROOT, 'sitemap.xml');
var SITE_URL = 'https://gideonabochie.org';
var NEWS_SITE_URL = 'https://news.gideonabochie.org';
var VALIDATE = process.argv.includes('--validate');

// Patterns to exclude from sitemap
var EXCLUDE_DIRS = ['admin', 'dashboard', 'node_modules', 'workers', 'test-results', '.git', 'news'];
var EXCLUDE_FILES = ['404.html', 'coming-soon.html'];

// Manual URL overrides for files that get clean URLs via _redirects
var URL_OVERRIDES = {
  'books/premium-bundle.html': '/books/premium-bundle',
  'donate.html': '/donate'
};

// Priority by URL pattern
function getPriority(url) {
  if (url === '/') return 1.0;
  if (url.startsWith('/legal/')) return 0.3;
  if (url.startsWith('/school/guitar/')) return 0.5;
  if (url.startsWith('/school/')) return 0.8;
  if (url.startsWith('/books/')) return 0.7;
  return 0.6;
}

// Changefreq by URL pattern
function getChangefreq(url) {
  if (url === '/') return 'weekly';
  if (url.startsWith('/legal/')) return 'yearly';
  return 'monthly';
}

function isExcluded(filePath) {
  var parts = filePath.replace(/\\/g, '/').split('/');
  // Only exclude directories at root level, not nested (e.g., root dashboard/ but not school/guitar/dashboard/)
  if (EXCLUDE_DIRS.indexOf(parts[0]) !== -1) return true;
  if (EXCLUDE_FILES.indexOf(parts[parts.length - 1]) !== -1) return true;
  // Skip legacy guitar/ URLs (301 redirect to /school/guitar/)
  if (filePath.indexOf('guitar/') !== -1 &&
      filePath.indexOf('school/') === -1) return true;
  // Skip certificate (auth-gated), books/download, store/download and store/library
  if (filePath.indexOf('certificate/') !== -1) return true;
  if (filePath.indexOf('books/download/') !== -1) return true;
  if (filePath.indexOf('store/') !== -1) return true;
  // Skip survey (internal tool)
  if (filePath.indexOf('survey/') !== -1) return true;
  return false;
}

function fileToUrl(relPath) {
  // Check for manual override
  if (URL_OVERRIDES[relPath]) return URL_OVERRIDES[relPath];

  var basename = path.basename(relPath);
  var dir = path.dirname(relPath);

  if (basename === 'index.html') {
    // foo/index.html → /foo/
    return '/' + (dir === '.' ? '' : dir.replace(/\\/g, '/') + '/');
  } else {
    // foo/bar.html → /foo/bar
    var name = basename.replace(/\.html$/, '');
    return '/' + (dir === '.' ? name : dir.replace(/\\/g, '/') + '/' + name);
  }
}

function getAllHtmlFiles() {
  var files = [];
  function walk(dir, depth) {
    if (depth === undefined) depth = 0;
    var entries;
    try { entries = fs.readdirSync(dir); } catch { /* directory unreadable */ }
    for (var i = 0; i < entries.length; i++) {
      var full = path.join(dir, entries[i]);
      var stat = fs.statSync(full);
      if (stat.isDirectory()) {
        // Skip node_modules and .git at any depth; skip other excluded dirs only at root
        if (entries[i] === 'node_modules' || entries[i] === '.git') continue;
        if (depth === 0 && EXCLUDE_DIRS.indexOf(entries[i]) !== -1) continue;
        walk(full, depth + 1);
      } else if (entries[i].endsWith('.html')) {
        files.push(full);
      }
    }
  }
  walk(ROOT);
  return files;
}

function generateSitemap() {
  var files = getAllHtmlFiles();
  var urls = [];

  files.forEach(function(fullPath) {
    var relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    if (isExcluded(relPath)) return;

    var url = fileToUrl(relPath);
    if (!url || url === '/' || url === '') return; // root handled separately
    urls.push(url);
  });

  // Deduplicate: if both /foo and /foo/ exist, keep /foo/
  var deduped = {};
  urls.forEach(function(u) {
    var key = u.replace(/\/$/, '');
    if (deduped[key] && u.endsWith('/')) deduped[key] = u;
    else if (!deduped[key]) deduped[key] = u;
  });
  urls = Object.keys(deduped).map(function(k) { return deduped[k]; });

  urls.sort();

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Root first
  xml += '  <url><loc>' + SITE_URL + '/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>\n';

  urls.forEach(function(url) {
    xml += '  <url><loc>' + SITE_URL + url + '</loc><priority>' + getPriority(url) + '</priority><changefreq>' + getChangefreq(url) + '</changefreq></url>\n';
  });

  xml += '</urlset>\n';
  fs.writeFileSync(SITEMAP, xml, 'utf8');
  console.log('Generated sitemap.xml with ' + (urls.length + 1) + ' URLs');

  // Generate news subdomain sitemap
  var newsDir = path.join(ROOT, 'news');
  if (fs.existsSync(newsDir)) {
    var newsXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    newsXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    newsXml += '  <url><loc>' + NEWS_SITE_URL + '/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>\n';
    newsXml += '</urlset>\n';
    fs.writeFileSync(path.join(ROOT, 'news', 'sitemap.xml'), newsXml, 'utf8');
    console.log('Generated news/sitemap.xml with 1 URL');
  }

  return urls;
}

function validateUrl(url) {
  return new Promise(function(resolve) {
    var fullUrl = SITE_URL + url;
    var parsed = new URL(fullUrl);
    var client = parsed.protocol === 'https:' ? https : http;
    var req = client.get(fullUrl, { timeout: 10000, headers: { 'User-Agent': 'GASitemapValidator/1.0' } }, function(res) {
      var valid = res.statusCode >= 200 && res.statusCode < 400;
      if (!valid) console.log('  FAIL: ' + fullUrl + ' (' + res.statusCode + ')');
      resolve(valid);
      res.resume();
    });
    req.on('error', function() {
      console.log('  FAIL: ' + fullUrl + ' (connection error)');
      resolve(false);
    });
    req.on('timeout', function() {
      console.log('  FAIL: ' + fullUrl + ' (timeout)');
      req.destroy();
      resolve(false);
    });
  });
}

async function validate(urls) {
  console.log('\nValidating sitemap URLs against ' + SITE_URL + '...');
  var allUrls = ['/'].concat(urls);
  var passed = 0, failed = 0;

  for (var i = 0; i < allUrls.length; i++) {
    var ok = await validateUrl(allUrls[i]);
    if (ok) passed++; else failed++;
    if (i % 10 === 9) process.stdout.write('  Progress: ' + (i + 1) + '/' + allUrls.length + '\n');
  }

  console.log('\nValidation complete: ' + passed + ' passed, ' + failed + ' failed');
  return failed === 0;
}

async function main() {
  var urls = generateSitemap();

  if (VALIDATE) {
    var ok = await validate(urls);
    if (!ok) {
      console.log('\nWARNING: Some sitemap URLs returned non-200 responses.');
      console.log('Review and fix before deploying.');
      process.exit(1);
    }
  }
}

main().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
