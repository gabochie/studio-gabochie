/* Write the text-first source for LOTL audio: one Markdown file per service.
 *
 * Reads love-of-the-lord/series.json and writes
 *   love-of-the-lord/scripts/<service-id>.md
 * with a "## <stop>" section for each of the 7 spoken stops
 * (welcome, announcements, offering, word, altar, prayer, benediction).
 *
 * scripts/lotl-tts.cjs later reads these sections and renders them to mp3.
 * Files containing "<!-- locked -->" are never overwritten, so hand-written
 * services (e.g. service-001) survive regeneration.
 *
 * Usage: node scripts/write-lotl-scripts.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lotl = path.join(root, 'love-of-the-lord');
const scriptsDir = path.join(lotl, 'scripts');
const LOCKED = '<!-- locked -->';

function welcome(svc) {
  return (
    'Welcome home, family. I am Gideon, and this is Love Of The Lord — church anytime, anywhere. ' +
    'Today we gather around ' + svc.theme + '. The Word says: ' + svc.theme_verse + '. ' +
    'Wherever you are watching from — your room, a bus, a market stall — whisper it: God sees you. You are home. ' +
    "Let's open in prayer. Father, we give You this time. Speak to every heart, heal every wound, and let no one leave the same. " +
    "In Jesus' name. Amen. The service has begun — stay with me."
  );
}

function announcements() {
  return (
    'Family, hear this. First, if you are new here, tap I am New — we pray for every new name this week, no spam, just love. ' +
    'Second, Friday Answers: three real-life questions answered from the Bible, with your voice notes and TikToks. Send your question today. ' +
    'Third, a free gift: Module One of the School of Creativity, Love and Wisdom — start free, no card. ' +
    "Links are below. Now, let's give."
  );
}

function offering() {
  return (
    'We give because we love. This offering supports the Love Of The Lord fund — data, prayer calls, and the free school. ' +
    'Give cheerfully, no pressure, no amount too small. God loves a cheerful giver. ' +
    'You can give with MTN MoMo to Gideon Abochie: zero two four, three two six, two zero one nine. ' +
    'Every cedi is prayed over. Thank you for building with us.'
  );
}

function word(svc) {
  const kind = svc.cadence === 'full' ? 'Full sermon' : 'Refresh';
  const minutes = svc.cadence === 'full' ? 'twenty-five' : 'fifteen';
  return (
    kind + ' today: ' + svc.theme + '. Open your Bible to ' + svc.theme_verse + '. ' +
    'Hear what the Spirit is saying to us this week. ' +
    'First, receive the word with an open heart — not as information, but as food. ' +
    'Second, let it search you: where does this verse meet your real life — your work, your family, your fears? ' +
    'Third, obey one thing. Not ten. One. ' +
    'Here is your step for the week: write down one obedient action from this word, tell one person, and do it before Friday. ' +
    "Let's pray. Father, plant this word deep. Water it through the week and make it fruit in our lives. In Jesus' name. Amen. " +
    '(' + minutes + '-minute teaching slot. Expand this draft to a full manuscript before recording.)'
  );
}

function altar() {
  return (
    'If you have never given your life to Jesus, or you drifted and want to come home, this moment is yours. ' +
    'Pray this with me, line by line, out loud. Lord Jesus. I believe You died for me. Wash me with Your blood. ' +
    "Come into my heart. Make me new. I am Yours from today. Amen. If you prayed that, tap I Gave My Life Today — " +
    'heaven is rejoicing, and we want to pray with you this week.'
  );
}

function prayer() {
  return (
    "You don't have to carry it alone. Book a free fifteen-minute prayer call — Tuesdays, Thursdays, and Saturday mornings. " +
    'Or send your question for Friday Answers. Right now, receive this: May the Lord answer you in the day of trouble. ' +
    'May He send help from His sanctuary. Your battle is not yours alone. Breathe. God is already in your tomorrow.'
  );
}

function benediction(svc) {
  return (
    'Receive the blessing. May the Lord bless you and keep you. May His face shine on you and be gracious to you. ' +
    'May He lift His countenance upon you and give you peace. Go in love, live with wisdom, and carry ' + svc.theme + ' into your week. ' +
    'Share this service with one friend using your invite link. We love you — see you next Sunday. Amen.'
  );
}

function doc(svc) {
  const lines = [
    '# ' + svc.id + ' — ' + svc.title,
    'date: ' + svc.date + ' · cadence: ' + svc.cadence + ' · series: ' + svc.series + ' · verse: ' + svc.theme_verse,
    '',
    '## welcome',
    welcome(svc),
    '',
    '## announcements',
    announcements(),
    '',
    '## offering',
    offering(),
    '',
    '## word',
    word(svc),
    '',
    '## altar',
    altar(),
    '',
    '## prayer',
    prayer(),
    '',
    '## benediction',
    benediction(svc),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const series = JSON.parse(fs.readFileSync(path.join(lotl, 'series.json'), 'utf8'));
  fs.mkdirSync(scriptsDir, { recursive: true });
  let wrote = 0;
  let skipped = 0;
  (series.seasons || []).forEach(function (season) {
    (season.services || []).forEach(function (svc) {
      const file = path.join(scriptsDir, svc.id + '.md');
      let existing = '';
      try { existing = fs.readFileSync(file, 'utf8'); } catch (_e) { existing = ''; }
      if (existing.indexOf(LOCKED) !== -1) { skipped += 1; return; }
      fs.writeFileSync(file, doc(svc));
      wrote += 1;
    });
  });
  console.log('scripts written: ' + wrote + ', locked (kept): ' + skipped + '.');
}

main();
