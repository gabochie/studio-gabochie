import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('PWA manifest', function () {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));

  it('has the required installability fields', function () {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.id).toBe('/');
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  it('declares 192, 512, and maskable icons that exist on disk', function () {
    const bySize = {};
    for (const icon of manifest.icons || []) {
      bySize[icon.sizes + ':' + (icon.purpose || 'any')] = icon.src;
    }
    expect(bySize['192x192:any']).toBeTruthy();
    expect(bySize['512x512:any']).toBeTruthy();
    expect(bySize['512x512:maskable']).toBeTruthy();
    for (const src of Object.values(bySize)) {
      expect(existsSync(join(root, src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('declares working app shortcuts', function () {
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    for (const s of manifest.shortcuts) {
      expect(s.name).toBeTruthy();
      expect(s.url).toMatch(/^\//);
      expect(s.icons && s.icons.length).toBeGreaterThan(0);
    }
  });
});
