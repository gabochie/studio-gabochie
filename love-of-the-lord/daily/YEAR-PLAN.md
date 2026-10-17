# LOTL Year Plan — Focus on The Love of The Lord

> Durable context file. Re-read this + `2027-01.json` before generating any daily content.
> Yearly message is fixed. Do not change without user approval.

## 1. Yearly message (fixed)
**Focus on The Love of The Lord** — daily devotion with prayer + declaration + decree, all days of the year.

## 2. Sources (ground truth on disk)
- `C:\Users\user\Desktop\PDD\dailly teachings on the Love of the Lord whole year.txt` — Q1 Nature, Q2 Personified (Jesus), Q3 Distortion/cheap grace, Q4 Response. 12 months: Jan Eternal Source, Feb Hesed, Mar Incarnation, Apr Cross, May Adoption, Jun Grace vs Law, Jul Discipline, Aug False love, Sep First Commandment, Oct Neighbour, Nov Enemies, Dec Eternity.
- `C:\Users\user\Desktop\PDD\Prayers Declarations and Decrees.txt` — approved weekly rhythm + intro/outro + warfare/sabbath scripts.
- `love-of-the-lord/series.json` — 52 Sunday services, 4 seasons (Foundations of Grace, Kingdom Mind, Love in Action, Hope and Harvest). NEVER break: 4 seasons x 13 = 52, every service has lineup file.
- `love-of-the-lord/daily/2027-01.json` — January pilot (31 days, 5 sermons). Template for all months.

## 3. Hybrid blend (user decision 2026-10-16)
Keep `series.json` titles. Lens every week/day through the monthly love theme.
`1 week = 1 service theme + 7 daily angles.`

## 4. 7-day rhythm (fixed)
- Mon Spiritual | Tue Mental | Wed Physical | Thu Love for humanity | Fri Abundance wisdom | Sat Warfare (Eph 6:10-11, Luke 10:19, Isa 54:17, 2 Cor 10:4-5, Ps 91:11) | Sun Sabbath + Sunday service (Gen 2:3, Matt 11:28, Ps 23, Isa 40:31)

## 5. Daily unit template (all 365)
1. Thanksgiving + Forgiveness intro (fixed text in `2027-01.json: intro`):
   `Heavenly Father, we thank You for this brand-new day... Forgive us... and we forgive all... cleansed by the blood of Jesus.`
2. Teaching 120-150w: monthly love angle + weekly service theme + day scripture.
3. Prayer: intro + dimension petition.
4. Declaration: 1 line, shareable.
5. Decree: declaration + verse + "In Jesus' name, Amen."
6. Action: one concrete step.
7. Audio 60-90s: `Good morning, family of God... [intro] [teaching] Now declare: [decree] [outro]`
8. Outro (fixed): `You have spoken life into your day. Walk boldly in the love of the Lord...`

## 6. Formats per month
- Format 1 App/audio: `daily/YYYY-MM.json` + `daily/YYYY-MM-audio.md` (## per day, 128kbps MP3, soft pad -20dB).
- Format 2 Sermons: Sunday outlines (title, text, big idea, 3 points) in `daily/YYYY-MM-pack.md`.
- Format 3 Journal: 2 prompts/day + response space in same pack.
- Generator: `scripts/build-january-pack.cjs` — clone for Feb-Dec.
- Site wiring: Mondays appended to `devotionals/devotionals.json` (SOAP shape: id, week, date, series, theme, title, scripture, verse, observation, application, prayer).

## 7. Outreach checklist (monthly)
- WhatsApp Family Circle 06:00 GMT: audio + declaration text; ask 1 reply.
- PWA `devotionals/` + `podcast.xml`; 60s Shorts/Reels per decree with theme sting.
- Friday Answers: 3 questions on month theme.
- Sunday altar → collect 3 testimonies for Friday wall + watch-party invite `?ref=`.

## 8. Status
- LIVE WIRED 2027-01..12: 365 days, 52 sermons. Regenerate: `node scripts/build-full-year-pack.cjs`.
- `devotionals.json`: 56 weekly SOAP (4x 2026 + 52x 2027 Mondays).
- `devotionals/` Daily tab loads all 12 JSONs with month filter + read-aloud; SW v21 precaches devotionals + all daily JSONs.
- Tests: `tests/unit/lotl-content-data.test.js` must stay green.
