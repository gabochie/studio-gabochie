/* Scaffold a full year of Love Of The Lord services.
 *
 * Cadence (approved): 4 quarterly series, a service every Sunday, and within
 * each month one "full sermon" anchor plus weekly "refresh" services
 * (admin/lotl.html). Weekly themes advance one per week from the quarter's
 * official 6 themes (admin/calendar.html LOTL_THEMES), matching the Monday
 * devotional rotation in love-of-the-lord/devotionals/devotionals.json.
 *
 * Produces:
 *   love-of-the-lord/series.json          — 4 seasons x 13 weekly services = 52
 *   love-of-the-lord/lineups/<id>.json    — one 9-stop lineup per service (002..052)
 *
 * service-001 keeps pointing at the root lineup.json (precached by sw.js and
 * pinned by the admin editor / e2e tests). Its file is never overwritten here.
 *
 * Spoken stops are wired to self-owned audio at
 *   /love-of-the-lord/audio/<service-id>/<stop-id>.mp3
 * which maps to the R2 key lotl/audio/<service-id>/<stop-id>.mp3 served by
 * functions/love-of-the-lord/audio/[[path]].js. Music stops stay on YouTube
 * because licensed worship is not distributed as mp3 (see the audio plan).
 *
 * Usage: node scripts/scaffold-lotl-year.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lotl = path.join(root, 'love-of-the-lord');
const lineupsDir = path.join(lotl, 'lineups');

const START = Date.UTC(2026, 9, 11); // Sunday 2026-10-11 (service-001)
const AUDIO_BASE = '/love-of-the-lord/audio/';

/* The 4 quarterly series and their official 6 weekly themes — mirrors
   admin/calendar.html LOTL_THEMES. Each theme carries its key verse. */
const SEASONS = [
  {
    id: 's1',
    title: 'Foundations of Grace',
    quarter: 'Q1 2026–27',
    verse: 'Lamentations 3:22-23 — His mercies are new every morning.',
    themes: [
      ['Grace for New Beginnings', 'Lamentations 3:22-23'],
      ['Mercy That Never Runs Out', 'Psalm 103:8-12'],
      ['The God Who Restores', 'Joel 2:25'],
      ['Faith Over Frustration', 'Psalm 34:18'],
      ['Rooted and Established', 'Colossians 2:6-7'],
      ['His Mercies Are New', 'Lamentations 3:23'],
    ],
  },
  {
    id: 's2',
    title: 'The Kingdom Mind',
    quarter: 'Q2 2026–27',
    verse: 'Matthew 6:33 — Seek first the kingdom of God and His righteousness.',
    themes: [
      ['Seek First the Kingdom', 'Matthew 6:33'],
      ['Kingdom Perspective on Money', 'Matthew 6:19-21'],
      ['A Renewed Mind', 'Romans 12:2'],
      ['Kingdom Ambition', 'Mark 10:43-45'],
      ['Citizens, Not Consumers', 'Philippians 3:20'],
      ['Think on These Things', 'Philippians 4:8'],
    ],
  },
  {
    id: 's3',
    title: 'Love in Action',
    quarter: 'Q3 2026–27',
    verse: 'John 13:34-35 — Love one another: by this all will know you are My disciples.',
    themes: [
      ['Love Your Neighbour', 'Mark 12:31'],
      ['Forgiveness That Frees', 'Ephesians 4:32'],
      ['Serving as Worship', 'Romans 12:1'],
      ['Marriage and Family', 'Joshua 24:15'],
      ['Generosity and Community', 'Acts 2:44-45'],
      ['Love as the Highest Apologetic', 'John 13:35'],
    ],
  },
  {
    id: 's4',
    title: 'Hope and Harvest',
    quarter: 'Q4 2026–27',
    verse: 'Romans 15:13 — May the God of hope fill you with all joy and peace.',
    themes: [
      ['Hope That Does Not Disappoint', 'Romans 5:5'],
      ['Sowing and Reaping', 'Galatians 6:7'],
      ['Faith in the Waiting', 'Psalm 27:14'],
      ['Thanksgiving and Praise', 'Psalm 100:4'],
      ['Carry the Fire', 'Leviticus 6:13'],
      ['The End of the Matter', 'Ecclesiastes 12:13'],
    ],
  },
];

function audio(sid, stop) {
  return { type: 'audio', src: AUDIO_BASE + sid + '/' + stop + '.mp3', note: 'Add self-owned mp3' };
}

