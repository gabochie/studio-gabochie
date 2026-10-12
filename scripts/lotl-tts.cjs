/* Render LOTL text scripts to mp3 (text -> audio), with free fallbacks.
 *
 * Reads love-of-the-lord/scripts/<service-id>.md ("## <stop>" sections) and
 * synthesizes the 7 spoken stops. Output: <repo>/dist-audio/<id>/<stop>.mp3
 * (local only, gitignored) — always MP3 so players, lineups and R2 need no changes.
 *
 * Providers (--provider openai|edge|gemini|elevenlabs|piper|auto):
 *   openai     OPENAI_API_KEY, pay-as-you-go (tts-1/alloy defaults). Best quality.
 *   edge       FREE, no key. Microsoft neural voices via Python edge-tts.
 *              Default voice en-US-GuyNeural (male); override with --voice
 *              (e.g. en-NG-AbeoNeural). Needs: python3 + `pip install edge-tts`.
 *   gemini     Google AI Studio FREE tier. GEMINI_API_KEY.
 *              Model gemini-2.5-flash-preview-tts; default voice Charon (male).
 *   elevenlabs Free tier 10k chars/mo. ELEVENLABS_API_KEY.
 *              Default voice Adam (pNInz6obpgDQGcFmaJgB, male); override with --voice ID.
 *   piper      Fully offline, free forever, no key. Needs piper binary + voice model:
 *              set PIPER_BIN and PIPER_MODEL (or --piper-bin/--piper-model).
 *              Suggested deep male models: en_US-lessac-medium, en_US-ryan-medium,
 *              en_US-danny-low. Pace via --length-scale (default 1.0; 1.1-1.2 = weightier).
 *   auto       (default) openai if key -> edge always -> gemini/elevenlabs/piper
 *              if configured. OpenAI quota/auth failures fall through to free Edge,
 *              so rendering never dies on an empty balance.
 *
 * Usage: node scripts/lotl-tts.cjs [service-id] [--out dir] [--provider p]
 *        [--voice v] [--model m] [--only welcome,word] [--piper-bin b] [--piper-model m]
 *        [--length-scale x (piper pace; >1 slower/deeper, e.g. 1.12)]
 *   service-id defaults to this week's service from series.json (auto cadence).
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const lotl = path.join(root, 'love-of-the-lord');
const STOPS = ['welcome', 'announcements', 'offering', 'word', 'altar', 'prayer', 'benediction'];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && process.argv[i + 1].indexOf('--') !== 0 ? process.argv[i + 1] : fallback;
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
  md.split(/^##\s+/m).slice(1).forEach(function (p) {
    const nl = p.indexOf('\n');
    const name = (nl === -1 ? p : p.slice(0, nl)).trim().toLowerCase();
    const body = (nl === -1 ? '' : p.slice(nl + 1)).replace(/\s+/g, ' ').trim();
    if (name && body) out[name] = body;
  });
  return out;
}

function readBody(res) {
  try { return Buffer.isBuffer(res) ? res.toString('utf8') : String(res); } catch (_e) { return ''; }
}

function httpError(status, body, what) {
  const err = new Error(what + ' HTTP ' + status + ': ' + readBody(body).slice(0, 200));
  err.status = status;
  return err;
}

/* ---------- mp3 encoding (for PCM/WAV providers) ---------- */

function lameEncode(int16, sampleRate) {
  // MP3 via ffmpeg (present on dev machines; required only for PCM/WAV
  // providers like Gemini/Piper — OpenAI/Edge/ElevenLabs return MP3 natively).
  const osTmp = require('os').tmpdir();
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const raw = path.join(osTmp, 'pcm-' + stamp + '.raw');
  const mp3 = path.join(osTmp, 'pcm-' + stamp + '.mp3');
  const buf = Buffer.alloc(int16.length * 2);
  for (let i = 0; i < int16.length; i++) buf.writeInt16LE(int16[i], i * 2);
  fs.writeFileSync(raw, buf);
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', raw, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3], { stdio: 'pipe', timeout: 300000 });
    const out = fs.readFileSync(mp3);
    if (!out.length) throw new Error('ffmpeg produced an empty mp3.');
    return out;
  } catch (e) {
    if (e && e.code === 'ENOENT') throw new Error('ffmpeg not found (required for Gemini/Piper MP3 encoding).');
    throw e;
  } finally {
    try { fs.unlinkSync(raw); } catch (_e) {}
    try { fs.unlinkSync(mp3); } catch (_e2) {}
  }
}

