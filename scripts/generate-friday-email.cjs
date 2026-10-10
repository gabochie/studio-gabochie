#!/usr/bin/env node
/* Generates the weekly "Friday 3 Answers" ministry email as a standalone,
   email-client-safe HTML file (all styling inline).

   Output: love-of-the-lord/email/friday-answers.html
   Run:    node scripts/generate-friday-email.cjs   (npm run email:friday)

   The email is NOT auto-sent. It is a review-ready artifact for the Friday
   broadcast; sending stays a deliberate, human-approved step. */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const answersPath = path.join(root, 'love-of-the-lord', 'answers', 'answers.json');
const outDir = path.join(root, 'love-of-the-lord', 'email');
const outPath = path.join(outDir, 'friday-answers.html');

const ARCHIVE_URL = 'https://studio.gabochie.com/love-of-the-lord/answers/';
const UNSUB_URL = 'https://studio.gabochie.com/unsubscribe/';

const INK = '#1a1a2e';
const GOLD = '#C9A84C';
const CREAM = '#FBF8F1';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function latestAnswers(data, n) {
  const list = Array.isArray(data.answers) ? data.answers.slice() : [];
  return list
    .map(function (a, i) { return { a: a, i: i }; })
    .sort(function (x, y) {
      const dx = String(x.a.date || '');
      const dy = String(y.a.date || '');
      if (dx !== dy) return dx < dy ? 1 : -1;
      return y.i - x.i;
    })
    .slice(0, n)
    .map(function (o) { return o.a; });
}

function answerUrl(a) {
  const v = a.video || {};
  if (v.tiktok) return 'https://www.tiktok.com/@gabochie/video/' + v.tiktok;
  if (v.youtube) return v.youtube;
  return ARCHIVE_URL;
}

function card(a, idx) {
  const scriptures = (a.scriptures || []).join(' &middot; ');
  return `
      <tr><td style="padding:0 0 18px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border:1px solid #ece5d5;border-radius:14px">
          <tr><td style="padding:22px 24px">
            <div style="font:600 11px/1 'Helvetica Neue',Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};margin-bottom:10px">${esc(a.category || 'Answer')}</div>
            <div style="font:400 19px/1.4 Georgia,'Times New Roman',serif;color:${INK};margin-bottom:12px">${esc(a.question)}</div>
            <div style="font:400 15px/1.6 'Helvetica Neue',Arial,sans-serif;color:#4a4a5a;margin-bottom:14px">${esc(a.counsel)}</div>
            ${scriptures ? `<div style="font:italic 400 13px/1.5 Georgia,serif;color:#8a7a3f;margin-bottom:18px">${scriptures}</div>` : ''}
            <a href="${esc(answerUrl(a))}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font:600 13px/1 'Helvetica Neue',Arial,sans-serif;letter-spacing:.02em;padding:12px 22px;border-radius:999px">Watch answer ${idx} &rarr;</a>
          </td></tr>
        </table>
      </td></tr>`;
}

function build(data) {
  const picked = latestAnswers(data, 3);
  const cards = picked.map(function (a, i) { return card(a, i + 1); }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Friday Answers &middot; Love Of The Lord</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse">
        <tr><td style="padding:0 0 8px 0">
          <div style="font:400 26px/1.3 Georgia,'Times New Roman',serif;color:${INK}">Love Of The Lord</div>
          <div style="font:600 12px/1.6 'Helvetica Neue',Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${GOLD}">Friday &middot; 3 Answers</div>
        </td></tr>
        <tr><td style="padding:14px 0 22px 0">
          <div style="font:400 16px/1.65 'Helvetica Neue',Arial,sans-serif;color:#4a4a5a">
            Peace to you. Here are this week's three questions from the community &mdash; answered honestly, from the Word. Take the one that speaks to your week and sit with it.
          </div>
        </td></tr>
${cards}
        <tr><td style="padding:8px 0 22px 0" align="center">
          <a href="${ARCHIVE_URL}" style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;font:600 13px/1 'Helvetica Neue',Arial,sans-serif;padding:13px 26px;border-radius:999px">Browse the full Answers archive &rarr;</a>
        </td></tr>
        <tr><td style="padding:22px 0 6px 0;border-top:1px solid #e4dcc8">
          <div style="font:400 12px/1.7 'Helvetica Neue',Arial,sans-serif;color:#8a8a98">
            You are receiving this because you asked to hear from Love Of The Lord, a ministry of Global Ministry &mdash; Studio Gabochie.<br>
            Questions or a prayer request? Reply to this email or write to <a href="mailto:love@gabochie.com" style="color:${INK}">love@gabochie.com</a>.<br>
            WhatsApp +233 243 262 019 &middot; P.O. Box SK 2125, Sakumono, Tema &mdash; Ghana<br>
            <a href="${UNSUB_URL}" style="color:#8a8a98">Unsubscribe</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
  const html = build(data);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  const n = Math.min(3, (data.answers || []).length);
  console.log('love-of-the-lord/email/friday-answers.html regenerated \u2014 ' + n + ' answer(s).');
}

main();
