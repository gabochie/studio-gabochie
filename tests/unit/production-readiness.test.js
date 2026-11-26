import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function read(relative) {
  return readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');
}

describe('money-ghana production-readiness fixes', function () {
  it('makes all three assessment answers mandatory', function () {
    var js = read('assets/js/money-ghana.js');
    var html = read('money-ghana/index.html');
    expect(js).not.toMatch(/i === 0 \? ' checked'/);
    expect(js).toContain("btn.disabled = Object.keys(quizAnswers($('quizForm'))).length < 3");
    expect(js).toContain("Answer all three questions to see your match.");
    expect(html).toContain('id="quizBtn" type="submit" disabled');
    expect(html).toContain('id="quizMsg"');
  });

  it('persists the five UTMs, assessment answers and funnel events', function () {
    var js = read('assets/js/money-ghana.js');
    expect(js).toContain("var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']");
    expect(js).toContain("localStorage.getItem('ga_utm')");
    expect(js).toContain("payload.top_path = state.topPath");
    expect(js).toContain("payload.assessment_profile = state.answers.profile");
    ['assessment_start', 'assessment_complete', 'assessment_unlock'].forEach(function (event) {
      expect(js).toContain("sendEvent('" + event + "'");
    });
    expect(js).toContain("navigator.sendBeacon('/api/event'");

    var subscribe = read('functions/api/subscribe.js');
    expect(subscribe).toContain("utm_content: utmContent");
    expect(subscribe).toContain("utm_term: utmTerm");
    expect(subscribe).toContain("var ASSESSMENT_KEYS = ['profile', 'setup', 'capital', 'top_path']");
    expect(subscribe).toContain('function sanitizeMetadata(input, existing)');
  });

  it('gates the playbook download behind a real Turnstile-backed API result', function () {
    var html = read('money-ghana/playbook/index.html');
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('class="cf-turnstile" id="leadTurnstile"');
    expect(html).toContain('await getLeadToken()');
    expect(html).toContain('if (!response.ok || !data || data.status !== "ok")');
    expect(html.indexOf('if (!response.ok || !data || data.status !== "ok")'))
      .toBeLessThan(html.indexOf('leadForm.style.display = "none"'));
    expect(html).toContain('window.gaGetUtm');
    expect(html).toContain('"utm_content"');
    expect(html).toContain('"utm_term"');
    expect(html).not.toContain('once email delivery is connected');
  });

  it('derives USD prices from the shared consultation config', function () {
    var config = read('assets/js/consultation-config.js');
    expect(config).toContain("usd: '≈ $127'");
    expect(config).toContain("usd: '≈ $424'");
    expect(config).toContain("usd: '≈ $847'");
    [read('money-ghana/index.html'), read('money-ghana/guide/index.html')].forEach(function (html) {
      expect(html).toContain('/assets/js/consultation-config.js');
      expect(html).toContain('data-price-key="anchor" data-price-field="usd"');
    });
    var guide = read('money-ghana/guide/index.html');
    expect(guide).toContain('data-price-key="sprint" data-price-field="usd"');
    expect(guide).toContain('data-price-key="retainer" data-price-field="usd"');
    expect(guide).not.toContain('≈ $90');
  });

  it('reports the assessment funnel in analytics', function () {
    var api = read('functions/api/ai/analytics.js');
    expect(api).toContain("strftime('%Y-%m', subscribed_at)");
    expect(api).toContain("strftime('%Y-%m', viewed_at)");
    expect(api).toContain("event_type IN ('assessment_start','assessment_complete','assessment_unlock')");
    expect(api).toContain('assessmentEvents: assessmentMap');
    expect(read('admin/analytics.html')).toContain('id="assessment-grid"');
  });

  it('keeps assessment as the primary CTA in the 30-day calendar', function () {
    var plan = read('scripts/content-calendar-plan.js');
    var day24 = plan.slice(plan.indexOf('day: 24'), plan.indexOf('day: 25'));
    var day30 = plan.slice(plan.indexOf('day: 30'));
    expect(day24.indexOf('cta_url: assessment(')).toBeLessThan(day24.indexOf('alt_url: consultation('));
    expect(day30).toContain('cta_url: assessment(');
    expect(day30).toContain("consultation('newsletter', 'email', 'assessment-d30-close')");

    var doc = read('docs/30-day-assessment-calendar.md');
    expect(doc).toContain('assessment first');
    expect(doc).toContain('consultation second');
  });

  it('describes Selar checkout as pending in the strategy admin page', function () {
    var html = read('admin/strategy.html');
    expect(html).toContain('Selar checkout pending');
    expect(html).toContain('request form is active');
    expect(html).not.toContain('Selar pay links configured');
  });
});
