// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Love Of The Lord — service page', function () {
  test('loads with ministry title and hero CTAs', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page).toHaveTitle(/Love Of The Lord/);
    await expect(page.locator('.hero h1').first()).toContainText('Have church');
    await expect(page.locator('text=Full Service').first()).toBeVisible();
    await expect(page.locator('text=Express').first()).toBeVisible();
  });

  test('renders all 9 order-of-service stops from lineup.json', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#order .stop')).toHaveCount(9);
  });

  test('play advances progress and remembers position', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    var bar = page.locator('#bar');
    var before = await bar.evaluate(function (el) { return el.style.width; });
    await page.locator('#playBtn').click();
    await expect(bar).not.toHaveJSProperty('style', before);
    var saved = await page.evaluate(function () { return localStorage.getItem('lotl_progress_v1'); });
    expect(saved).toContain('idx');
  });

  test('amen counter increments and persists', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    var count = page.locator('#amenCount');
    await expect(count).toBeVisible();
    var before = parseInt(await count.textContent(), 10);
    await page.locator('text=Amen').first().click();
    var after = await page.evaluate(function () { return localStorage.getItem('lotl_amen_v1'); });
    expect(parseInt(after, 10)).toBeGreaterThanOrEqual(before);
  });

  test('worship mode opens and closes', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await page.locator('text=Worship Mode').first().click();
    await expect(page.locator('#dim.open')).toBeVisible();
    await page.locator('#dim.open').click();
    await expect(page.locator('#dim.open')).toBeHidden();
  });

  test('prayer + question + family forms are present', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#prayerForm')).toBeVisible();
    await expect(page.locator('#askForm')).toBeVisible();
    await expect(page.locator('#familyForm')).toBeVisible();
    await expect(page.locator('#storyForm')).toBeHidden();
    await page.locator('details.fold summary').first().click();
    await expect(page.locator('#storyForm')).toBeVisible();
  });

  test('shows LOTL brand topbar, not Studio nav', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('.lotl-nav b').first()).toContainText('Love Of The Lord');
    await expect(page.locator('.lotl-nav img').first()).toBeVisible();
    await expect(page.locator('.lotl-nav a.live').first()).toContainText('Have Church Now');
    await expect(page.locator('.lotl-nav small').first()).toContainText('Studio Gabochie');
  });

  test('headers are identical on service and give pages', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    var serviceLinks = await page.locator('.lotl-nav .lotl-links a').allTextContents();
    await page.goto('/love-of-the-lord/give/');
    var giveLinks = await page.locator('.lotl-nav .lotl-links a').allTextContents();
    expect(giveLinks).toEqual(serviceLinks);
    await expect(page.locator('.lotl-nav a.live').first()).toContainText('Have Church Now');
    await expect(page.locator('.lotl-nav').locator('text=Have Church Now')).toBeVisible();
  });

  test('ministry band sits directly above the shared global footer', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('.lotl-ministry-in').first()).toBeVisible();
    await expect(page.locator('.lotl-ministry').first()).toContainText('love@gabochie.com');
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('footer').locator('text=Offerings').first()).toBeVisible();
    await expect(page.locator('footer').locator('text=Learn').first()).toBeVisible();
    var gap = await page.evaluate(function () {
      var band = document.querySelector('.lotl-ministry');
      var foot = document.querySelector('footer');
      if (!band || !foot) return -1;
      return foot.getBoundingClientRect().top - band.getBoundingClientRect().bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(70);
  });
  test('no ministry nav is hijacked by the site-wide fixed nav rule', async function ({ page }) {
    await page.goto('/love-of-the-lord/give/');
    var pos = await page.evaluate(function () {
      var els = document.querySelectorAll('.lotl-nav, .lotl-links, .lotl-ministry nav');
      var out = {};
      els.forEach(function (el, i) { out[i + ':' + el.tagName + '.' + el.className] = getComputedStyle(el).position; });
      return out;
    });
    Object.values(pos).forEach(function (p) { expect(p).not.toBe('fixed'); });
  });
  test('legal links live once in a centered bottom bar below the copyright', async function ({ page }) {
    for (const url of ['/love-of-the-lord/', '/']) {
      await page.goto(url);
      var bar = page.locator('footer .footer-legal--bar');
      await expect(bar.first()).toBeVisible({ timeout: 10000 });
      expect(await page.locator('footer .footer-legal').count()).toBe(1);
      await expect(bar.first()).toContainText('Privacy');
      for (const slug of ['privacy', 'cookies', 'terms', 'refund', 'disclaimer', 'donations']) {
        await expect(bar.locator('a[href="/legal/' + slug + '.html"]').first()).toBeVisible();
      }
      var order = await page.evaluate(function () {
        var els = [...document.querySelectorAll('footer .container > *')].map(function (e) { return e.className; });
        return els.join(',');
      });
      expect(order.indexOf('footer-legal--bar')).toBeLessThan(order.indexOf('footer-bottom'));
    }
  });
  test('global footer links the Ministry on every page', async function ({ page }) {
    for (const url of ['/', '/love-of-the-lord/', '/love-of-the-lord/give/']) {
      await page.goto(url);
      var col = page.locator('footer', { hasText: 'Ministry' }).first();
      await expect(col).toBeVisible({ timeout: 10000 });
      await expect(page.locator('footer a[href="/love-of-the-lord/"]').first()).toBeVisible();
      await expect(page.locator('footer a[href="/love-of-the-lord/give/"]').first()).toBeVisible();
      var colOrder = await page.evaluate(function () {
        return [...document.querySelectorAll('footer .container > div > h4')].map(function (e) { return e.textContent; }).join(',');
      });
      expect(colOrder.indexOf('Ministry')).toBeLessThan(colOrder.indexOf('Connect'));
    }
  });

  test('footer shows the shared P.O. Box in Connect', async function ({ page }) {
    await page.goto('/');
    await expect(page.locator('footer').locator('text=P.O. Box SK 2125').first()).toBeVisible({ timeout: 10000 });
  });

  test('ministry contact uses love@gabochie.com', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    var mail = page.locator('a[href^="mailto:love@gabochie.com"]').first();
    await expect(mail).toBeVisible();
  });

  test('give page loads with MoMo details', async function ({ page }) {
    await page.goto('/love-of-the-lord/give/');
    await expect(page.locator('h1').first()).toContainText('Give');
    await expect(page.locator('text=Gideon Abochie').first()).toBeVisible();
    await expect(page.locator('text=024 326 2019').first()).toBeVisible();
  });

  test('/lotl/ shortcut redirects to canonical', async function ({ page }) {
    var res = await page.goto('/lotl/');
    expect([200, 301, 308]).toContain(res.status());
    await expect(page).toHaveURL(/love-of-the-lord/);
  });

  test('resume bar stays hidden for first-time visitors', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resumeBar')).toBeHidden();
  });

  test('pills use short labels', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await expect(page.locator('#steps').first()).toContainText('News');
    await expect(page.locator('#steps').first()).toContainText('Blessing');
  });

  test('journey shows Now / Up next / Done states', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await expect(page.locator('#order .stop.on .st').first()).toContainText('Now');
    await page.locator('#playBtn').click();
    await expect(page.locator('#order .stop.done').first()).toBeVisible();
    await expect(page.locator('#order .stop.done .st').first()).toContainText('Done');
  });

  test('finishing the service opens the celebration card', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    for (var i = 0; i < 9; i++) {
      await page.locator('#playBtn').click();
    }
    await expect(page.locator('#doneDim.open')).toBeVisible();
    await expect(page.locator('#doneDim').first()).toContainText('Heaven rejoices');
    await expect(page.locator('#doneDim a[href*="wa.me"]').first()).toBeVisible();
    await page.locator('#doneDim').locator('text=Replay service').click();
    await expect(page.locator('#doneDim.open')).toBeHidden();
  });

  test('prev returns to the previous stop', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.locator('#nextBtn').click();
    await page.locator('#nextBtn').click();
    var saved = await page.evaluate(function () { return localStorage.getItem('lotl_progress_v1'); });
    expect(saved).toContain('"idx":2');
    await page.locator('#prevBtn').click();
    saved = await page.evaluate(function () { return localStorage.getItem('lotl_progress_v1'); });
    expect(saved).toContain('"idx":1');
    await expect(page.locator('#playBtn')).toContainText('▶');
  });

  test('play pauses and resumes the current stop audio', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.evaluate(function () {
      document.querySelectorAll('#stage audio').forEach(function (a) { a.remove(); });
      var C = new (window.AudioContext || window.webkitAudioContext)();
      var o = C.createOscillator();
      var g = C.createGain(); g.gain.value = 0;
      o.connect(g);
      var d = C.createMediaStreamDestination(); g.connect(d); o.start();
      var a = document.createElement('audio'); a.id = 'probeTone'; a.srcObject = d.stream;
      document.getElementById('stage').appendChild(a);
    });
    await page.locator('#playBtn').click();
    await expect.poll(async function () {
      return page.evaluate(function () { return document.getElementById('probeTone').paused; });
    }).toBe(false);
    await expect(page.locator('#playBtn')).toContainText('⏸');
    await page.locator('#playBtn').click();
    await expect.poll(async function () {
      return page.evaluate(function () { return document.getElementById('probeTone').paused; });
    }).toBe(true);
    await expect(page.locator('#playBtn')).toContainText('▶');
  });

  test('name pre-fills across forms after first submit', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#prayerForm')).toBeVisible({ timeout: 10000 });
    await page.locator('#prayerForm [name=name]').fill(' ama ');
    await page.locator('#prayerForm [name=phone]').fill('0240000000');
    await page.locator('#prayerForm button[type=submit]').click();
    await expect(page.locator('#prayerOk, #prayerForm .lotl-err').first()).toBeVisible();
    var familyName = await page.locator('#familyForm [name=name]').inputValue();
    expect(familyName).toContain('ama');
  });

  test('series engine populates the service picker from series.json', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#servicePicker option').first()).toBeAttached({ timeout: 10000 });
    await expect(page.locator('#servicePicker optgroup')).toHaveCount(4);
    await expect(page.locator('#servicePicker optgroup').first()).toHaveAttribute('label', 'Foundations of Grace');
    await expect(page.locator('#servicePicker option').first()).toContainText('Grace for New Beginnings');
    await expect(page.locator('#seasonLabel')).toContainText(/Foundations of Grace|The Kingdom Mind|Love in Action|Hope and Harvest/);
  });

  test('empty media renders a helpful fallback instead of a dead stage', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.locator('#servicePicker').selectOption('service-001');
    await expect(page.locator('#stage')).toBeVisible();
    await expect(page.locator('#stage')).toContainText('Where are you watching from?');
    await expect(page.locator('.screen.has-media')).toHaveCount(0);
  });

  test('resume continues saved position and restart clears it', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.evaluate(function () {
      localStorage.setItem('lotl_progress_v1', JSON.stringify({ idx: 4, mode: 'full' }));
      localStorage.setItem('lotl_max_v1', '4');
    });
    await page.reload();
    await expect(page.locator('#resumeBar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resumeBar')).toContainText('Offering');
    await page.locator('#resumeBar button', { hasText: 'Continue' }).click();
    await expect(page.locator('#order .stop.on').first()).toContainText('Offering');
    await expect(page.locator('#resumeBar')).toBeHidden();
    await page.evaluate(function () {
      localStorage.setItem('lotl_progress_v1', JSON.stringify({ idx: 3, mode: 'full' }));
    });
    await page.reload();
    await expect(page.locator('#resumeBar')).toBeVisible({ timeout: 10000 });
    await page.locator('#resumeBar button', { hasText: 'Restart' }).click();
    var saved = await page.evaluate(function () { return localStorage.getItem('lotl_progress_v1'); });
    expect(saved).toBeNull();
    await expect(page.locator('#order .stop.on').first()).toContainText('Welcome');
  });

  test('switching service with progress asks first', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.evaluate(function () {
      localStorage.setItem('lotl_progress_v1', JSON.stringify({ idx: 2, mode: 'full' }));
      localStorage.setItem('lotl_max_v1', '2');
    });
    await page.reload();
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    var seen = '';
    page.on('dialog', async function (d) { seen = d.message(); await d.dismiss(); });
    await page.locator('#servicePicker').selectOption('service-002');
    expect(seen).toContain('Switch service?');
    await expect(page.locator('#seasonLabel')).toContainText('Grace for New Beginnings');
    page.removeAllListeners('dialog');
    page.on('dialog', async function (d) { await d.accept(); });
    await page.locator('#servicePicker').selectOption('service-002');
    await expect(page.locator('#seasonLabel')).toContainText('Mercy That Never Runs Out');
    var saved = await page.evaluate(function () { return localStorage.getItem('lotl_progress_v1'); });
    expect(saved).toBeNull();
  });

  test('audio-only toggle reports its state', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#order .stop')).toHaveCount(9, { timeout: 10000 });
    await page.locator('.amen-row button', { hasText: 'Audio-only' }).click();
    await expect(page.locator('#audioNote')).toBeVisible();
    await expect(page.locator('#audioNote')).toContainText('Audio-only');
  });

  test('latest answers strip renders 3 answers on the home page', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#latestAnswers .ans-card')).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator('a[href="/love-of-the-lord/answers/"]').first()).toBeVisible();
  });

  test('this-week strip renders from series + answers data', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#thisWeek')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#twService')).toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(page.locator('#twAnswers')).not.toBeEmpty();
  });

  test('testimony wall rotates 3 approved stories from data', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#testimonyWall .t')).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator('#testimonyWall .t').first()).toContainText('★');
  });
});

