/**
 * Instagram Lead Scraper
 * Uses Playwright to scrape Instagram profiles by location, hashtag, or follower lists.
 *
 * Usage:
 *   1. Install: npm install playwright && npx playwright install chromium
 *   2. Copy config: copy config from CONFIG_DEFAULTS below to scrape-config.json
 *   3. Run: node scripts/scrape-instagram.js
 *
 * Output: JSON file(s) in the output directory, ready for import via admin API.
 *
 * Environment variables:
 *   IG_USERNAME / IG_PASSWORD - Instagram login credentials (optional, for higher limits)
 *   ADMIN_API_URL - If set, auto-imports to admin API (e.g. https://site.com/admin/api/instagram-leads)
 *   ADMIN_API_KEY - X-Admin-Key header value
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));

var CONFIG_DEFAULTS = {
  output_dir: resolve(process.cwd(), 'instagram-leads-output'),
  headless: true,
  max_leads_per_source: 200,
  min_followers: 50,

  // Instagram login (optional — many public data is visible without login)
  username: process.env.IG_USERNAME || '',
  password: process.env.IG_PASSWORD || '',

  // Scrape sources — toggle which you want active
  sources: {
    locations: {
      active: true,
      items: ['accra', 'kumasi', 'takoradi', 'tema']
    },
    hashtags: {
      active: true,
      items: ['GhanaYouth', 'AccraEntrepreneur', 'GhanaTech', 'GhanaStudents', 'AccraCreatives', 'GhanaBusiness']
    },
    followers: {
      active: false,
      accounts: [] // e.g. ['ghanayouth', 'ghanatechhub']
    }
  },

  // Admin API auto-import (optional)
  admin_api: {
    url: process.env.ADMIN_API_URL || '',
    key: process.env.ADMIN_API_KEY || ''
  }
};

var CONFIG_PATH = join(__dirname, '..', 'scrape-config.json');

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      var user = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      return Object.assign({}, CONFIG_DEFAULTS, user);
    } catch (e) {
      console.error('Warning: Could not parse scrape-config.json, using defaults:', e.message);
    }
  } else {
    // Write default config
    writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG_DEFAULTS, null, 2));
    console.log('Created default config at ' + CONFIG_PATH);
    console.log('Edit it to customize your scrape targets, then re-run.');
  }
  return CONFIG_DEFAULTS;
}

// ── Helpers ──

function emailFromBio(bio) {
  if (!bio) return '';
  var match = bio.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
  return match ? match[0] : '';
}

function phoneFromBio(bio) {
  if (!bio) return '';
  // Match Ghana phone numbers: +233XXXXXXXXX, 0XXXXXXXXX
  var match = bio.match(/(\+233\d{9}|\b0\d{9})\b/);
  return match ? match[0] : '';
}

function extractLocation(bio) {
  if (!bio) return '';
  var ghCities = ['accra', 'kumasi', 'takoradi', 'tema', 'cape coast', 'sunjani', 'tamale', 'ho', 'koforidua', 'wa', 'bolgatanga', 'sekondi'];
  var lower = bio.toLowerCase();
  for (var city of ghCities) {
    if (lower.includes(city)) return city.charAt(0).toUpperCase() + city.slice(1);
  }
  return '';
}

function delay(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

// ── Scraper ──

async function scrapeInstagram(config) {
  var results = [];
  var seen = new Set();

  console.log('Launching browser...');
  var browser = await chromium.launch({ headless: config.headless });
  var context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  var page = await context.newPage();

  // Login if credentials provided
  if (config.username && config.password) {
    console.log('Logging in as ' + config.username + '...');
    try {
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 30000 });
      await delay(3000);
      await page.fill('input[name="username"]', config.username);
      await page.fill('input[name="password"]', config.password);
      await page.click('button[type="submit"]');
      await delay(5000);

      // Handle "Save Info" dialog
      try {
        var saveBtn = await page.$('button:has-text("Not Now")');
        if (saveBtn) await saveBtn.click();
        await delay(2000);
      } catch (e) { /* ignore */ }

      console.log('Login complete.');
    } catch (e) {
      console.error('Login failed (continuing without login):', e.message);
    }
  } else {
    console.log('No login credentials — proceeding without login. Some data may be limited.');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(function() {});
    await delay(2000);
  }

  // ── Scrape by location ──
  if (config.sources.locations.active) {
    for (var loc of config.sources.locations.items) {
      console.log('Scraping location: ' + loc);
      try {
        var locResults = await scrapeLocation(page, loc, config.max_leads_per_source);
        for (var r of locResults) {
          if (!seen.has(r.instagram_username)) {
            r.scrape_source = 'location:' + loc;
            r.region = extractLocation(r.bio) || (loc.charAt(0).toUpperCase() + loc.slice(1));
            seen.add(r.instagram_username);
            results.push(r);
          }
        }
        console.log('  Found ' + locResults.length + ' leads from location ' + loc);
      } catch (e) {
        console.error('  Error scraping location ' + loc + ':', e.message);
      }
      await delay(3000 + Math.random() * 2000);
    }
  }

  // ── Scrape by hashtag ──
  if (config.sources.hashtags.active) {
    for (var tag of config.sources.hashtags.items) {
      console.log('Scraping hashtag: #' + tag);
      try {
        var tagResults = await scrapeHashtag(page, tag, config.max_leads_per_source);
        for (var r of tagResults) {
          if (!seen.has(r.instagram_username)) {
            r.scrape_source = 'hashtag:' + tag;
            if (!r.region) r.region = extractLocation(r.bio);
            seen.add(r.instagram_username);
            results.push(r);
          }
        }
        console.log('  Found ' + tagResults.length + ' leads from #' + tag);
      } catch (e) {
        console.error('  Error scraping hashtag #' + tag + ':', e.message);
      }
      await delay(3000 + Math.random() * 2000);
    }
  }

  // ── Scrape follower lists ──
  if (config.sources.followers.active && config.sources.followers.accounts.length) {
    for (var account of config.sources.followers.accounts) {
      console.log('Scraping followers of: ' + account);
      try {
        var folResults = await scrapeFollowers(page, account, config.max_leads_per_source);
        for (var r of folResults) {
          if (!seen.has(r.instagram_username)) {
            r.scrape_source = 'followers:' + account;
            if (!r.region) r.region = extractLocation(r.bio);
            seen.add(r.instagram_username);
            results.push(r);
          }
        }
        console.log('  Found ' + folResults.length + ' leads from followers of ' + account);
      } catch (e) {
        console.error('  Error scraping followers of ' + account + ':', e.message);
      }
      await delay(3000 + Math.random() * 2000);
    }
  }

  await browser.close();

  // Filter by min followers
  if (config.min_followers > 0) {
    var before = results.length;
    results = results.filter(function(r) { return r.follower_count >= config.min_followers; });
    console.log('Filtered from ' + before + ' to ' + results.length + ' (min ' + config.min_followers + ' followers)');
  }

  console.log('\n=== Total unique leads: ' + results.length + ' ===');

  // Save output
  ensureDir(config.output_dir);
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  var outputPath = join(config.output_dir, 'instagram-leads-' + timestamp + '.json');
  writeFileSync(outputPath, JSON.stringify({ leads: results, scraped_at: timestamp, total: results.length }, null, 2));
  console.log('Saved to ' + outputPath);

  // Auto-import to admin API if configured
  if (config.admin_api.url && config.admin_api.key) {
    console.log('Importing ' + results.length + ' leads to admin API...');
    try {
      var apiRes = await fetch(config.admin_api.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': config.admin_api.key },
        body: JSON.stringify({ leads: results, source: 'scraper:' + timestamp })
      });
      var apiData = await apiRes.json();
      console.log('API import: ' + (apiData.status || apiData.imported + ' imported, ' + apiData.errors + ' errors'));
    } catch (e) {
      console.error('API import error:', e.message);
    }
  }

  return results;
}

