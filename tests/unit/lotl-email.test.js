import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'love-of-the-lord', 'email', 'friday-answers.html');

describe('LOTL Friday Answers email (generate-friday-email.cjs)', function () {
  it('is generated', function () {
    expect(existsSync(out)).toBe(true);
  });

  const html = readFileSync(out, 'utf8');

  it('carries the ministry brand and contact', function () {
    expect(html).toContain('Love Of The Lord');
    expect(html).toContain('love@gabochie.com');
    expect(html).toContain('Global Ministry');
  });

  it('renders three answer cards with CTA + unsubscribe', function () {
    const ctas = (html.match(/Watch answer \d/g) || []).length;
    expect(ctas).toBe(3);
    expect(html).toContain('/love-of-the-lord/answers/');
    expect(html).toContain('/unsubscribe/');
  });

  it('uses inline styling (email-client safe)', function () {
    expect(html).toContain('style=');
    expect(html).not.toContain('<style');
  });
});