test.describe('Love Of The Lord — answers archive', function () {
  test('loads the archive with seeded answers and filters', async function ({ page }) {
    await page.goto('/love-of-the-lord/answers/');
    await expect(page.locator('.ans-item')).toHaveCount(6, { timeout: 10000 });
    await expect(page.locator('#filters button').first()).toContainText('All');
    await expect(page.locator('.ans-list')).toContainText('Past Answer');
  });

  test('filter narrows the list by category', async function ({ page }) {
    await page.goto('/love-of-the-lord/answers/');
    await expect(page.locator('.ans-item')).toHaveCount(6, { timeout: 10000 });
    await page.locator('#filters button', { hasText: 'Faith' }).click();
    var count = await page.locator('.ans-item').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(6);
  });

  test('archived answers link out to their source video', async function ({ page }) {
    await page.goto('/love-of-the-lord/answers/');
    await expect(page.locator('.ans-item').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href*="tiktok.com"]').first()).toBeVisible();
  });
});

test.describe('Admin — LOTL Studio editor', function () {
  test('loads series.json and renders editable service rows', async function ({ page }) {
    await page.goto('/admin/lotl.html');
    await expect(page.locator('#servicesList .svc-row').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#servicesList .svc-row')).toHaveCount(13);
    await expect(page.locator('#seasonSelect option').first()).toContainText('Foundations of Grace');
  });

  test('opening a service loads its lineup stops into the editor', async function ({ page }) {
    await page.goto('/admin/lotl.html');
    await expect(page.locator('#servicesList .svc-row').first()).toBeVisible({ timeout: 10000 });
    await page.locator('#servicesList button', { hasText: 'Lineup' }).first().click();
    await expect(page.locator('#lineupEditor')).toHaveValue(/welcome/);
    await expect(page.locator('#lineupPath')).toContainText('lineup.json');
  });
});