// ── Location scraper ──

async function scrapeLocation(page, locationName, maxLeads) {
  var leads = [];
  try {
    // Instagram location pages use a location ID — search for it first
    await page.goto('https://www.instagram.com/explore/locations/?q=' + encodeURIComponent(locationName), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(3000);

    // Click first location result
    var locLink = await page.$('a[href*="/explore/locations/"]');
    if (!locLink) {
      // Fallback: just search the tag
      return await scrapeHashtag(page, locationName, maxLeads);
    }

    await locLink.click();
    await delay(3000);
    await page.waitForSelector('article a[href*="/p/"]', { timeout: 10000 }).catch(function() {});

    // Get post links, then extract profiles
    var profileSet = new Set();
    var postLinks = await page.$$('article a[href*="/p/"]');
    for (var i = 0; i < Math.min(postLinks.length, 30); i++) {
      try {
        var href = await postLinks[i].getAttribute('href');
        if (!href) continue;
        var fullUrl = 'https://www.instagram.com' + href;
        var profileData = await scrapePostProfile(page, fullUrl);
        if (profileData && profileData.instagram_username && !profileSet.has(profileData.instagram_username)) {
          profileSet.add(profileData.instagram_username);
          leads.push(profileData);
        }
      } catch (e) { /* skip */ }
      if (leads.length >= maxLeads) break;
      await delay(2000 + Math.random() * 1500);
    }
  } catch (e) {
    console.error('  Location scrape error:', e.message.substring(0, 100));
  }
  return leads;
}

// ── Hashtag scraper ──

async function scrapeHashtag(page, tag, maxLeads) {
  var leads = [];
  try {
    await page.goto('https://www.instagram.com/explore/tags/' + encodeURIComponent(tag) + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(3000);

    // Scroll to load more posts
    for (var s = 0; s < 3; s++) {
      await page.evaluate(function() { window.scrollBy(0, 800); });
      await delay(2000);
    }

    // Get post links and extract profiles
    var profileSet = new Set();
    var postLinks = await page.$$('article a[href*="/p/"]');
    for (var i = 0; i < Math.min(postLinks.length, 40); i++) {
      try {
        var href = await postLinks[i].getAttribute('href');
        if (!href) continue;
        var fullUrl = 'https://www.instagram.com' + href;
        var profileData = await scrapePostProfile(page, fullUrl);
        if (profileData && profileData.instagram_username && !profileSet.has(profileData.instagram_username)) {
          profileSet.add(profileData.instagram_username);
          leads.push(profileData);
          if (leads.length % 10 === 0) process.stdout.write('.');
        }
      } catch (e) { /* skip */ }
      if (leads.length >= maxLeads) break;
      await delay(1500 + Math.random() * 1500);
    }
  } catch (e) {
    console.error('  Hashtag scrape error:', e.message.substring(0, 100));
  }
  return leads;
}

// ── Post profile scraper ──

async function scrapePostProfile(page, postUrl) {
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(2000);

    // Get the username from the post header
    var usernameEl = await page.$('header a[href*="/"]');
    if (!usernameEl) return null;
    var href = await usernameEl.getAttribute('href');
    if (!href) return null;
    var username = href.replace(/^\//, '').replace(/\/$/, '');
    if (!username || username.includes('p/') || username.includes('explore')) return null;

    // Go to profile page for more details
    return await scrapeProfile(page, username);
  } catch (e) {
    return null;
  }
}

// ── Profile scraper ──

async function scrapeProfile(page, username) {
  try {
    await page.goto('https://www.instagram.com/' + encodeURIComponent(username) + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(2000);

    // Extract profile data from page meta / JSON-LD or visible text
    var data = {
      instagram_username: username,
      name: '',
      bio: '',
      follower_count: 0,
      following_count: 0,
      profile_url: 'https://www.instagram.com/' + username + '/',
      is_verified: false,
      email: '',
      phone: '',
      region: ''
    };

    // Try to get structured data from __NEXT_DATA__ or __INITIAL_STATE__
    try {
      var jsonData = await page.evaluate(function() {
        var el = document.getElementById('__NEXT_DATA__');
        if (el) return JSON.parse(el.textContent);
        // Fallback: try window.__INITIAL_STATE__
        if (window.__INITIAL_STATE__) return window.__INITIAL_STATE__;
        return null;
      });

      if (jsonData) {
        var user = jsonData?.props?.pageProps?.user || jsonData?.entry_data?.ProfilePage?.[0]?.graphql?.user || {};
        if (user.full_name) data.name = user.full_name;
        if (user.biography) data.bio = user.biography;
        if (user.edge_followed_by?.count !== undefined) data.follower_count = user.edge_followed_by.count;
        if (user.edge_follow?.count !== undefined) data.following_count = user.edge_follow.count;
        if (user.is_verified !== undefined) data.is_verified = user.is_verified;
        if (user.external_url) data.website = user.external_url;
      }
    } catch (e) { /* structured data not available */ }

    // Fallback: parse from visible page elements
    if (!data.name || !data.bio) {
      try {
        var metaContent = await page.evaluate(function() {
          var meta = document.querySelector('meta[property="og:description"]');
          return meta ? meta.getAttribute('content') : '';
        });
        if (metaContent) {
          // Instagram format: "N followers, M following, X posts - See Instagram photos and videos from NAME"
          var parts = metaContent.split(' - ');
          var statsPart = parts[0] || '';
          var namePart = parts[1] || '';
          data.name = namePart.replace('See Instagram photos and videos from ', '').trim();
        }
      } catch (e) { /* fallback failed */ }
    }

    // Try reading visible bio element
    if (!data.bio) {
      try {
        var bioText = await page.$eval('span[dir="auto"]', function(el) { return el.textContent; }).catch(function() { return ''; });
        if (bioText && bioText.length < 500) data.bio = bioText;
      } catch (e) { /* no bio element */ }
    }

    // Also try reading the full name from h2/span on profile
    if (!data.name) {
      try {
        data.name = await page.$eval('section h2', function(el) { return el.textContent; }).catch(function() { return ''; });
      } catch (e) { /* no h2 */ }
    }

    // Fallback follower count from visible text
    if (!data.follower_count) {
      try {
        var pageText = await page.evaluate(function() { return document.body.innerText; });
        var flwMatch = pageText.match(/([\d,.]+)\s*followers?/i);
        if (flwMatch) data.follower_count = parseInt(flwMatch[1].replace(/,/g, '')) || 0;
      } catch (e) { /* */ }
    }

    // Parse email and phone from bio
    data.email = emailFromBio(data.bio);
    data.phone = phoneFromBio(data.bio);
    if (!data.region) data.region = extractLocation(data.bio);

    return data;
  } catch (e) {
    return null;
  }
}

// ── Follower scraper (requires login) ──

async function scrapeFollowers(page, account, maxLeads) {
  var leads = [];
  try {
    await page.goto('https://www.instagram.com/' + encodeURIComponent(account) + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(3000);

    // Click followers button
    var flwBtn = await page.$('a[href$="/followers/"]');
    if (!flwBtn) {
      console.error('  Could not find followers button for ' + account);
      return [];
    }
    await flwBtn.click();
    await delay(2000);

    // Wait for the followers dialog
    var dialog = await page.$('div[role="dialog"]');
    if (!dialog) {
      console.error('  Could not open followers dialog for ' + account);
      return [];
    }

    // Scroll the follower list
    var list = await dialog.$('div[style*="overflow: hidden"]');
    if (!list) list = dialog;

    var profileSet = new Set();
    for (var s = 0; s < 5; s++) {
      var items = await dialog.$$('a[href*="/"]:not([href*="/p/"]):not([href*="/explore/"])');
      for (var i = 0; i < items.length; i++) {
        try {
          var href = await items[i].getAttribute('href');
          if (!href) continue;
          var username = href.replace(/^\//, '').replace(/\/$/, '');
          if (!username || username.includes('accounts') || username.includes('explore') || username.includes('direct')) continue;
          if (!profileSet.has(username)) {
            profileSet.add(username);
            var profileData = await scrapeProfile(page, username);
            if (profileData && profileData.follower_count > 0) {
              profileData.scrape_source = 'followers:' + account;
              leads.push(profileData);
              if (leads.length % 5 === 0) process.stdout.write('.');
            }
          }
        } catch (e) { /* skip */ }
        if (leads.length >= maxLeads) break;
        await delay(1000 + Math.random() * 1000);
      }
      if (leads.length >= maxLeads) break;

      // Scroll down in the dialog
      try {
        await page.evaluate(function(sel) {
          var el = document.querySelector(sel);
          if (el) el.scrollTop = el.scrollHeight;
        }, 'div[role="dialog"]');
      } catch (e) { /* */ }
      await delay(2000);
    }
  } catch (e) {
    console.error('  Followers scrape error:', e.message.substring(0, 100));
  }
  return leads;
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ── Main ──

var config = loadConfig();
scrapeInstagram(config).then(function(leads) {
  console.log('\nDone. Total leads: ' + leads.length);
  process.exit(0);
}).catch(function(err) {
  console.error('\nFatal error:', err);
  process.exit(1);
});
