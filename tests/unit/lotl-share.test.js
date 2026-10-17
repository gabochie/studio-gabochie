import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const shareJs = readFileSync(join(root, 'love-of-the-lord', 'share.js'), 'utf8');
const home = readFileSync(join(root, 'love-of-the-lord', 'index.html'), 'utf8');
const devotionals = readFileSync(join(root, 'love-of-the-lord', 'devotionals', 'index.html'), 'utf8');
const give = readFileSync(join(root, 'love-of-the-lord', 'give', 'index.html'), 'utf8');
const dailyPreview = readFileSync(join(root, 'love-of-the-lord', 'daily', '2027-01-preview.html'), 'utf8');

describe('LOTL share wiring', function () {
  it('builds UTM-tagged share URLs and tracks', function () {
    expect(shareJs).toMatch(/utm_source/);
    expect(shareJs).toMatch(/utm_medium/);
    expect(shareJs).toMatch(/utm_campaign/);
    expect(shareJs).toMatch(/navigator\.share/);
    expect(shareJs).toMatch(/window\.lotlShareUrl/);
    expect(shareJs).toMatch(/window\.lotlShare/);
    expect(shareJs).toMatch(/sendBeacon/);
    expect(shareJs).toMatch(/event_type/);
    expect(shareJs).toMatch(/share/);
  });

  it('home done-modal invite has data-lotl-share with lotl-invite UTM', function () {
    expect(home).toMatch(/data-lotl-share/);
    expect(home).toMatch(/lotl-invite/);
    expect(home).toMatch(/utm_campaign[%]?3Dlotl-invite|utm_campaign=lotl-invite/);
    expect(home).toMatch(/love-of-the-lord\/share\.js/);
  });

  it('devotionals renders share buttons and loads share.js', function () {
    expect(devotionals).toMatch(/lotlShareBtn/);
    expect(devotionals).toMatch(/lotlShareUrl/);
    expect(devotionals).toMatch(/love-of-the-lord\/share\.js/);
    expect(devotionals).toMatch(/data-share-campaign="lotl-decrees"/);
  });

  it('give page invite has lotl-give-invite campaign and loads share.js', function () {
    expect(give).toMatch(/lotl-give-invite/);
    expect(give).toMatch(/data-lotl-share/);
    expect(give).toMatch(/love-of-the-lord\/share\.js/);
  });

  it('daily preview share carries lotl-decrees and loads share.js', function () {
    expect(dailyPreview).toMatch(/lotl-decrees/);
    expect(dailyPreview).toMatch(/data-lotl-share/);
    expect(dailyPreview).toMatch(/love-of-the-lord\/share\.js/);
  });
});
