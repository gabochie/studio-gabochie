/*
 * Revenue readiness check.
 *
 * Loads the two pay-link config scripts in a stubbed DOM, then reports every
 * Selar checkout slot as LIVE / BLANK / PLACEHOLDER / INVALID / QUICK-CHECKOUT
 * MISSING. Blank links are safe (the UI hides their buttons) but dormant.
 *
 *   node scripts/check-revenue-config.mjs            human-readable report
 *   node scripts/check-revenue-config.mjs --json     machine-readable
 *   node scripts/check-revenue-config.mjs --strict   exit 1 if a required slot is not LIVE
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SLOTS = [
  { key: 'consultation.anchor',   label: 'Consultation — Anchor Session ₵1,500',     file: 'consultation-config.js', required: true,  read: (c) => c.consultation?.selar?.anchor },
  { key: 'consultation.sprint',   label: 'Consultation — Coaching Sprint ₵5,000',    file: 'consultation-config.js', required: true,  read: (c) => c.consultation?.selar?.sprint },
  { key: 'consultation.retainer', label: 'Consultation — Advisory Retainer ₵10,000', file: 'consultation-config.js', required: true,  read: (c) => c.consultation?.selar?.retainer },
  { key: 'selar.donation',        label: 'Donate — Show Love donation',              file: 'selar-links.js',         required: true,  read: (c) => c.selar?.donation },
  { key: 'selar.products.books',  label: 'Books — catalogue / book product',         file: 'selar-links.js',         required: true,  read: (c) => c.selar?.products?.books },
  { key: 'selar.products.bundle', label: 'Books — Premium Books Bundle',             file: 'selar-links.js',         required: true,  read: (c) => c.selar?.products?.bundle },
  { key: 'selar.products.courses',label: 'Courses — catalogue / course product',     file: 'selar-links.js',         required: true,  read: (c) => c.selar?.products?.courses },
  { key: 'selar.products.guitar', label: 'Guitar School — registration',             file: 'selar-links.js',         required: true,  read: (c) => c.selar?.products?.guitar },
  { key: 'selar.store',           label: 'Selar storefront (optional product fallback)', file: 'selar-links.js',    required: false, read: (c) => c.selar?.store }
];

export function loadConfigs(root = ROOT) {
  const sandboxShared = {
    URL,
    URLSearchParams,
    console,
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelectorAll() { return []; }
    }
  };

  function run(filename, windowKey) {
    const file = path.join(root, 'assets', 'js', filename);
    const source = fs.readFileSync(file, 'utf8');
    const sandbox = { ...sandboxShared, window: {} };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(source, sandbox, { filename });
    return sandbox.window[windowKey] || {};
  }

  return {
    consultation: run('consultation-config.js', 'CONSULTATION_CONFIG'),
    selar: run('selar-links.js', 'SELAR_CONFIG')
  };
}

export function classify(raw) {
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url) return { status: 'BLANK', reason: 'no link pasted — button hidden' };
  if (/REPLACE|PASTE|example\.com|<your/i.test(url)) {
    return { status: 'PLACEHOLDER', reason: 'still a placeholder — button hidden' };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_e) {
    return { status: 'INVALID', reason: 'not a valid URL' };
  }
  if (parsed.protocol !== 'https:' || !/(^|\.)selar\.com$/i.test(parsed.hostname)) {
    return { status: 'INVALID', reason: 'expected an https://selar.com/... URL' };
  }
  if (parsed.searchParams.get('quickcheckout') !== '1') {
    return { status: 'NO_QUICKCHECKOUT', reason: 'valid Selar link but missing ?quickcheckout=1' };
  }
  return { status: 'LIVE', reason: 'ready' };
}

export function collectSlots(configs = loadConfigs()) {
  return SLOTS.map((slot) => {
    const raw = slot.read(configs);
    const result = classify(raw);
    return {
      key: slot.key,
      label: slot.label,
      file: 'assets/js/' + slot.file,
      required: slot.required,
      url: typeof raw === 'string' ? raw.trim() : '',
      status: result.status,
      reason: result.reason
    };
  });
}

export function summarize(slots = collectSlots()) {
  const required = slots.filter((s) => s.required);
  const live = required.filter((s) => s.status === 'LIVE');
  return {
    required: required.length,
    live: live.length,
    dormant: required.length - live.length,
    optionalLive: slots.filter((s) => !s.required && s.status === 'LIVE').length,
    ready: live.length === required.length
  };
}

function render(slots, summary) {
  const icon = { LIVE: '[OK]', BLANK: '[  ]', PLACEHOLDER: '[??]', INVALID: '[!!]', NO_QUICKCHECKOUT: '[~ ]' };
  const lines = [];
  lines.push('Revenue checkout readiness — studio.gabochie.com');
  lines.push('');
  slots.forEach((s) => {
    const flag = s.required ? 'required' : 'optional';
    lines.push(`${icon[s.status]} ${s.key.padEnd(26)} ${flag.padEnd(8)} ${s.label}`);
    if (s.status !== 'LIVE') lines.push(`       ${s.reason}  (${s.file})`);
  });
  lines.push('');
  lines.push(`Required pay links LIVE: ${summary.live}/${summary.required}`);
  if (!summary.ready) {
    lines.push(`DORMANT: ${summary.dormant} required link(s) still need a Selar Quick Checkout URL.`);
    lines.push('Blank links are safe — their buttons stay hidden — but no money can be collected there yet.');
  } else {
    lines.push('All required pay links are live.');
  }
  lines.push('Verify with: npm run check:revenue');
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const slots = collectSlots();
  const summary = summarize(slots);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ status: summary.ready ? 'ready' : 'dormant', summary, slots }, null, 2));
  } else {
    console.log(render(slots, summary));
  }
  if (argv.includes('--strict') && !summary.ready) return 1;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
