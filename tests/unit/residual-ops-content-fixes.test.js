import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';

var ROOT = process.cwd();

/* ───────────────── DAT-32 / OPS-13: backup snapshot metadata ─────────────── */

describe('DAT-32/OPS-13 backup snapshot consistency', function () {
  var src = readFileSync(resolve(ROOT, 'scripts/db-backup.js'), 'utf8');

  it('captures exactly one snapshot timestamp for the whole run', function () {
    expect((src.match(/new Date\(\)\.toISOString\(\)/g) || []).length).toBe(1);
    expect(src).toMatch(/const SNAPSHOT_AT = new Date\(\)\.toISOString\(\)/);
    expect(src).toMatch(/snapshot_at: SNAPSHOT_AT/);
    expect(src).toMatch(/created_at: SNAPSHOT_AT/);
    expect(src).toMatch(/const TIMESTAMP = SNAPSHOT_AT/);
  });

  it('verifies critical table row counts and fails on any error', function () {
    expect(src).toMatch(/CRITICAL_TABLES = \['donations', 'subscribers'\]/);
    expect(src).toMatch(/critical_row_counts/);
    expect(src).toMatch(/counted !== rows\.length/);
    expect(src).toMatch(/Number\.isFinite\(counted\)/);
    expect(src).toMatch(/process\.exit\(failed\.length > 0 \? 1 : 0\)/);
  });
});

/* ───────────────── FE-09: sitemap lastmod from git history ───────────────── */

function localFileFor(loc) {
  var rel = loc.replace('https://studio.gabochie.com/', '');
  return rel === '' ? 'index.html' : join(rel, 'index.html');
}

function lastCommitDate(file) {
  try {
    var out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(out)) return out.slice(0, 10);
  } catch (_e) { /* file has no commit yet */ }
  return statSync(join(ROOT, file)).mtime.toISOString().slice(0, 10);
}

describe('FE-09 sitemap lastmod values', function () {
  var xml = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');
  var entries = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)).map(function (m) {
    return { loc: m[1], lastmod: m[2] };
  });

  it('keeps the URL set and gives each URL a real date', function () {
    // 54 original URLs + /courses/year-package-2027/ (2027 Year Package).
    expect(entries).toHaveLength(55);
    expect(new Set(entries.map(function (e) { return e.lastmod; })).size).toBeGreaterThan(1);
    entries.forEach(function (e) {
      expect(e.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('matches the last commit date of each corresponding local page', function () {
    entries.forEach(function (e) {
      expect(e.lastmod, e.loc).toBe(lastCommitDate(localFileFor(e.loc)));
    });
  }, 30000);
});

/* ───────────────── FE-26: structured-data social profiles ───────────────── */

describe('FE-26 homepage sameAs profiles', function () {
  it('lists the verified social profiles instead of an empty array', function () {
    var html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    var block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(block).not.toBe(null);
    var data = JSON.parse(block[1]);
    expect(data.sameAs).toEqual([
      'https://x.com/GideonAbochie',
      'https://www.youtube.com/@GideonAbochie'
    ]);
  });
});
