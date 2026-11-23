import { describe, it, expect } from 'vitest';
import { classify, collectSlots, summarize, loadConfigs } from '../../scripts/check-revenue-config.mjs';

describe('revenue config classifier', function () {
  it('treats blank and placeholder links as dormant', function () {
    expect(classify('').status).toBe('BLANK');
    expect(classify('   ').status).toBe('BLANK');
    expect(classify(null).status).toBe('BLANK');
    expect(classify('PASTE URL HERE').status).toBe('PLACEHOLDER');
    expect(classify('https://selar.com/REPLACE_ME?quickcheckout=1').status).toBe('PLACEHOLDER');
    expect(classify('https://example.com/book').status).toBe('PLACEHOLDER');
  });

  it('rejects non-Selar and insecure URLs', function () {
    expect(classify('not a url').status).toBe('INVALID');
    expect(classify('https://google.com/x?quickcheckout=1').status).toBe('INVALID');
    expect(classify('http://selar.com/book?quickcheckout=1').status).toBe('INVALID');
  });

  it('flags Selar links without quick checkout', function () {
    expect(classify('https://selar.com/anchor-session').status).toBe('NO_QUICKCHECKOUT');
  });

  it('accepts a Selar quick-checkout URL', function () {
    var result = classify('https://selar.com/anchor-session?quickcheckout=1');
    expect(result.status).toBe('LIVE');
    expect(result.reason).toBe('ready');
  });
});

describe('revenue config report', function () {
  it('counts required and optional slots from real config files', function () {
    var slots = collectSlots(loadConfigs());
    expect(slots.length).toBe(9);
    expect(slots.filter(function (s) { return s.required; }).length).toBe(8);
    expect(slots.filter(function (s) { return !s.required; }).length).toBe(1);
    expect(slots.map(function (s) { return s.key; })).toContain('consultation.retainer');
    expect(slots.map(function (s) { return s.key; })).toContain('selar.donation');
  });

  it('reports ready only when every required slot is live', function () {
    var live = ['a', 'b'].map(function (key) {
      return { key: key, required: true, status: 'LIVE', label: key, file: '', url: '', reason: '' };
    });
    expect(summarize(live).ready).toBe(true);
    expect(summarize(live).live).toBe(2);

    live[1].status = 'BLANK';
    var summary = summarize(live);
    expect(summary.ready).toBe(false);
    expect(summary.dormant).toBe(1);
  });
});
