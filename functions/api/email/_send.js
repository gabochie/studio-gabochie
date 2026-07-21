export async function sendBrevoEmail(env, toEmail, toName, subject, htmlContent) {
  if (!env.BREVO_API_KEY) return;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'Gideon Abochie', email: 'newsletter@gabochie.com' },
        to: [{ email: toEmail, name: toName || '' }],
        subject,
        htmlContent
      })
    });
  } catch (_) {}
}

export async function queueEmail(env, toEmail, toName, subject, htmlContent, emailType, scheduledAt) {
  if (!env.DB) return;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const sendAt = scheduledAt || now;
  await env.DB.prepare(
    'INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(toEmail, toName || '', subject, htmlContent, emailType, sendAt, now).run();
}

export function refCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GA-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export const welcomeImmediate = (name, code) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#0A1628;margin:0 0 8px">Welcome to <span style="color:#C9A84C">The Studio Weekly</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">You are now part of a growing community of creators, thinkers, and changemakers who believe that education — and the world — can be rebuilt better.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">Every week, you will receive essays on creativity, love, wisdom, and the future of learning — plus curated news from Ghana and the diaspora.</p>
      <div style="background:#0A1628;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="font-family:'Barlow Condensed',sans-serif;font-size:14px;color:#C9A84C;margin:0 0 8px;text-transform:uppercase;letter-spacing:.15em">Your Referral Link</p>
        <p style="font-family:'Courier Prime',monospace;font-size:15px;color:#fff;margin:0;word-break:break-all">https://news.gabochie.com/?ref=${code}</p>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Share your referral link to earn free ad space. Refer 3 friends → Footer Banner ad. Refer 10 → Leaderboard ad. Refer 50 → Premium Package. Full details in your dashboard.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const welcomeFollowup = (name) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Have You Explored the <span style="color:#C9A84C">School</span>?</h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">By now you have received your first issue of The Studio Weekly. I hope it blessed you as much as it blessed me to write it.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">I want to personally invite you to explore the <strong>School</strong> — a growing library of courses designed to help you think in systems, design with purpose, and lead with wisdom.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://studio.gabochie.com/school/" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Explore the School</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">P.S. You can also support this mission by <a href="https://studio.gabochie.com/#give" style="color:#C9A84C">making a donation</a> or <a href="https://studio.gabochie.com/newsletter/advertise.html" style="color:#C9A84C">sponsoring the newsletter</a>.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const manifestoFollowup = (name, book, email, slug) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Did You Get Your <span style="color:#C9A84C">Free Copy</span>?</h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">A few days ago you downloaded <strong>${book || 'one of my books'}</strong>. I hope it is already reshaping how you see your work, your faith, and your world.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">If you have not had a chance to read it yet, here is the download link again:</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://studio.gabochie.com/api/books/serve?slug=${slug || 'the-bible-as-kingdom-os'}&email=${encodeURIComponent(email || '')}" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Download Again</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">And if you enjoy it, would you consider leaving a review or sharing it with a friend? Word of mouth is how this mission grows.</p>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Warmly,<br>Gideon Abochie</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const donationReceiptHtml = (name, amount, txRef) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Thank You for Your <span style="color:#C9A84C">Generosity</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Dear ' + name + ',' : 'Dear Friend,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Your donation of <strong>GH¢${amount}</strong> has been received. Thank you for partnering with us to make creativity, love, and wisdom accessible to everyone — freely and faithfully.</p>
      <div style="background:#0A1628;border-radius:8px;padding:24px;margin-bottom:24px">
        <p style="font-family:'Courier Prime',monospace;font-size:13px;color:#fff;margin:0 0 8px">Reference: ${txRef}</p>
        <p style="font-family:'Courier Prime',monospace;font-size:13px;color:#94A3B8;margin:0">Amount: GH¢${amount}</p>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Your support makes every book, video, and teaching possible. We are grateful to have you on this journey.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const donationImpactFollowup = (name) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Your Impact in <span style="color:#C9A84C">Action</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">A few days ago you made a donation to Studio by Gabochie. I want you to know exactly what your gift is making possible:</p>
      <ul style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;line-height:1.8;padding-left:20px;margin:0 0 24px">
        <li>Free books and resources reaching thousands of readers across Ghana and the diaspora</li>
        <li>Daily video teachings on TikTok and YouTube viewed by 10,000+ followers</li>
        <li>The Studio Weekly newsletter sent to subscribers in over 10 countries</li>
        <li>Scholarships for the School program</li>
      </ul>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">You are not just a donor. You are a co-laborer in this mission. Thank you.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://studio.gabochie.com/#impact" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:12px 28px;border-radius:6px">See Our Impact</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Gideon Abochie</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const enrollmentFollowup = (name, programTitle, dashboardUrl) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Getting Started with <span style="color:#C9A84C">${programTitle}</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">A few days ago you enrolled in <strong>${programTitle}</strong>. I wanted to check in and share some tips to help you get the most out of the course:</p>
      <ol style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;line-height:1.8;padding-left:20px;margin:0 0 24px">
        <li>Start with the free sample module to get a feel for the material</li>
        <li>Set aside 15-20 minutes per session — consistency beats cramming</li>
        <li>Take notes in your own words; teaching others is the best way to learn</li>
        <li>Share your insights with the community on social media with #StudioByGabochie</li>
      </ol>
      <div style="text-align:center;margin:24px 0">
        <a href="${dashboardUrl}" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Go to Your Dashboard</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">P.S. Questions or feedback? Just reply to this email. I read every message.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const abandonedDonationReminder = (name) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">You Were About to Make a <span style="color:#C9A84C">Difference</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">I noticed you started a donation to Studio by Gabochie but didn't complete it. No pressure — but if you felt a nudge to give, it might be worth revisiting.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Your support helps us create free books, courses, and resources that reach thousands across Ghana and beyond. Every gift, no matter the size, makes a real difference.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://studio.gabochie.com/#give" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Complete Your Donation</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Warmly,<br>Gideon Abochie</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const confirmSubscription = (name, confirmUrl) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Confirm Your <span style="color:#C9A84C">Subscription</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">You recently signed up for <strong>The Studio Weekly</strong> — a newsletter on creativity, love, wisdom, and the future of learning from Ghana.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">Please confirm your subscription by clicking the button below. You will not receive any emails until you confirm.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${confirmUrl}" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Confirm Subscription</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">If you did not sign up, you can safely ignore this email.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const waitlistConfirmation = (name, programTitle) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">You Are on the <span style="color:#C9A84C">List</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Thank you for joining the waitlist for <strong>${programTitle || 'our upcoming program'}</strong>. You are now first in line to know when enrollment opens.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Here is what happens next:</p>
      <ul style="font-family:Georgia,serif;font-size:15px;color:#6B7F9A;line-height:1.8;padding-left:20px;margin:0 0 24px">
        <li>We will notify you as soon as the program launches</li>
        <li>Early waitlist members get priority access and any launch discounts</li>
        <li>You will receive occasional updates on the programs progress</li>
      </ul>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 24px">In the meantime, feel free to explore the <a href="https://studio.gabochie.com/school/" style="color:#C9A84C">School</a> for existing courses and resources.</p>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">Warmly,<br>Gideon Abochie</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;

export const bookUpsell = (name) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">
  <table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">
    <tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio by Gabochie</span>
    </td></tr>
    <tr><td style="padding:32px 0 24px">
      <h1 style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#0A1628;margin:0 0 8px">Go Deeper with the <span style="color:#C9A84C">Premium Bundle</span></h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">${name ? 'Hi ' + name + ',' : 'Hello,'}</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Thank you for your recent book purchase. I hope the content is already reshaping how you see your work and your world.</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">Did you know you can get the <strong>complete premium bundle</strong> — all my published works — for just <strong>GH¢300</strong>? That is the most affordable way to build your library.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://studio.gabochie.com/books/" style="display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:14px 36px;border-radius:6px">Explore the Bundle</a>
      </div>
      <p style="font-family:Georgia,serif;font-size:13px;color:#94A3B8;line-height:1.6;margin:0">You can also support the mission by <a href="https://studio.gabochie.com/support/" style="color:#C9A84C">becoming a monthly supporter</a>.</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">
      <p style="font-family:'Courier Prime',monospace;font-size:10px;color:#94A3B8;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p>
    </td></tr>
  </table></body></html>`;
