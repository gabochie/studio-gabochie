/**
 * Batch update: add Contact link to nav and Contact column to footer
 * across all site pages. Run: node scripts/update-nav-footer.js
 */
var fs = require('fs');
var path = require('path');

// All pages with the main footer (footer-sponsors present)
var footerFiles = [
  'index.html',
  'dashboard/index.html',
  'nationbuilding/index.html',
  'books/premium-bundle.html',
  'books/index.html',
  'books/download/index.html',
  'donate/index.html',
  'donate.html',
  'legal/refund.html',
  'legal/disclaimer.html',
  'legal/donations.html',
  'legal/terms.html',
  'legal/privacy.html',
  'school/index.html',
  'manifesto/index.html',
  'support/index.html',
  'newsletter/advertise.html',
  'newsletter/index.html',
  'press/index.html',
  'partners/index.html',
  'content/index.html'
];

// Also update nav on these pages (have nav-donate but not the main footer)
var navOnlyFiles = [
  'store/download.html',
  'store/library.html',
  '404.html'
];

var root = 'C:\\Users\\user\\Documents\\GitHub\\gideonabochie-org\\gideonabochie-org';

function readFile(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(path.join(root, p), content, 'utf8');
}

function updateNav(html) {
  // Add /contact/ link before the nav-donate link
  // Matches: any a tag with class="nav-donate"
  // We insert <a href="/contact/">Contact</a> right before it
  var replaced = false;
  html = html.replace(
    /(\s+)(<a [^>]*class="nav-donate"[^>]*>.*?<\/a>)/,
    function(match, before, donateLink) {
      replaced = true;
      // Only add if /contact/ isn't already there
      if (html.indexOf('/contact/') !== -1) return match;
      return before + '<a href="/contact/">Contact</a>' + before + donateLink;
    }
  );
  if (!replaced) {
    console.log('  WARN: Could not find nav-donate in nav');
  }
  return html;
}

function updateFooter(html) {
  // 1. Update grid-cols from 2fr 1fr 1fr 1fr 1fr to 2fr 1fr 1fr 1fr 1fr 1fr
  var gridRegex = /(footer .container\{display:grid;grid-template-columns:)2fr 1fr 1fr 1fr 1fr/g;
  html = html.replace(gridRegex, '$12fr 1fr 1fr 1fr 1fr 1fr');

  // 2. Add Contact column before the Legal column
  // Pattern: <div>\n      <h4>Legal</h4>
  // Insert Contact column before it
  var legalPattern = /(\s+)(<div>\n\s+<h4>Legal<\/h4>)/;
  var contactCol =
    '    <div>\n' +
    '      <h4>Contact</h4>\n' +
    '      <a href="mailto:info@gideonabochie.com">info@gideonabochie.com</a>\n' +
    '      <a href="tel:+233243262019">+233 243 262 019</a>\n' +
    '    </div>';

  if (html.indexOf('Contact</h4>') !== -1) {
    // Already has contact column, skip
    return html;
  }

  html = html.replace(legalPattern, function(match, before, legalDiv) {
    return before + contactCol + before + legalDiv;
  });

  return html;
}

var total = 0;
var allFiles = footerFiles.concat(navOnlyFiles);

allFiles.forEach(function(f) {
  var filePath = path.join(root, f);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found): ' + f);
    return;
  }

  var html = readFile(f);
  var orig = html;

  html = updateNav(html);
  // Only update footer on files that have footer-sponsors
  if (footerFiles.indexOf(f) !== -1) {
    html = updateFooter(html);
  }

  if (html !== orig) {
    writeFile(f, html);
    console.log('UPDATED: ' + f);
    total++;
  } else {
    console.log('NO CHANGE: ' + f);
  }
});

console.log('\nDone. ' + total + ' files updated.');
