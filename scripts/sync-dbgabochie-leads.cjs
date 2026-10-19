#!/usr/bin/env node
/**
 * DBGabochie -> studio.gabochie cold_outreach bridge.
 *
 * Reads the private Gabochie lead console's data straight off disk (the console
 * is local-only and not always running) and emits idempotent SQL that loads the
 * eligible leads into the studio.gabochie D1 `cold_outreach` table as
 * status='pending'. Sending is a separate, deliberate step (arm workflow #42).
 *
 * Source of truth:
 *   10_LEAD_DATABASE/gabochie_db_master.csv      (the register, 33 cols)
 *   10_LEAD_DATABASE/status_overrides.json       (effective status per id)
 *   10_LEAD_DATABASE/outreach_state.json         (outcomes / lastContact per id)
 *
 * Usage:
 *   node scripts/sync-dbgabochie-leads.cjs                 # dry-run: emit SQL + stats
 *   node scripts/sync-dbgabochie-leads.cjs --apply         # emit then load into remote D1
 *   node scripts/sync-dbgabochie-leads.cjs --limit 500     # cap rows considered
 *   node scripts/sync-dbgabochie-leads.cjs --dir <path>    # override console dir
 *   node scripts/sync-dbgabochie-leads.cjs --no-existing   # skip existing-email de-dupe
 *
 * Env overrides: GABOCHIE_DB_DIR, GABOCHIE_MASTER_CSV, D1_DATABASE (default gahq)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_DIR = process.env.GABOCHIE_DB_DIR || 'C:\\Users\\user\\Documents\\GitHub\\DBGabochie';
const D1_DATABASE = process.env.D1_DATABASE || 'gahq';
const CAMPAIGN = 'dbgabochie-cold';
const SOURCE = 'dbgabochie';
const OUT_DIR = path.join(REPO_ROOT, 'cold_databases', 'dbgabochie-import');

const ROWS_PER_STATEMENT = 200;
const STATEMENTS_PER_FILE = 25; // ~5000 rows per .sql chunk

const EXCLUDED_STATUS = new Set(['DROPPED', 'OPTED_OUT', 'SYNTHETIC']);

// ---------------------------------------------------------------- args
function parseArgs(argv) {
  const args = { dir: DEFAULT_DIR, out: OUT_DIR, apply: false, limit: 0, noExisting: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--no-existing') args.noExisting = true;
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error('Unknown arg: ' + a); printHelp(); process.exit(1); }
  }
  return args;
}

function printHelp() {
  console.log([
    'sync-dbgabochie-leads.cjs — load DBGabochie leads into studio cold_outreach',
    '',
    '  --apply          load emitted SQL into the remote D1 database',
    '  --limit <n>      only consider the first n eligible rows',
    '  --dir <path>     DBGabochie repo directory (default ' + DEFAULT_DIR + ')',
    '  --out <path>     output directory for chunked SQL (default ' + OUT_DIR + ')',
    '  --no-existing    skip the remote existing-email de-dupe check',
    ''
  ].join('\n'));
}

// ---------------------------------------------------------------- CSV
// RFC-4180-ish parser: handles quoted fields, embedded commas/quotes/newlines.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------- helpers
function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function isValidEmail(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 254;
}

// Collapse control characters (incl. embedded newlines/tabs) to spaces.
function stripControl(v) {
  let out = '';
  for (const ch of String(v == null ? '' : v)) {
    out += ch.charCodeAt(0) < 32 ? ' ' : ch;
  }
  return out.trim();
}

function sqlStr(v) {
  const s = stripControl(v);
  return "'" + s.replace(/'/g, "''") + "'";
}

function effectiveStatus(id, rawStatus, overrides) {
  const ov = overrides[id];
  const s = String((ov && ov.status) || rawStatus || 'PENDING').trim().toUpperCase();
  return s || 'PENDING';
}

// ---------------------------------------------------------------- mapping
function mapRow(rec, id) {
  const market = String(rec.market || '').trim();
  const isDiaspora = market.toUpperCase() === 'GLOBAL-DIASPORA';
  const name = String(rec.company || rec.firm_name || rec.contact_name || '').trim();
  const category = String(rec.record_type || rec.interest_tags || 'business').trim();
  const region = String(rec.region || rec.diaspora_region || '').trim();
  const address = String(rec.location || rec.district || '').trim();
  const country = isDiaspora ? (String(rec.diaspora_region || '').trim() || 'Diaspora') : 'Ghana';
  const notes = 'dbgabochie_id=' + id + (rec.source ? '; src=' + rec.source : '');
  return {
    name,
    email: normalizeEmail(rec.email),
    phone: stripControl(rec.phone),
    website: String(rec.website || '').trim(),
    address,
    category,
    region,
    country,
    notes
  };
}

// ---------------------------------------------------------------- existing emails
function fetchExistingEmails() {
  try {
    const cmd = 'npx wrangler d1 execute ' + D1_DATABASE + ' --remote --json ' +
      '--command "SELECT lower(email) AS email FROM cold_outreach WHERE email != \'\'"';
    const out = execSync(cmd, {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024
    });
    const start = out.indexOf('[');
    const end = out.lastIndexOf(']');
    if (start === -1 || end === -1) return new Set();
    const parsed = JSON.parse(out.slice(start, end + 1));
    const rows = (parsed[0] && parsed[0].results) || [];
    return new Set(rows.map((r) => normalizeEmail(r.email)).filter(Boolean));
  } catch (e) {
    console.warn('  ! could not fetch existing emails (' + String(e.message).split('\n')[0] + '); continuing without de-dupe');
    return null; // null = "unknown", distinct from an empty set
  }
}

// ---------------------------------------------------------------- emit SQL
function buildRecords(args) {
  const dir = args.dir;
  const csvPath = process.env.GABOCHIE_MASTER_CSV || path.join(dir, '10_LEAD_DATABASE', 'gabochie_db_master.csv');
  if (!fs.existsSync(csvPath)) throw new Error('master CSV not found: ' + csvPath);

  const overrides = readJsonSafe(path.join(dir, '10_LEAD_DATABASE', 'status_overrides.json')) || {};
  const state = readJsonSafe(path.join(dir, '10_LEAD_DATABASE', 'outreach_state.json')) || { outcomes: {}, lastContact: {} };

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const header = rows.shift();
  const idx = {};
  header.forEach((h, i) => { idx[h.replace(/^\uFEFF/, '')] = i; });

  const stats = { totalRows: rows.length, noEmail: 0, badEmail: 0, excludedStatus: 0, alreadyContacted: 0, dupeEmail: 0, eligible: 0 };

  let existing = null;
  if (!args.noExisting) existing = fetchExistingEmails();
  const existingSet = existing || new Set();
  stats.existingInDb = existing === null ? 'unknown' : existingSet.size;

  const seen = new Set();
  const records = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < header.length) continue;
    const get = (k) => (idx[k] != null ? r[idx[k]] : '');
    const id = String(get('id') || '').trim();
    if (!id) continue;

    if (args.limit && records.length >= args.limit) break;

    const email = normalizeEmail(get('email'));
    if (!email) { stats.noEmail++; continue; }
    if (!isValidEmail(email)) { stats.badEmail++; continue; }

    const status = effectiveStatus(id, get('verified_status'), overrides);
    if (EXCLUDED_STATUS.has(status)) { stats.excludedStatus++; continue; }

    if (state.outcomes && state.outcomes[id]) { stats.alreadyContacted++; continue; }
    if (state.lastContact && state.lastContact[id]) { stats.alreadyContacted++; continue; }

    if (existingSet.has(email)) { stats.dupeEmail++; continue; }
    if (seen.has(email)) { stats.dupeEmail++; continue; }
    seen.add(email);

    records.push(mapRow({
      market: get('market'),
      diaspora_region: get('diaspora_region'),
      source: get('source'),
      record_type: get('record_type'),
      company: get('company'),
      firm_name: get('firm_name'),
      contact_name: get('contact_name'),
      phone: get('phone'),
      email,
      website: get('website'),
      region: get('region'),
      district: get('district'),
      location: get('location'),
      interest_tags: get('interest_tags')
    }, id));
  }

  stats.eligible = records.length;
  return { records, stats };
}

function writeSql(records, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const cols = '(name, email, phone, website, address, category, source, region, country, status, campaign, notes)';
  const files = [];
  let stmtBuffer = [];
  let stmtCount = 0;
  let fileIndex = 0;

  const flushFile = () => {
    if (!stmtBuffer.length) return;
    fileIndex++;
    const name = 'chunk-' + String(fileIndex).padStart(4, '0') + '.sql';
    const full = path.join(outDir, name);
    fs.writeFileSync(full, stmtBuffer.join('\n') + '\n', 'utf8');
    files.push(full);
    stmtBuffer = [];
    stmtCount = 0;
  };

  for (let i = 0; i < records.length; i += ROWS_PER_STATEMENT) {
    const chunk = records.slice(i, i + ROWS_PER_STATEMENT);
    const values = chunk.map((r) => '(' + [
      sqlStr(r.name), sqlStr(r.email), sqlStr(r.phone), sqlStr(r.website), sqlStr(r.address),
      sqlStr(r.category), sqlStr(SOURCE), sqlStr(r.region), sqlStr(r.country), sqlStr('pending'),
      sqlStr(CAMPAIGN), sqlStr(r.notes)
    ].join(', ') + ')').join(',\n  ');
    stmtBuffer.push('INSERT INTO cold_outreach ' + cols + ' VALUES\n  ' + values + ';');
    stmtCount++;
    if (stmtCount >= STATEMENTS_PER_FILE) flushFile();
  }
  flushFile();

  return files;
}

function applySql(files) {
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    process.stdout.write('  [' + (i + 1) + '/' + files.length + '] ' + path.basename(f) + ' ... ');
    try {
      const cmd = 'npx wrangler d1 execute ' + D1_DATABASE + ' --remote --file "' + f + '"';
      execSync(cmd, { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      console.log('ok');
    } catch (e) {
      console.log('FAILED');
      throw new Error('chunk failed: ' + path.basename(f) + '\n' + (e.stderr || e.message));
    }
  }
}

// ---------------------------------------------------------------- main
function main() {
  const args = parseArgs(process.argv);
  console.log('DBGabochie -> studio cold_outreach');
  console.log('  dir:   ' + args.dir);
  console.log('  out:   ' + args.out);
  console.log('  db:    ' + D1_DATABASE + (args.apply ? ' (apply)' : ' (dry-run)'));
  console.log('');

  const { records, stats } = buildRecords(args);
  console.log('Register scan:');
  console.log('  rows in CSV:        ' + stats.totalRows);
  console.log('  skipped no email:   ' + stats.noEmail);
  console.log('  skipped bad email:  ' + stats.badEmail);
  console.log('  skipped suppressed: ' + stats.excludedStatus);
  console.log('  skipped contacted:  ' + stats.alreadyContacted);
  console.log('  skipped duplicate:  ' + stats.dupeEmail + (stats.existingInDb !== 'unknown' ? ' (existing in DB: ' + stats.existingInDb + ')' : ''));
  console.log('  -> eligible:        ' + stats.eligible);
  console.log('');

  const files = writeSql(records, args.out);
  console.log('Wrote ' + files.length + ' SQL chunk file(s) to ' + args.out);

  if (!args.apply) {
    console.log('\nDry-run complete. Re-run with --apply to load into remote D1.');
    return;
  }

  console.log('\nApplying to remote D1 ...');
  applySql(files);
  console.log('\nDone. Verify with:');
  console.log('  npx wrangler d1 execute ' + D1_DATABASE + ' --remote --command "SELECT status, COUNT(*) FROM cold_outreach GROUP BY status"');
  console.log('\nNOTE: leads are loaded as status=\'pending\' and NOT sent. Arming the');
  console.log('Newsletter Campaign workflow (#42) is a separate, deliberate step.');
}

try { main(); } catch (e) { console.error('\nERROR: ' + e.message); process.exit(1); }
