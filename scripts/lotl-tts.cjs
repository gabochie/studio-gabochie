/* Render LOTL text scripts to mp3 (text -> audio).
 *
 * Reads love-of-the-lord/scripts/<service-id>.md ("## <stop>" sections) and
 * synthesizes the 7 spoken stops via OpenAI TTS. Output defaults to
 * <repo>/dist-audio/<service-id>/<stop>.mp3 (local only, gitignored).
 *
 * Requires OPENAI_API_KEY in the environment.
 *
 * Usage: node scripts/lotl-tts.cjs [service-id] [--out dir] [--voice name] [--model name]
 *   service-id defaults to this week's service from series.json (auto cadence).
 */

const fs = require('fs');
const path = require('path');
const process = require('process');

const root = path.join(__dirname, '..');
const lotl = path.join(root, 'love-of-the-lord');
const STOPS = ['welcome', 'announcements', 'offering', 'word', 'altar', 'prayer', 'benediction'];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function currentServiceId() {
  const series = JSON.parse(fs.readFileSync(path.join(lotl, 'series.json'), 'utf8'));
  const pairs = [];
  (series.seasons || []).forEach(function (s) {
    (s.services || []).forEach(function (svc) { pairs.push(svc); });
  });
  if (!pairs.length) throw new Error('no services in series.json');
  if (series.auto) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let due = null;
    pairs.forEach(function (svc) {
      const d = svc.date ? new Date(svc.date + 'T12:00:00') : null;
      if (d && !isNaN(d.getTime()) && d <= today) due = svc;
    });
    return (due || pairs[0]).id;
  }
  return series.current || pairs[0].id;
}

function sections(md) {
  const out = {};
  const parts = md.split(/^##\s+/m).slice(1);
  parts.forEach(function (p) {
    const nl = p.indexOf('\n');
    const name = (nl === -1 ? p : p.slice(0, nl)).trim().toLowerCase();
    const body = (nl === -1 ? '' : p.slice(nl + 1)).trim();
    if (name && body) out[name] = body;
  });
  return out;
}

async function synthesize(text, model, voice, key) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model, input: text, voice: voice, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error('TTS HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) {
    console.error('Missing OPENAI_API_KEY. Export it first (see .env / repo secrets).');
    process.exit(1);
  }
  const id = process.argv[2] && process.argv[2].indexOf('--') !== 0 ? process.argv[2] : currentServiceId();
  const outDir = path.resolve(root, arg('--out', 'dist-audio'));
  const model = arg('--model', 'tts-1');
  const voice = arg('--voice', 'alloy');

  const md = fs.readFileSync(path.join(lotl, 'scripts', id + '.md'), 'utf8');
  const secs = sections(md);
  const missing = STOPS.filter(function (s) { return !secs[s]; });
  if (missing.length) throw new Error(id + '.md is missing sections: ' + missing.join(', '));

  fs.mkdirSync(path.join(outDir, id), { recursive: true });
  for (const stop of STOPS) {
    const buf = await synthesize(secs[stop], model, voice, key);
    fs.writeFileSync(path.join(outDir, id, stop + '.mp3'), buf);
    console.log('tts ok: ' + id + '/' + stop + '.mp3 (' + buf.length + ' bytes)');
  }
  console.log('done — mp3s in ' + path.join(outDir, id));
}

main().catch(function (e) { console.error(e.message || e); process.exit(1); });
