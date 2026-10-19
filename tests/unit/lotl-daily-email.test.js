import { describe, it, expect } from 'vitest';
import {
  buildLotlDailyHtml, lotlDailySubject, devotionalUrl, monthPackUrl, todayKey, shareUrls
} from '../../functions/api/email/_lotl-daily.js';

const mockPack = {
  yearlyMessage: 'Focus on The Love of The Lord',
  monthTheme: 'The Eternal Source (Pre-creation Love)'
};

const mockDay = {
  id: 'pdd-2026-10-19',
  date: '2026-10-19',
  weekday: 'Mon',
  serviceTheme: 'His Mercies Are New',
  dimensionLabel: 'Spiritual Warfare (Praying the Scriptures)',
  scripture: 'Jeremiah 31:3',
  verse: 'I have loved you with an everlasting love.',
  teaching: 'Everlasting means no start date.',
  prayer: 'Father, thank You for Your everlasting love.',
  declaration: 'I walk in Kingdom abundance to be a blessing.',
  decree: 'I walk in Kingdom abundance to be a blessing. In Jesus\u2019 name, Amen.',
  action: 'Review one money choice today.'
};

describe('lotl daily devotional email', function () {
  it('builds an inline-styled email with every section', function () {
    const html = buildLotlDailyHtml(mockPack, mockDay, 'https://studio.gabochie.com');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('His Mercies Are New');
    expect(html).toContain('Jeremiah 31:3');
    expect(html).toContain('I have loved you with an everlasting love.');
    expect(html).toContain('Teaching');
    expect(html).toContain('Prayer');
    expect(html).toContain('Declaration');
    expect(html).toContain('Decree');
    expect(html).toContain('I walk in Kingdom abundance to be a blessing.');
    expect(html).toContain('Review one money choice today.');
    expect(html).toContain('style=');
    expect(html).not.toContain('<style');
  });

  it('ships an unsubscribe link and a tracked UTM CTA', function () {
    const html = buildLotlDailyHtml(mockPack, mockDay, 'https://studio.gabochie.com');
    expect(html).toContain('/unsubscribe/');
    expect(html).toContain('utm_source=lotl');
    expect(html).toContain('utm_campaign=lotl-daily');
    expect(html).toContain('utm_content=2026-10-19');
  });

  it('escapes hostile content in the decrees', function () {
    const evil = Object.assign({}, mockDay, { declaration: '<script>alert(1)</script>' });
    const html = buildLotlDailyHtml(mockPack, evil, 'https://studio.gabochie.com');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('composes a subject carrying the date and theme', function () {
    expect(lotlDailySubject(mockDay)).toContain('2026-10-19');
    expect(lotlDailySubject(mockDay)).toContain('His Mercies Are New');
  });

  it('points the pack URL at the right month file', function () {
    expect(monthPackUrl('https://studio.gabochie.com', '2026-10-19'))
      .toBe('https://studio.gabochie.com/love-of-the-lord/daily/2026-10.json');
    expect(devotionalUrl('https://studio.gabochie.com/', '2026-10-19')).toContain('/love-of-the-lord/devotionals/');
  });

  it('produces share links that include the declaration', function () {
    const s = shareUrls('https://studio.gabochie.com', mockDay);
    expect(s.wa).toContain('wa.me');
    expect(decodeURIComponent(s.wa)).toContain(mockDay.declaration);
    expect(s.xt).toContain('x.com');
    expect(s.fb).toContain('facebook.com');
  });

  it('builds a YYYY-MM-DD key', function () {
    expect(todayKey(new Date('2026-10-19T08:00:00Z'))).toBe('2026-10-19');
  });
});
