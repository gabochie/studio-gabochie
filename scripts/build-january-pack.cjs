/* Build January 2027 PDD pack — Focus on The Love of The Lord.
 * Hybrid blend: keep series.json service titles, lens every day through
 * Month 1: The Eternal Source (pre-creation love) + PDD 7-day rhythm.
 * Outputs:
 *   love-of-the-lord/daily/2027-01.json          — machine-readable (app + audio)
 *   love-of-the-lord/daily/2027-01-pack.md       — human-readable (app + sermon + journal)
 *   love-of-the-lord/daily/2027-01-audio.md      — per-day TTS scripts (## decree)
 * Usage: node scripts/build-january-pack.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'love-of-the-lord', 'daily');

const INTRO = 'Heavenly Father, we thank You for this brand-new day and the opportunity to gather as family in Your presence. Your mercies are new every morning. Forgive us our sins and trespasses, and we forgive all who trespassed against us. We stand cleansed by the blood of Jesus.';
const OUTRO = 'You have spoken life into your day. Walk boldly in the love of the Lord. You are blessed, covered, and victorious.';

const WEEKS = [
  { service: 'service-013', date: '2027-01-03', title: 'Grace for New Beginnings', verse: 'Lamentations 3:22-23' },
  { service: 'service-014', date: '2027-01-10', title: 'Seek First the Kingdom', verse: 'Matthew 6:33' },
  { service: 'service-015', date: '2027-01-17', title: 'Kingdom Perspective on Money', verse: 'Matthew 6:19-21' },
  { service: 'service-016', date: '2027-01-24', title: 'A Renewed Mind', verse: 'Romans 12:2' },
  { service: 'service-017', date: '2027-01-31', title: 'Kingdom Ambition', verse: 'Mark 10:43-45' },
];

const CORE = [
  { ref: '1 John 4:8, 16', text: 'God is love. Whoever lives in love lives in God, and God in them.', angle: 'Love is not what God does; it is who He is. Before creation, before your performance, He was love.' },
  { ref: 'Jeremiah 31:3', text: 'I have loved you with an everlasting love; I have drawn you with unfailing kindness.', angle: 'Everlasting means no start date. His love predates your birth, your failure, and your religion.' },
  { ref: 'Ephesians 3:18-19', text: 'To grasp how wide and long and high and deep is the love of Christ, and to know this love that surpasses knowledge.', angle: 'The love of the Lord has dimensions. You will never finish exploring it in one year — but you can start today.' },
  { ref: 'John 3:16', text: 'For God so loved the world that he gave his one and only Son.', angle: 'Eternal love always gives. The Father proved pre-creation love at the cross.' },
  { ref: 'Romans 5:8', text: 'While we were still sinners, Christ died for us.', angle: 'He did not wait for you to improve. Eternal love moves first.' },
  { ref: 'Deuteronomy 7:7-8', text: 'The Lord did not set his affection on you because you were numerous; it was because the Lord loved you.', angle: 'You were chosen by affection, not by size, skill, or tribe. Rest from striving.' },
  { ref: 'Psalm 136:1', text: 'Give thanks to the Lord, for he is good. His love endures forever.', angle: 'Hesed — covenant love that refuses to quit. Repeat it until your heart believes it.' },
  { ref: 'Romans 8:38-39', text: 'Nothing shall be able to separate us from the love of God in Christ Jesus.', angle: 'No failure, no demon, no economy, no past can cut this love. It is separation-proof.' },
  { ref: 'Isaiah 54:10', text: 'Though the mountains be shaken, my unfailing love for you will not be shaken.', angle: 'Feelings shake; His love does not. Build on the unshakable.' },
  { ref: '1 John 3:1', text: 'See what great love the Father has lavished on us, that we should be called children of God.', angle: 'Lavished — poured beyond measure. You are not a servant begging; you are a child belonging.' },
];

const DIMS = {
  Spiritual: { label: 'Spiritual Strength & Growth', prayer: 'Fill me with hunger for Your Word. Let my faith rise, my prayer catch fire, and my roots go deep in Your love.', declaration: 'I am rooted and established in the eternal love of God.', action: 'Read your day scripture aloud 3x and write one obedience step.' },
  Mental: { label: 'Mental Maturity & Clarity', prayer: 'Give me the mind of Christ. Cast down confusion and guard my thoughts with Your perfect peace.', declaration: 'I have the mind of Christ; confusion has no hold on me.', action: 'Replace one anxious thought with the day verse — speak it out loud.' },
  Physical: { label: 'Physical Strength & Endurance', prayer: 'Strengthen this temple. Give me vitality and endurance to run my race to the crown.', declaration: 'My body is the temple of the Holy Spirit; divine health is my portion.', action: 'Walk 10 minutes praying the declaration; honour rest and water today.' },
  Social: { label: 'Deeper Love for All Humanity', prayer: 'Shed Your love abroad in my heart. Let me see people through the eyes of Jesus.', declaration: 'I am a conduit of God’s love to humanity today.', action: 'Do one deliberate kindness for someone unlovable or overlooked.' },
  Financial: { label: 'Wisdom for the Abundant Life', prayer: 'Give me wisdom to steward resources well. Break scarcity; teach me generosity.', declaration: 'I walk in Kingdom abundance to be a blessing.', action: 'Review one money choice; give or save as worship today.' },
  Warfare: { label: 'Spiritual Warfare (Praying the Scriptures)', prayer: 'I put on the whole armour of God. No weapon formed against me shall prosper (Isaiah 54:17). I trample all the power of the enemy (Luke 10:19) and pull down every stronghold (2 Corinthians 10:4-5). Angels guard me in all my ways (Psalm 91:11).', declaration: 'I enforce the victory of the cross over my life and family today.', action: 'Speak Ephesians 6:10-11 aloud; cancel one fear by name.' },
  Sabbath: { label: 'Sabbath Rest & Alignment', prayer: 'I enter Your rest (Genesis 2:3). I lay down heavy yokes (Matthew 11:28). Lead me beside still waters and restore my soul (Psalm 23). Renew my strength as I wait on You (Isaiah 40:31).', declaration: 'I rest in the finished work of Jesus; I am aligned for the week ahead.', action: 'Take 15 screen-free minutes in His presence; journal one gratitude.' },
};

// Jan 1 2027 = Friday. Order Fri..Sun then repeating Mon..Sun.
function dimForDayOfWeek(dow) {
  // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
  return ({ 0: 'Sabbath', 1: 'Spiritual', 2: 'Mental', 3: 'Physical', 4: 'Social', 5: 'Financial', 6: 'Warfare' })[dow];
}

function weekForDate(iso) {
  let w = WEEKS[0];
  WEEKS.forEach(function (x) { if (iso >= x.date) w = x; });
  // Jan 1-2 belong to week 1 prologue
  return w;
}

const days = [];
for (let d = 1; d <= 31; d++) {
  const iso = '2027-01-' + String(d).padStart(2, '0');
  const dt = new Date(Date.UTC(2027, 0, d));
  const dow = dt.getUTCDay();
  const dim = dimForDayOfWeek(dow);
  const core = CORE[(d - 1) % CORE.length];
  const wk = weekForDate(iso);
  const meta = DIMS[dim];
  const teaching = core.angle + ' This week we carry "' + wk.title + '" (' + wk.verse + '): eternal love is the source that makes seeking the Kingdom possible. ' + meta.label + ' flows from being loved first — not striving to be loved. Let ' + core.ref + ' settle you: ' + core.text;
  const decree = meta.declaration + ' ' + core.text + ' In Jesus\u2019 name, Amen.';
  days.push({
    id: 'pdd-2027-01-' + String(d).padStart(2, '0'),
    date: iso,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
    monthTheme: 'The Eternal Source (Pre-creation love)',
    service: wk.service,
    serviceTheme: wk.title,
    dimension: dim,
    dimensionLabel: meta.label,
    scripture: core.ref,
    verse: core.text,
    teaching: teaching,
    prayer: INTRO + ' ' + meta.prayer,
    declaration: meta.declaration,
    decree: decree,
    action: meta.action,
    audioScript: 'Good morning, family of God. Welcome to today\u2019s decree on the love of the Lord. ' + INTRO + ' ' + teaching + ' Now declare: ' + decree + ' ' + OUTRO,
  });
}

const sermons = [
  { id: 'jan-sun-01', date: '2027-01-03', service: 'service-013', title: 'Loved Before You Started: Grace for New Beginnings', text: 'Lamentations 3:22-23; Jeremiah 31:3', bigIdea: 'New beginnings work because old love never ended.', points: ['1. The Source before the start (Jer 31:3) — you were loved pre-creation, so January is discovery not audition.', '2. Mercy resets every morning (Lam 3:22-23) — failure is not final when love is eternal.', '3. One obedient step this week — write it, tell one person, do it before Friday.'] },
  { id: 'jan-sun-02', date: '2027-01-10', service: 'service-014', title: 'Seek First the One Who Sought You First', text: 'Matthew 6:33; 1 John 4:19', bigIdea: 'We seek because we were first sought.', points: ['1. Eternal love initiates (1 John 4:19) — seeking is response, not bribery.', '2. Kingdom priority protects the heart (Matt 6:33) — love orders money, жажду, ambition.', '3. Practice: first 15 minutes to God before phone, every day this week.'] },
  { id: 'jan-sun-03', date: '2027-01-17', service: 'service-015', title: 'Money Cannot Buy What Love Already Gave', text: 'Matthew 6:19-21; Deuteronomy 7:7-8', bigIdea: 'Generosity proves we trust the Source more than the store.', points: ['1. Chosen by affection not abundance (Deut 7:7-8) — worth is settled.', '2. Treasure reveals throne (Matt 6:21) — budget is a love letter.', '3. Practice: give first, save second, spend third — one generous act this week.'] },
  { id: 'jan-sun-04', date: '2027-01-24', service: 'service-016', title: 'Think Loved: A Renewed Mind', text: 'Romans 12:2; Ephesians 3:18-19', bigIdea: 'Renewal starts when the mind agrees with eternal love.', points: ['1. Wide, long, high, deep (Eph 3:18) — small thinking shrinks a vast love.', '2. Do not conform (Rom 12:2) — culture says earn it; the cross says receive it.', '3. Practice: replace one lie daily with the day verse spoken aloud.'] },
  { id: 'jan-sun-05', date: '2027-01-31', service: 'service-017', title: 'Greatness Is Servanthood Soaked in Love', text: 'Mark 10:43-45; John 3:16', bigIdea: 'Kingdom ambition serves because eternal love gave.', points: ['1. He gave (John 3:16) — love measures greatness by outflow.', '2. Servant of all (Mark 10:44) — platform without towel is noise.', '3. Practice: one hidden act of service this week — no photo, no credit.'] },
];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '2027-01.json'), JSON.stringify({
  year: 2027, month: 1, yearlyMessage: 'Focus on The Love of The Lord',
  monthTheme: 'The Eternal Source (Pre-creation love)',
  intro: INTRO, outro: OUTRO,
  services: WEEKS, days: days, sermons: sermons,
}, null, 2) + '\n');

// Human-readable pack (all 3 formats)
let md = [];
md.push('# January 2027 — Focus on The Love of The Lord');
md.push('');
md.push('Month theme: **The Eternal Source (Pre-creation love)**. Yearly message: Focus on The Love of The Lord.');
md.push('Hybrid blend: keeps series.json titles (service-013..017), every day filtered through eternal love.');
md.push('Daily rhythm: Mon Spiritual · Tue Mental · Wed Physical · Thu Love for humanity · Fri Abundance · Sat Warfare · Sun Sabbath + service.');
md.push('Daily unit: Thanksgiving + Forgiveness → Teaching (120-150w) → Prayer → Declaration → Decree → Action (60-90s audio).');
md.push('');
md.push('## Format 1 — Daily App / Audio (31 days)');
md.push('');
days.forEach(function (x) {
  md.push('### ' + x.date + ' (' + x.weekday + ') — ' + x.dimensionLabel + ' [' + x.service + ' ' + x.serviceTheme + ']');
  md.push('');
  md.push('**Scripture:** ' + x.scripture + ' — ' + x.verse);
  md.push('');
  md.push('**Teaching:** ' + x.teaching);
  md.push('');
  md.push('**Prayer:** ' + x.prayer);
  md.push('');
  md.push('**Declaration:** ' + x.declaration);
  md.push('');
  md.push('**Decree:** ' + x.decree);
  md.push('');
  md.push('**Action:** ' + x.action);
  md.push('');
});
md.push('## Format 2 — Sunday Sermon Outlines (5)');
md.push('');
sermons.forEach(function (s) {
  md.push('### ' + s.date + ' — ' + s.title + ' [' + s.service + ']');
  md.push('');
  md.push('**Text:** ' + s.text);
  md.push('');
  md.push('**Big idea:** ' + s.bigIdea);
  md.push('');
  s.points.forEach(function (p) { md.push('- ' + p); });
  md.push('');
});
md.push('## Format 3 — Printed Journal (31 pages — prompts)');
md.push('');
days.forEach(function (x) {
  md.push('### ' + x.date + ' — ' + x.scripture);
  md.push('');
  md.push('1. Where have I lived as if I must earn what ' + x.scripture + ' says was already given?');
  md.push('2. One ' + x.dimensionLabel.toLowerCase() + ' step I will take today in response to eternal love:');
  md.push('');
  md.push('My sovereign response: _______________________________________________');
  md.push('');
});
md.push('## Outreach checklist (January)');
md.push('');
md.push('- WhatsApp Family Circle: post audio + declaration text daily 06:00 GMT; ask 1 reply (Amen + name).');
md.push('- Site PWA: devotionals page reads devotionals.json (Mondays); daily JSON powers future daily view + podcast.');
md.push('- Podcast/Shorts: cut each decree to 60s vertical with theme sting; link ?ref= invite.');
md.push('- Friday Answers: pick 3 questions on eternal love / worth / new beginnings; answer from January scriptures.');
md.push('- Testimony: every Sunday altar call → collect 3 testimonies for Friday wall.');
md.push('');
fs.writeFileSync(path.join(outDir, '2027-01-pack.md'), md.join('\n'));

// TTS-ready scripts
let au = [];
au.push('# January 2027 — daily audio scripts (60-90s each)');
au.push('');
au.push('Voice: warm, authoritative, unhurried. Bed: soft ambient pad -20dB. Export 128kbps MP3 for WhatsApp.');
au.push('');
days.forEach(function (x) {
  au.push('## ' + x.id);
  au.push(x.audioScript);
  au.push('');
});
fs.writeFileSync(path.join(outDir, '2027-01-audio.md'), au.join('\n'));

console.log('january pack built — ' + days.length + ' days, ' + sermons.length + ' sermons.');
