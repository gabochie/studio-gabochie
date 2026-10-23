import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pages = JSON.parse(readFileSync(join(root, 'search', 'pages.json'), 'utf8'));

function haystack(page) {
  const keywords = Array.isArray(page.keywords) ? page.keywords.join(' ') : (page.keywords || '');
  return (page.title + ' ' + (page.description || '') + ' ' + keywords).toLowerCase();
}

describe('search static index', function () {
  it('is a non-empty array of indexable pages', function () {
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(typeof page.title).toBe('string');
      expect(page.title.length).toBeGreaterThan(0);
      expect(typeof page.url).toBe('string');
      expect(page.url.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate URLs', function () {
    const seen = new Set();
    for (const page of pages) {
      expect(seen.has(page.url)).toBe(false);
      seen.add(page.url);
    }
  });

  it('only links to pages that exist on disk', function () {
    for (const page of pages) {
      if (/^https?:\/\//.test(page.url)) continue;
      const clean = page.url.split('#')[0].split('?')[0];
      let file = clean.replace(/^\//, '');
      if (file === '') continue;
      if (file.endsWith('/')) file += 'index.html';
      expect(existsSync(join(root, file)), page.url + ' should exist').toBe(true);
    }
  });

  it('finds the Fearless Steps book when searching for "witchcraft"', function () {
    const matches = pages.filter(function (page) {
      return haystack(page).indexOf('witchcraft') >= 0;
    });
    const urls = matches.map(function (page) { return page.url; });
    expect(urls).toContain('/books/fearless-steps/');
  });

  it('points the Fearless Steps entry at the real book page, not a stale slug', function () {
    expect(pages.some(function (page) { return page.url === '/books/7-fearless-steps/'; })).toBe(false);
  });
});
