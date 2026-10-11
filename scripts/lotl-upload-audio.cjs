/* Upload a week's LOTL mp3s to R2 (audio -> cloud).
 *
 * Pushes dist-audio/<service-id>/<stop>.mp3 to the gahq-books bucket at
 * lotl/audio/<service-id>/<stop>.mp3, where the audio endpoint
 * (functions/love-of-the-lord/audio/[[path]].js) serves them. The player
 * picks them up automatically via each lineup's media.src — no code change.
 * Requires wrangler auth (CLOUDFLARE_API_TOKEN).
 *
 * Usage: node scripts/lotl-upload-audio.cjs [service-id] [--dir dist-audio]
 *   service-id defaults to this week's service from series.json (auto cadence).
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const lotl = path.join(root, 'love-of-the-lord');
const STOPS = ['welcome', 'announcements', 'offering', 'word', 'altar', 'prayer', 'benediction'];
const BUCKET = 'gahq-books';

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

function main() {
  const id = process.argv[2] && process.argv[2].indexOf('--') !== 0 ? process.argv[2] : currentServiceId();
  const dir = path.resolve(root, arg('--dir', 'dist-audio'));
  const missing = STOPS.map(function (s) { return path.join(dir, id, s + '.mp3'); })
    .filter(function (f) { return !fs.existsSync(f); });
  if (missing.length) {
    console.error('missing mp3s for ' + id + ' — run: node scripts/lotl-tts.cjs ' + id);
    missing.forEach(function (f) { console.error('  ' + f); });
    process.exit(1);
  }
  STOPS.forEach(function (stop) {
    const key = 'lotl/audio/' + id + '/' + stop + '.mp3';
    const file = path.join(dir, id, stop + '.mp3');
    execSync('npx wrangler r2 object put ' + BUCKET + '/' + key + ' --file="' + file + '"', { stdio: 'inherit' });
    console.log('uploaded: ' + key);
  });
  console.log('done — ' + id + ' plays automatically (series auto-cadence).');
}

try { main(); } catch (e) { console.error(e.message || e); process.exit(1); }