function bufferToInt16LE(buf) {
  const n = Math.floor(buf.length / 2);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

function parseWav(buf) {
  const riff = buf.toString('ascii', 0, 4);
  if (riff !== 'RIFF') throw new Error('not a WAV file');
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  let dataOff = 44;
  const dataAt = buf.indexOf('data');
  if (dataAt !== -1) dataOff = dataAt + 8;
  return { channels: channels, sampleRate: sampleRate, pcm: buf.slice(dataOff) };
}

/* ---------- providers (each resolves to an MP3 Buffer) ---------- */

async function synthOpenAI(text, model, voice, key) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model, input: text, voice: voice, response_format: 'mp3' }),
  });
  if (!res.ok) throw httpError(res.status, await res.text(), 'OpenAI TTS');
  return Buffer.from(await res.arrayBuffer());
}

function checkEdge() {
  try {
    execFileSync('python3', ['-m', 'edge_tts', '--version'], { stdio: 'pipe', timeout: 20000 });
    return true;
  } catch (_e) {
    return false;
  }
}

async function synthEdge(text, voice, workDir) {
  if (!checkEdge()) {
    throw new Error('Edge TTS needs Python edge-tts (`python3 -m pip install edge-tts`) and internet.');
  }
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const txt = path.join(workDir, 'edge-' + stamp + '.txt');
  const mp3 = path.join(workDir, 'edge-' + stamp + '.mp3');
  fs.writeFileSync(txt, text, 'utf8');
  try {
    execFileSync('python3', ['-c',
      "import asyncio,sys;from edge_tts import Communicate;" +
      "asyncio.run(Communicate(open(sys.argv[1],encoding='utf-8').read(),sys.argv[2]).save(sys.argv[3]))",
      txt, voice, mp3,
    ], { stdio: 'pipe', timeout: 300000 });
    const buf = fs.readFileSync(mp3);
    if (!buf.length) throw new Error('Edge TTS produced an empty file.');
    return buf;
  } finally {
    try { fs.unlinkSync(txt); } catch (_e) {}
    try { fs.unlinkSync(mp3); } catch (_e2) {}
  }
}

async function synthGemini(text, model, voice, key) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) throw httpError(res.status, await res.text(), 'Gemini TTS');
  const d = await res.json();
  const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
  const audio = parts.find(function (pt) { return pt.inlineData && pt.inlineData.data; });
  if (!audio) throw new Error('Gemini TTS returned no audio (safety filter or quota?).');
  const mime = audio.inlineData.mimeType || '';
  const rate = (mime.match(/rate=(\d+)/) || [])[1] || 24000;
  const pcm = Buffer.from(audio.inlineData.data, 'base64');
  return lameEncode(bufferToInt16LE(pcm), parseInt(rate, 10));
}

async function synthElevenLabs(text, voiceId, key) {
  const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId), {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw httpError(res.status, await res.text(), 'ElevenLabs TTS');
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('ElevenLabs TTS produced an empty file.');
  return buf;
}

function findPiperBin(explicit) {
  const cands = [];
  if (explicit) cands.push(explicit);
  if (process.env.PIPER_BIN) cands.push(process.env.PIPER_BIN);
  cands.push(path.join(root, 'tools', process.platform === 'win32' ? 'piper.exe' : 'piper'));
  cands.push('piper');
  for (const c of cands) {
    try {
      execFileSync(c, ['--help'], { stdio: 'pipe', timeout: 15000 });
      return c;
    } catch (_e) { /* try next */ }
  }
  return null;
}

async function synthPiper(text, bin, model, workDir, lengthScale) {
  if (!bin) {
    throw new Error('Piper not found. Download the binary (github.com/rhasspy/piper releases) + a voice model (e.g. en_US-lessac-medium from HuggingFace), then pass --piper-bin/--piper-model or set PIPER_BIN/PIPER_MODEL.');
  }
  if (!model || !fs.existsSync(model)) {
    throw new Error('Piper voice model missing. Set --piper-model to a .onnx file (e.g. en_US-lessac-medium.onnx).');
  }
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const txt = path.join(workDir, 'piper-' + stamp + '.txt');
  const wav = path.join(workDir, 'piper-' + stamp + '.wav');
  fs.writeFileSync(txt, text, 'utf8');
  try {
    const input = fs.readFileSync(txt);
    execFileSync(bin, ['--model', model, '--length_scale', String(lengthScale || '1.0'), '--output_file', wav], { input: input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 });
    const raw = fs.readFileSync(wav);
    const parsed = parseWav(raw);
    const samples = bufferToInt16LE(parsed.pcm);
    const mono = parsed.channels === 1 ? samples : downmix(samples, parsed.channels);
    return lameEncode(mono, parsed.sampleRate);
  } finally {
    try { fs.unlinkSync(txt); } catch (_e) {}
    try { fs.unlinkSync(wav); } catch (_e2) {}
  }
}

function downmix(interleaved, channels) {
  const n = Math.floor(interleaved.length / channels);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += interleaved[i * channels + c];
    out[i] = Math.max(-32768, Math.min(32767, Math.round(s / channels)));
  }
  return out;
}

