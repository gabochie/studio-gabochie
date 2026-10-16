/* Batch-build full calendar year 2027 PDD packs (offline, not published).
 * Reuses January pilot template. Outputs per month m=02..12:
 *   love-of-the-lord/daily/2027-MM.json, 2027-MM-pack.md, 2027-MM-audio.md
 * Jan files already exist — regenerated identically for consistency.
 * Usage: node scripts/build-full-year-pack.cjs
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'love-of-the-lord', 'daily');
const series = JSON.parse(fs.readFileSync(path.join(root, 'love-of-the-lord', 'series.json'), 'utf8'));
const allSvc = [];
(series.seasons || []).forEach(function (s) { (s.services || []).forEach(function (svc) { allSvc.push(svc); }); });
allSvc.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });

const INTRO = 'Heavenly Father, we thank You for this brand-new day and the opportunity to gather as family in Your presence. Your mercies are new every morning. Forgive us our sins and trespasses, and we forgive all who trespassed against us. We stand cleansed by the blood of Jesus.';
const OUTRO = 'You have spoken life into your day. Walk boldly in the love of the Lord. You are blessed, covered, and victorious.';
const DIMS = {
  Spiritual: { label: 'Spiritual Strength & Growth', prayer: 'Fill me with hunger for Your Word. Let my faith rise, my prayer catch fire, and my roots go deep in Your love.', declaration: 'I am rooted and established in the eternal love of God.', action: 'Read your day scripture aloud 3x and write one obedience step.' },
  Mental: { label: 'Mental Maturity & Clarity', prayer: 'Give me the mind of Christ. Cast down confusion and guard my thoughts with Your perfect peace.', declaration: 'I have the mind of Christ; confusion has no hold on me.', action: 'Replace one anxious thought with the day verse — speak it out loud.' },
  Physical: { label: 'Physical Strength & Endurance', prayer: 'Strengthen this temple. Give me vitality and endurance to run my race to the crown.', declaration: 'My body is the temple of the Holy Spirit; divine health is my portion.', action: 'Walk 10 minutes praying the declaration; honour rest and water today.' },
  Social: { label: 'Deeper Love for All Humanity', prayer: 'Shed Your love abroad in my heart. Let me see people through the eyes of Jesus.', declaration: 'I am a conduit of God’s love to humanity today.', action: 'Do one deliberate kindness for someone unlovable or overlooked.' },
  Financial: { label: 'Wisdom for the Abundant Life', prayer: 'Give me wisdom to steward resources well. Break scarcity; teach me generosity.', declaration: 'I walk in Kingdom abundance to be a blessing.', action: 'Review one money choice; give or save as worship today.' },
  Warfare: { label: 'Spiritual Warfare (Praying the Scriptures)', prayer: 'I put on the whole armour of God. No weapon formed against me shall prosper (Isaiah 54:17). I trample all the power of the enemy (Luke 10:19) and pull down every stronghold (2 Corinthians 10:4-5). Angels guard me in all my ways (Psalm 91:11).', declaration: 'I enforce the victory of the cross over my life and family today.', action: 'Speak Ephesians 6:10-11 aloud; cancel one fear by name.' },
  Sabbath: { label: 'Sabbath Rest & Alignment', prayer: 'I enter Your rest (Genesis 2:3). I lay down heavy yokes (Matthew 11:28). Lead me beside still waters and restore my soul (Psalm 23). Renew my strength as I wait on You (Isaiah 40:31).', declaration: 'I rest in the finished work of Jesus; I am aligned for the week ahead.', action: 'Take 15 screen-free minutes in His presence; journal one gratitude.' },
};
function dimForDow(dow) { return ({ 0: 'Sabbath', 1: 'Spiritual', 2: 'Mental', 3: 'Physical', 4: 'Social', 5: 'Financial', 6: 'Warfare' })[dow]; }
function svcFor(iso) {
  let w = allSvc[0];
  allSvc.forEach(function (x) { if (x.date <= iso && x.date >= '2026-10-11') w = x; });
  if (iso > allSvc[allSvc.length - 1].date) {
    const tail = allSvc.slice(-8);
    const extra = Math.floor((new Date(iso) - new Date(allSvc[allSvc.length - 1].date)) / 86400000 / 7);
    w = tail[extra % tail.length];
  }
  return w;
}
const MONTHS = [
  { m: '01', theme: 'The Eternal Source (Pre-creation love)', focus: 'Loved before you started; love is who God is.', verses: [['1 John 4:8, 16', 'God is love. Whoever lives in love lives in God, and God in them.', 'Love is not what God does; it is who He is.'], ['Jeremiah 31:3', 'I have loved you with an everlasting love.', 'Everlasting means no start date.'], ['Ephesians 3:18-19', 'How wide and long and high and deep is the love of Christ.', 'Vast love, lifelong exploration.'], ['John 3:16', 'For God so loved the world that he gave.', 'Eternal love always gives.'], ['Romans 5:8', 'While we were still sinners, Christ died for us.', 'He moved first.'], ['Deuteronomy 7:7-8', 'It was because the Lord loved you.', 'Chosen by affection, not size.'], ['Psalm 136:1', 'His love endures forever.', 'Hesed refuses to quit.'], ['Romans 8:38-39', 'Nothing shall separate us from the love of God.', 'Separation-proof love.'], ['Isaiah 54:10', 'My unfailing love for you will not be shaken.', 'Build on the unshakable.'], ['1 John 3:1', 'See what great love the Father has lavished on us.', 'You belong as a child.']] },
  { m: '02', theme: 'Hesed — Covenant Love', focus: 'Steadfast love that keeps promises.', verses: [['Psalm 136:1-3', 'His love endures forever.', 'Covenant love outlasts moods.'], ['Deuteronomy 7:9', 'He is the faithful God, keeping his covenant of love.', 'Faithful when you are not.'], ['Hosea 3:1', 'Love her as the Lord loves the Israelites.', 'Pursuit after betrayal.'], ['Isaiah 54:10', 'My unfailing love will not be shaken.', 'Mountains move; love stays.'], ['Lamentations 3:22-23', 'His mercies never come to an end.', 'Fresh supply every morning.'], ['Psalm 103:8-12', 'Slow to anger, abounding in steadfast love.', 'East from west separation.']] },
  { m: '03', theme: 'The Incarnation — Love Takes Flesh', focus: 'God drew near in Jesus.', verses: [['John 1:14', 'The Word became flesh and dwelt among us.', 'Nearness is love.'], ['Luke 15:20', 'His father ran to him.', 'The Father runs to prodigals.'], ['Philippians 2:7-8', 'He humbled himself, becoming obedient to death.', 'Descent is love.'], ['Matthew 1:23', 'Immanuel — God with us.', 'With-ness before fix-ness.'], ['John 8:10-11', 'Neither do I condemn you. Go and sin no more.', 'Truth plus tenderness.'], ['Mark 10:21', 'Jesus loved him.', 'Love looks before it corrects.']] },
  { m: '04', theme: 'The Cross — Ultimate Demonstration', focus: 'Gave Himself for us.', verses: [['John 3:16', 'For God so loved the world.', 'Giving is proof.'], ['Romans 5:8', 'While still sinners, Christ died.', 'No audition.'], ['Galatians 2:20', 'Who loved me and gave himself for me.', 'Personal ransom.'], ['1 John 3:16', 'Jesus laid down his life for us.', 'Lay down to lift up.'], ['Isaiah 53:5', 'By his wounds we are healed.', 'Wounds become medicine.'], ['Colossians 2:14', 'He canceled the charge against us.', 'Debt nailed, freedom signed.']] },
  { m: '05', theme: 'The Fatherhouse — Adoption & Identity', focus: 'Called children of God.', verses: [['1 John 3:1', 'That we should be called children of God.', 'Lavished belonging.'], ['Romans 8:15-16', 'The Spirit of adoption.', 'Abba, not applicant.'], ['John 21:15-17', 'Do you love me? Feed my sheep.', 'Restored Peter, restored purpose.'], ['Joel 2:25', 'I will restore the years.', 'Wasted seasons recoverable.'], ['Zephaniah 3:17', 'He will rejoice over you with singing.', 'Sung over, not sighed at.'], ['Luke 15:22-24', 'Bring the best robe.', 'Robe, ring, feast — immediately.']] },
  { m: '06', theme: 'Love vs Law — Understanding Grace', focus: 'Obedience proves love; ritual cannot replace it.', verses: [['John 14:15', 'If you love me, keep my commands.', 'Alignment over goosebumps.'], ['Romans 6:1-2', 'Shall we go on sinning? By no means!', 'Grace frees from sin, not for sin.'], ['1 Samuel 15:22', 'To obey is better than sacrifice.', 'Surrender over show.'], ['Galatians 6:7', 'A man reaps what he sows.', 'Love honours harvest law.'], ['Matthew 22:37-38', 'Love the Lord with all your heart.', 'All means all.'], ['James 2:17', 'Faith without works is dead.', 'Living love labours.']] },
  { m: '07', theme: 'Boundaries of Love — Discipline & Justice', focus: 'Correction proves sonship.', verses: [['Hebrews 12:6', 'The Lord disciplines the one he loves.', 'Rod proves belonging.'], ['Revelation 3:19', 'Those whom I love I rebuke.', 'Earnest, then repent.'], ['Psalm 78:38-39', 'Yet he was merciful.', 'Patience invites return.'], ['2 Peter 3:9', 'He is patient with you.', 'Slowness is mercy, not softness.'], ['Amos 5:24', 'Let justice roll like a river.', 'Worship needs ethics.'], ['Proverbs 3:12', 'The Lord disciplines those he loves.', 'Father, not foe.']] },
  { m: '08', theme: 'Misappropriated Love — Exposing Cheap Grace', focus: 'Rescue, not excuse.', verses: [['Jude 1:4', 'Pervert grace into license.', 'Safety net, not trampoline.'], ['1 Corinthians 5:1-2', 'Tolerance that boasts over sin.', 'Love protects holiness.'], ['John 6:26', 'You seek me for bread.', 'Giver over gifts.'], ['Acts 8:20', 'You thought you could buy the gift.', 'Anointing is not for sale.'], ['Matthew 20:11-12', 'You made them equal to us.', 'Grace offends merit.'], ['Luke 15:29-30', 'All these years I have slaved.', 'Child, not clock-in labourer.']] },
  { m: '09', theme: 'Heart Renovated — First Commandment', focus: 'Return to first love.', verses: [['Matthew 22:37', 'Love the Lord with all.', 'Primary pursuit.'], ['Revelation 2:4-5', 'You have forsaken your first love.', 'Remember, repent, return.'], ['Deuteronomy 8:14', 'Then your heart will become proud.', 'Comfort must not cool hunger.'], ['Psalm 23:2-3', 'He restores my soul.', 'Still waters, restored soul.'], ['Isaiah 40:31', 'Those who wait renew strength.', 'Waiting is working.'], ['Ezekiel 33:31', 'They hear but do not do.', 'Convert revelation to action.']] },
  { m: '10', theme: 'Second Commandment — Loving Your Neighbour', focus: 'Love in action horizontally.', verses: [['Mark 12:31', 'Love your neighbour as yourself.', 'Proximity is ministry.'], ['Ephesians 4:32', 'Forgive as God forgave you.', 'Freed people free people.'], ['Romans 12:1', 'Offer bodies as living sacrifice.', 'Serving is worship.'], ['Acts 2:44-45', 'They shared with all in need.', 'Generosity is community.'], ['John 13:35', 'By this all will know.', 'Love is the apologetic.'], ['1 John 2:15', 'Do not love the world.', 'Father first, world last.']] },
  { m: '11', theme: 'Loving the Unlovable — Enemies & Persecutors', focus: 'Bless, forgive, reconcile.', verses: [['Matthew 5:44', 'Love your enemies, pray for persecutors.', 'Highest hill of love.'], ['Luke 17:17-18', 'Where are the other nine?', 'Stay with the Healer.'], ['Job 1:21', 'The Lord gave, the Lord takes.', 'Worship in weather.'], ['James 4:4', 'Friendship with the world is enmity.', 'Exclusivity protects.'], ['Matthew 6:24', 'You cannot serve two masters.', 'One throne, one King.'], ['2 Timothy 4:10', 'Demas loved this world.', 'Keep eternal gaze.']] },
  { m: '12', theme: 'Triumphant Love — Restoration & Eternity', focus: 'Hope, harvest, thanksgiving.', verses: [['Romans 5:5', 'Hope does not disappoint.', 'Poured-out love, poured-in hope.'], ['Galatians 6:7-9', 'In due season we will reap.', 'Sow, then carry fire.'], ['Psalm 27:14', 'Wait for the Lord.', 'Faith in the waiting.'], ['Psalm 100:4', 'Enter with thanksgiving.', 'Gratitude is the gate.'], ['Leviticus 6:13', 'The fire shall never go out.', 'Carry the fire home.'], ['Revelation 21:4', 'He will wipe every tear.', 'Love wins forever.']] },
];
function daysIn(year, m) { return new Date(Date.UTC(year, parseInt(m, 10), 0)).getUTCDate(); }
fs.mkdirSync(outDir, { recursive: true });
let totalDays = 0, totalSermons = 0;
MONTHS.forEach(function (MO) {
  const n = daysIn(2027, MO.m);
  const days = [];
  for (let d = 1; d <= n; d++) {
    const iso = '2027-' + MO.m + '-' + String(d).padStart(2, '0');
    const dow = new Date(Date.UTC(2027, parseInt(MO.m, 10) - 1, d)).getUTCDay();
    const dim = dimForDow(dow);
    const meta = DIMS[dim];
    const v = MO.verses[(d - 1) % MO.verses.length];
    const svc = svcFor(iso);
    const teaching = v[2] + ' Month focus — ' + MO.theme + ': ' + MO.focus + ' This week we carry "' + svc.title + '" (' + svc.theme_verse + '). ' + meta.label + ' flows from being loved first. Let ' + v[0] + ' settle you: ' + v[1];
    const decree = meta.declaration + ' ' + v[1] + ' In Jesus\u2019 name, Amen.';
    days.push({ id: 'pdd-2027-' + MO.m + '-' + String(d).padStart(2, '0'), date: iso, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow], monthTheme: MO.theme, service: svc.id, serviceTheme: svc.title, dimension: dim, dimensionLabel: meta.label, scripture: v[0], verse: v[1], teaching: teaching, prayer: INTRO + ' ' + meta.prayer, declaration: meta.declaration, decree: decree, action: meta.action, audioScript: 'Good morning, family of God. Welcome to today\u2019s decree on the love of the Lord. ' + INTRO + ' ' + teaching + ' Now declare: ' + decree + ' ' + OUTRO });
  }
  const sundays = days.filter(function (x) { return x.weekday === 'Sun'; });
  const sermons = sundays.map(function (s, i) {
    return { id: 'serm-2027-' + MO.m + '-' + String(i + 1).padStart(2, '0'), date: s.date, service: s.service, title: s.serviceTheme + ' — ' + MO.theme, text: s.scripture + '; ' + (svcFor(s.date).theme_verse || s.scripture), bigIdea: MO.focus, points: ['1. Receive: ' + s.verse, '2. Respond: ' + s.action, '3. Release: share one testimony and invite one friend this week.'] };
  });
  fs.writeFileSync(path.join(outDir, '2027-' + MO.m + '.json'), JSON.stringify({ year: 2027, month: parseInt(MO.m, 10), yearlyMessage: 'Focus on The Love of The Lord', monthTheme: MO.theme, monthFocus: MO.focus, intro: INTRO, outro: OUTRO, days: days, sermons: sermons }, null, 2) + '\n');
  let md = [];
  md.push('# 2027-' + MO.m + ' — ' + MO.theme);
  md.push('');
  md.push('Yearly message: Focus on The Love of The Lord. Focus: ' + MO.focus);
  md.push('');
  md.push('## Format 1 — Daily App / Audio (' + days.length + ' days)');
  md.push('');
  days.forEach(function (x) {
    md.push('### ' + x.date + ' (' + x.weekday + ') — ' + x.dimensionLabel + ' [' + x.service + ' ' + x.serviceTheme + ']');
    md.push(''); md.push('**Scripture:** ' + x.scripture + ' — ' + x.verse); md.push('');
    md.push('**Teaching:** ' + x.teaching); md.push(''); md.push('**Prayer:** ' + x.prayer); md.push('');
    md.push('**Declaration:** ' + x.declaration); md.push(''); md.push('**Decree:** ' + x.decree); md.push('');
    md.push('**Action:** ' + x.action); md.push('');
  });
  md.push('## Format 2 — Sunday Sermons (' + sermons.length + ')'); md.push('');
  sermons.forEach(function (s) { md.push('### ' + s.date + ' — ' + s.title + ' [' + s.service + ']'); md.push(''); md.push('**Text:** ' + s.text); md.push(''); md.push('**Big idea:** ' + s.bigIdea); md.push(''); s.points.forEach(function (p) { md.push('- ' + p); }); md.push(''); });
  md.push('## Format 3 — Journal prompts'); md.push('');
  days.forEach(function (x) { md.push('### ' + x.date + ' — ' + x.scripture); md.push(''); md.push('1. Where have I lived as if I must earn what ' + x.scripture + ' says was given?'); md.push('2. One ' + x.dimensionLabel.toLowerCase() + ' step today:'); md.push(''); md.push('My sovereign response: ___________________________'); md.push(''); });
  fs.writeFileSync(path.join(outDir, '2027-' + MO.m + '-pack.md'), md.join('\n'));
  let au = ['# 2027-' + MO.m + ' — daily audio scripts', '', 'Voice: warm, authoritative. Bed: soft pad -20dB. Export 128kbps MP3.', ''];
  days.forEach(function (x) { au.push('## ' + x.id); au.push(x.audioScript); au.push(''); });
  fs.writeFileSync(path.join(outDir, '2027-' + MO.m + '-audio.md'), au.join('\n'));
  totalDays += days.length; totalSermons += sermons.length;
  console.log('built 2027-' + MO.m + ' — ' + days.length + ' days, ' + sermons.length + ' sermons');
});
console.log('FULL YEAR — ' + totalDays + ' days, ' + totalSermons + ' sermons. Offline staging only; devotionals.json untouched.');
