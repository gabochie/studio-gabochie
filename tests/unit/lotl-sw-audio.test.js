import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

describe('service worker — offline LOTL audio', function () {
  it('is bumped past v13', function () {
    expect(sw).toMatch(/const VERSION = 'gabochie-v1[4-9]/);
  });

  it('routes ministry audio through a cache-first handler', function () {
    expect(sw).toContain("path.startsWith('/love-of-the-lord/audio/')");
    expect(sw).toContain('cacheFirstAudio');
  });

  it('bounds the audio cache with a size cap and skips range responses', function () {
    expect(sw).toContain('AUDIO_CACHE_MAX_BYTES');
    expect(sw).toContain('response.status === 200');
  });
});