/* ---------- orchestration ---------- */

async function synthWith(provider, text, opts) {
  switch (provider) {
    case 'openai':
      if (!opts.openaiKey) throw new Error('OPENAI_API_KEY is not set.');
      return synthOpenAI(text, opts.model, opts.voice, opts.openaiKey);
    case 'edge':
      return synthEdge(text, opts.edgeVoice, opts.workDir);
    case 'gemini':
      if (!opts.geminiKey) throw new Error('GEMINI_API_KEY is not set.');
      return synthGemini(text, opts.geminiModel, opts.geminiVoice, opts.geminiKey);
    case 'elevenlabs':
      if (!opts.elevenKey) throw new Error('ELEVENLABS_API_KEY is not set.');
      return synthElevenLabs(text, opts.elevenVoice, opts.elevenKey);
    case 'piper':
      return synthPiper(text, findPiperBin(opts.piperBin), opts.piperModel, opts.workDir, opts.piperLength);
    default:
      throw new Error('Unknown provider: ' + provider);
  }
}

async function main() {
  const id = process.argv[2] && process.argv[2].indexOf('--') !== 0 ? process.argv[2] : currentServiceId();
  const outDir = path.resolve(root, arg('--out', 'dist-audio'));
  let provider = arg('--provider', 'auto');
  const only = (arg('--only', '') || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  const stops = only.length ? STOPS.filter(function (s) { return only.indexOf(s) !== -1; }) : STOPS;
  if (only.length && !stops.length) throw new Error('No matching stops for --only ' + only.join(','));

  const opts = {
    openaiKey: process.env.OPENAI_API_KEY || '',
    model: arg('--model', 'tts-1'),
    voice: arg('--voice', 'alloy'),
    edgeVoice: arg('--voice', 'en-US-GuyNeural'),
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: arg('--model', 'gemini-2.5-flash-preview-tts'),
    geminiVoice: arg('--voice', 'Charon'),
    elevenKey: process.env.ELEVENLABS_API_KEY || '',
    elevenVoice: arg('--voice', 'pNInz6obpgDQGcFmaJgB'),
    piperBin: arg('--piper-bin', ''),
    piperModel: arg('--piper-model', process.env.PIPER_MODEL || ''),
    piperLength: arg('--length-scale', '1.0'),
    workDir: path.resolve(root, arg('--out', 'dist-audio')),
  };
  // Note: --voice is shared; provider-specific aliases above resolve in order.
  // Re-resolve so an explicit --voice wins for the chosen provider family:
  const cliVoice = arg('--voice', '');
  if (cliVoice) { opts.voice = cliVoice; opts.edgeVoice = cliVoice; opts.geminiVoice = cliVoice; opts.elevenVoice = cliVoice; }

  const md = fs.readFileSync(path.join(lotl, 'scripts', id + '.md'), 'utf8');
  const secs = sections(md);
  const missing = stops.filter(function (s) { return !secs[s]; });
  if (missing.length) throw new Error(id + '.md is missing sections: ' + missing.join(', '));

  fs.mkdirSync(path.join(outDir, id), { recursive: true });
  const osTmp = require('os').tmpdir();
  opts.workDir = fs.mkdtempSync(path.join(osTmp, 'lotl-tts-'));

  const order = provider === 'auto'
    ? ['openai', 'edge', 'gemini', 'elevenlabs', 'piper']
    : [provider];

  for (const stop of stops) {
    let buf = null;
    let used = '';
    let lastErr = null;
    for (const p of order) {
      if (p === 'openai' && !opts.openaiKey) continue;
      if (p === 'gemini' && !opts.geminiKey) continue;
      if (p === 'elevenlabs' && !opts.elevenKey) continue;
      try {
        buf = await synthWith(p, secs[stop], opts);
        used = p;
        break;
      } catch (e) {
        lastErr = e;
        console.log('provider ' + p + ' failed for ' + stop + ': ' + (e.message || e));
        if (provider !== 'auto') throw e;
      }
    }
    if (!buf) {
      throw new Error('No working TTS provider for ' + stop + '. Configure one: export OPENAI_API_KEY (paid), or use free Edge (`pip install edge-tts`), GEMINI_API_KEY (free tier), ELEVENLABS_API_KEY (free tier), or Piper (offline). Last error: ' + ((lastErr && lastErr.message) || lastErr));
    }
    fs.writeFileSync(path.join(outDir, id, stop + '.mp3'), buf);
    console.log('tts ok [' + used + ']: ' + id + '/' + stop + '.mp3 (' + buf.length + ' bytes)');
  }
  try { fs.rmSync(opts.workDir, { recursive: true, force: true }); } catch (_e) {}
  console.log('done — mp3s in ' + path.join(outDir, id));
}

main().catch(function (e) { console.error(e.message || e); process.exit(1); });