function stopList(sid, theme, cadence) {
  const wordMinutes = cadence === 'full' ? 25 : 15;
  return [
    { id: 'welcome', n: 1, title: 'Welcome & Opening Prayer', desc: 'Gideon welcomes you + opening prayer. You are home.', minutes: 3, media: audio(sid, 'welcome'), prompt: 'Where are you watching from? Whisper it — God sees you.', short: 'Welcome' },
    { id: 'praise', n: 2, title: 'Praise — High Energy', desc: '2 upbeat songs. Stand up, clap, lyrics on screen.', minutes: 12, media: { type: 'youtube', playlist: '', note: 'Add 2 praise YouTube IDs (unlisted LOTL Full playlist)' }, lyrics: ['This is the day the Lord has made — we will rejoice!', 'Praise Him with dancing and song!'], prompt: 'Stand up wherever you are — clap those hands!', short: 'Praise' },
    { id: 'worship', n: 3, title: 'Worship — Slow & Intimate', desc: '1 slow song. Dim lights moment. Hand on chest.', minutes: 8, media: { type: 'youtube', playlist: '', note: 'Add 1 slow worship YouTube ID' }, prompt: 'Whisper His name — Jesus… He is here.', short: 'Worship' },
    { id: 'announcements', n: 4, title: 'Announcements & New Friends', desc: "This week's answers, school gift, how to belong.", minutes: 3, media: audio(sid, 'announcements'), cards: [{ t: 'New here? Tap I\'m New', d: 'We pray for every new name this week. No spam, just love.' }, { t: 'Friday Answers', d: '3 real-life questions answered from the Bible — with your TikToks seeded in.' }, { t: 'Free gift: Module 1', d: 'School of Creativity, Love & Wisdom — start free, no card.' }], short: 'News' },
    { id: 'offering', n: 5, title: 'Offering — Give with Love', desc: 'Separate LOTL fund. Cheerful, no pressure.', minutes: 3, verse: '2 Cor 9:7 — God loves a cheerful giver.', momo: { name: 'Gideon Abochie', network: 'MTN', number: '024 326 2019' }, media: audio(sid, 'offering'), short: 'Giving' },
    { id: 'word', n: 6, title: 'The Word', desc: (cadence === 'full' ? 'Full sermon: ' : 'Refresh: ') + theme + ' (' + wordMinutes + ' min). Notebook open.', minutes: wordMinutes, media: audio(sid, 'word'), takeaways: ['Mercy resets every morning.', 'Frustration is a question — the Bible has answers.', 'Write one obedient step for this week.'], short: 'Word' },
    { id: 'altar', n: 7, title: 'Altar Call', desc: "Sinner's prayer line-by-line. Tap I Gave My Life Today.", minutes: 5, prayer: 'Lord Jesus, I believe You died for me. Wash me with Your blood. Come into my heart. Make me new. I am Yours from today. Amen!', media: audio(sid, 'altar'), short: 'Altar' },
    { id: 'prayer', n: 8, title: 'Prayer + Q&A', desc: 'Book a free 15-min prayer call. Ask your life question.', minutes: 5, media: audio(sid, 'prayer'), slots: ['Tue 10:00', 'Tue 10:30', 'Tue 11:00', 'Tue 11:30', 'Thu 10:00', 'Thu 10:30', 'Thu 11:00', 'Thu 11:30', 'Sat 09:00', 'Sat 09:30', 'Sat 10:00', 'Sat 10:30'], contact: { email: 'love@gabochie.com', phone: '+233243262019', whatsapp: 'https://wa.me/233243262019' }, short: 'Prayer' },
    { id: 'benediction', n: 9, title: 'Benediction & Share', desc: 'Blessing + invite a friend with your link (?ref=).', minutes: 2, blessing: 'May the Lord bless you and keep you. May His face shine on you. Go in love, live with wisdom.', media: audio(sid, 'benediction'), short: 'Blessing' },
  ];
}

function serviceId(i) {
  return 'service-' + String(i + 1).padStart(3, '0');
}

function weekDate(i) {
  return new Date(START + i * 7 * 86400000).toISOString().slice(0, 10);
}

/* First Sunday of the month (day 1-7) is the monthly full-sermon anchor;
   every other Sunday is a weekly refresh. */
function cadenceFor(date) {
  return parseInt(date.slice(8, 10), 10) <= 7 ? 'full' : 'refresh';
}

function build() {
  const series = { updated: '2026-10-11', current: 'service-001', auto: true, seasons: [] };
  let global = 0;

  SEASONS.forEach(function (season) {
    const seasonOut = { id: season.id, n: series.seasons.length + 1, title: season.title, quarter: season.quarter, verse: season.verse, services: [] };
    for (let n = 0; n < 13; n++) {
      const id = serviceId(global);
      const theme = season.themes[n % season.themes.length];
      const title = theme[0];
      const verse = theme[1];
      const date = weekDate(global);
      const cadence = cadenceFor(date);
      // service-001 keeps the root lineup.json (precached + pinned by tests).
      const lineup = id === 'service-001' ? 'lineup.json' : 'lineups/' + id + '.json';
      seasonOut.services.push({ id: id, n: n + 1, title: title, theme: title, series: season.title, date: date, cadence: cadence, theme_verse: verse, lineup: lineup });
      if (id !== 'service-001') {
        const doc = {
          service: { id: id, title: title, theme_verse: verse, series: season.title, cadence: cadence, mode_full_minutes: 60, mode_express_minutes: 15, express_stop_ids: ['welcome', 'praise', 'word', 'altar'], season: season.title },
          stops: stopList(id, title, cadence),
        };
        fs.writeFileSync(path.join(lineupsDir, id + '.json'), JSON.stringify(doc, null, 2) + '\n');
      }
      global += 1;
    }
    series.seasons.push(seasonOut);
  });

  fs.writeFileSync(path.join(lotl, 'series.json'), JSON.stringify(series, null, 2) + '\n');
  return global;
}

fs.mkdirSync(lineupsDir, { recursive: true });
const total = build();
console.log('series.json + lineups regenerated — ' + total + ' service(s), ' + (total - 1) + ' lineup file(s).');
