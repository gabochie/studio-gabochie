import fs from 'fs';
import path from 'path';

// ============================================
// CONFIGURATION
// ============================================
const OUT_DIR = 'love-of-the-lord/daily';
const YEAR = 2026;

const MONTHS = [
  {
    month: 10,
    daysInMonth: 31,
    startDay: 18, // Oct 18 is a Sunday
    sourceMonth: '01', // 2027-01 template
    monthTheme: 'The Eternal Source (Pre-creation Love)',
    monthFocus: 'Loved before you started; love is who God is.',
    serviceTheme: 'His Mercies Are New',
    baseService: 'service-012',
  },
  {
    month: 11,
    daysInMonth: 30,
    startDay: 1, // Nov 1
    sourceMonth: '03', // 2027-03 template
    monthTheme: 'The Incarnation — Love Takes Flesh',
    monthFocus: 'God drew near in Jesus; nearness is love.',
    serviceTheme: 'Grace for New Beginnings',
    baseService: 'service-013',
  },
  {
    month: 12,
    daysInMonth: 31,
    startDay: 1, // Dec 1
    sourceMonth: '04', // 2027-04 template
    monthTheme: 'The Cross — Ultimate Demonstration',
    monthFocus: 'Wounds become medicine; He gave Himself for us.',
    serviceTheme: 'Seek First the Kingdom',
    baseService: 'service-014',
  },
];

const DIMENSIONS = [
  { key: 'Financial', label: 'Wisdom for the Abundant Life' },
  { key: 'Warfare', label: 'Spiritual Warfare (Praying the Scriptures)' },
  { key: 'Sabbath', label: 'Sabbath Rest & Alignment' },
  { key: 'Spiritual', label: 'Spiritual Strength & Growth' },
  { key: 'Family', label: 'Marriage and Family' },
  { key: 'Health', label: 'Healing and Wholeness' },
  { key: 'Stewardship', label: 'Serving as Worship' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INTRO = 'Heavenly Father, we thank You for this brand-new day and the opportunity to gather as family in Your presence. Your mercies are new every morning. Forgive us our sins and trespasses, and we forgive all who trespassed against us. We stand cleansed by the blood of Jesus.';
const OUTRO = 'You have spoken life into your day. Walk boldly in the love of the Lord. You are blessed, covered, and victorious.';

// ============================================
// HELPERS
// ============================================
function loadTemplate(sourceMonth) {
  const file = path.join(OUT_DIR, `2027-${sourceMonth}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function getWeekday(year, month, day) {
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

function pad2(n) { return String(n).padStart(2, '0'); }

function buildAudioScript(day, monthCfg, intro, outro) {
  return `Good morning, family of God. Welcome to today's decree on the love of the Lord. ${intro} ${day.teaching} Now declare: ${day.declaration} ${day.decree} ${outro}`;
}

// ============================================
// MAIN GENERATION
// ============================================
for (const mCfg of MONTHS) {
  const template = loadTemplate(mCfg.sourceMonth);
  const templateDays = template.days; // 31 days for Jan, 28/30/31 for others

  // Build a map of day-of-month -> template day (for scripture/teaching variety)
  const dayMap = {};
  for (const td of templateDays) {
    const d = new Date(td.date);
    const dom = d.getDate();
    if (!dayMap[dom]) dayMap[dom] = td;
  }

  const days = [];
  let dimIdx = 0;

  for (let d = mCfg.startDay; d <= mCfg.daysInMonth; d++) {
    const weekday = getWeekday(YEAR, mCfg.month, d);
    const dateStr = `${YEAR}-${pad2(mCfg.month)}-${pad2(d)}`;
    const id = `pdd-${dateStr}`;

    // Pick template day (cycle through available template days)
    const templateDay = dayMap[((d - mCfg.startDay) % templateDays.length) + 1] || templateDays[0];

    const dimension = DIMENSIONS[dimIdx % DIMENSIONS.length];
    dimIdx++;

    // Service rotation: alternate between two services per month
    const serviceNum = (mCfg.month === 10) ? '012' : (mCfg.month === 11 ? '013' : '014');
    const service = `service-${serviceNum}`;

    const day = {
      id,
      date: dateStr,
      weekday,
      monthTheme: mCfg.monthTheme,
      service,
      serviceTheme: mCfg.serviceTheme,
      dimension: dimension.key,
      dimensionLabel: dimension.label,
      scripture: templateDay.scripture,
      verse: templateDay.verse,
      teaching: templateDay.teaching.replace(/2027/g, '2026').replace(template.monthTheme, mCfg.monthTheme),
      prayer: templateDay.prayer,
      declaration: templateDay.declaration,
      decree: templateDay.decree,
      action: templateDay.action,
      audioScript: '', // will fill after
    };

    day.audioScript = buildAudioScript(day, mCfg, INTRO, OUTRO);
    days.push(day);
  }

  const output = {
    year: YEAR,
    month: mCfg.month,
    yearlyMessage: template.yearlyMessage,
    monthTheme: mCfg.monthTheme,
    monthFocus: mCfg.monthFocus,
    intro: INTRO,
    outro: OUTRO,
    days,
  };

  const outFile = path.join(OUT_DIR, `${YEAR}-${pad2(mCfg.month)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Generated ${outFile} with ${days.length} days`);
}

console.log('Done. Review files before committing.');