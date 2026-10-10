import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Pages legitimately outside the installable PWA surface.
const ALLOWLIST = new Set([
  'lotl/index.html', // shortcut redirect, no UI of its own
  'admin/index.html', // internal tooling surface
  'style-guide/index.html', // dev-only reference
]);

function publicPages() {
  var out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      var full = join(dir, entry);
      var rel = relative(root, full).replace(/\\/g, '/');
      if (rel.startsWith('node_modules') || rel.startsWith('books/') || rel.startsWith('coverage/')) continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (entry === 'index.html') out.push(rel);
    }
  })(root);
  return out.filter(function (p) { return !ALLOWLIST.has(p); });
}

describe('PWA head consistency across public pages', function () {
  const pages = publicPages();

  it('finds a healthy number of public pages to check', function () {
    expect(pages.length).toBeGreaterThan(50);
  });

  it('every public page links the shared manifest', function () {
    const missing = pages.filter(function (p) {
      return !readFileSync(join(root, p), 'utf8').includes('rel="manifest"');
    });
    expect(missing).toEqual([]);
  });

  it('every public page sets the brand theme-color', function () {
    const missing = pages.filter(function (p) {
      return !readFileSync(join(root, p), 'utf8').includes('name="theme-color"');
    });
    expect(missing).toEqual([]);
  });

  it('every public page declares an apple touch icon', function () {
    const missing = pages.filter(function (p) {
      return !readFileSync(join(root, p), 'utf8').includes('apple-touch-icon');
    });
    expect(missing).toEqual([]);
  });
});
