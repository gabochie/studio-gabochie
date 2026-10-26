/* LOTL Subscribe + Social Share — shared component.
 *
 * Usage (in page):
 *   <div id="lotl-subscribe"></div>
 *   <div id="lotl-share"></div>
 *   <script src="/love-of-the-lord/subscribe-share.js" defer></script>
 *   <script>
 *     lotlSubscribe('#lotl-subscribe', { source: 'lotl-devotionals', title: 'Stay in the Word' });
 *     lotlShareButtons('#lotl-share', { path: '/love-of-the-lord/devotionals/', campaign: 'lotl-devotionals' });
 *   </script>
 */
(function () {
  'use strict';

  var SITEKEY = '0x4AAAAAAFaBpQ3dnRXS9xw_';
  var API = '/api/subscribe';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '\u0027');
  }

  function lotlSubscribe(selector, opts) {
    opts = opts || {};
    var wrap = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!wrap) return;
    var title = opts.title || 'Stay in the Word';
    var source = opts.source || 'lotl-devotionals';
    var placeholder = opts.placeholder || 'you@example.com';
    var btnText = opts.btnText || 'Subscribe';
    var lotlDaily = !!opts.lotlDaily;
    var subtitle = opts.subtitle || (lotlDaily ? 'The daily teaching, prayer, declaration and decree. One email a day.' : 'One practical essay a week. No spam.');

    wrap.innerHTML =
      '<div class="lotl-subscribe-wrap" style="background:#0F1E38;border:1px solid #1E3250;border-radius:14px;padding:20px;text-align:center">' +
        '<h3 style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;text-transform:uppercase;color:#F1F5F9;margin:0 0 6px">' + esc(title) + '</h3>' +
        '<p style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:#8A9BB5;margin:0 0 14px">' + esc(subtitle) + '</p>' +
        '<form class="lotl-subscribe-form" onsubmit="return false">' +
          '<input type="email" class="lotl-email" placeholder="' + esc(placeholder) + '" style="width:100%;font-family:\'DM Sans\',sans-serif;font-size:14px;padding:12px;border-radius:8px;border:1px solid #1E3250;background:#0A1628;color:#F1F5F9;margin-bottom:10px" required>' +
          '<div class="cf-turnstile" data-sitekey="' + SITEKEY + '" data-action="turnstile-spin-v2" style="margin:8px auto"></div>' +
          '<div class="lotl-sub-msg" style="font-family:\'DM Sans\',sans-serif;font-size:13px;min-height:18px;margin:8px 0"></div>' +
          '<button type="button" class="lotl-btn" style="width:100%">' + esc(btnText) + '</button>' +
          '<input type="hidden" name="source" value="' + esc(source) + '">' +
        '</form>' +
      '</div>';

    var form = wrap.querySelector('.lotl-subscribe-form');
    var emailEl = wrap.querySelector('.lotl-email');
    var msgEl = wrap.querySelector('.lotl-sub-msg');
    var btn = wrap.querySelector('button');

    form.addEventListener('submit', function () { return false; });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var email = emailEl.value.trim();
      if (!email || email.indexOf('@') < 0) {
        msgEl.textContent = 'Enter a valid email.';
        msgEl.style.color = '#E8637A';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Subscribing...';
      msgEl.textContent = '';
      var token = (wrap.querySelector('input[name="cf-turnstile-response"]') || {}).value || '';
      var payload = { email: email, source: source, cf_turnstile_token: token };
      if (lotlDaily) payload.lotl_daily = 1;
      var body = JSON.stringify(payload);
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.status === 'ok') {
            msgEl.textContent = d.existing && d.confirmed ? 'You\'re already subscribed \u2014 welcome back!' : 'Check your inbox to confirm.';
            msgEl.style.color = '#34C77B';
            emailEl.value = '';
          } else {
            msgEl.textContent = (d && (d.message || d.error)) || 'Something went wrong.';
            msgEl.style.color = '#E8637A';
          }
        })
        .catch(function () {
          msgEl.textContent = 'Something went wrong.';
          msgEl.style.color = '#E8637A';
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = btnText;
        });
    });
  }

  function lotlShareButtons(selector, opts) {
    opts = opts || {};
    var wrap = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!wrap) return;
    var path = opts.path || '/love-of-the-lord/';
    var campaign = opts.campaign || 'lotl-share';
    var title = opts.title || 'Love Of The Lord';
    var text = opts.text || 'Have church with me anytime';
    var medium = opts.medium || 'share';
    var content = opts.content || '';

    var base = (typeof window.lotlShareUrl === 'function') ? window.lotlShareUrl(path, { campaign: campaign, content: content, medium: medium }) :
      'https://studio.gabochie.com' + path + '?utm_source=lotl&utm_medium=' + encodeURIComponent(medium) + '&utm_campaign=' + encodeURIComponent(campaign) + (content ? '&utm_content=' + encodeURIComponent(content) : '');
    var fullText = text + '\n' + base;

    var wa = 'https://wa.me/?text=' + encodeURIComponent(fullText);
    var xt = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(base);
    var fb = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(base);

    wrap.innerHTML =
      '<div class="lotl-share-row" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">' +
        '<a class="lotl-btn lotl-btn-outline" href="' + esc(wa) + '" target="_blank" rel="noopener" data-lotl-share data-share-path="' + esc(path) + '" data-share-text="' + esc(text) + '" data-share-campaign="' + esc(campaign) + '" data-share-content="' + esc(content) + '" title="Share on WhatsApp"><i class="ti ti-brand-whatsapp" style="font-size:16px;vertical-align:middle;margin-right:6px"></i>WhatsApp</a>' +
        '<a class="lotl-btn lotl-btn-outline" href="' + esc(xt) + '" target="_blank" rel="noopener" title="Share on X / Twitter"><i class="ti ti-brand-x" style="font-size:16px;vertical-align:middle;margin-right:6px"></i>X</a>' +
        '<a class="lotl-btn lotl-btn-outline" href="' + esc(fb) + '" target="_blank" rel="noopener" title="Share on Facebook"><i class="ti ti-brand-facebook" style="font-size:16px;vertical-align:middle;margin-right:6px"></i>Facebook</a>' +
        '<button type="button" class="lotl-btn lotl-btn-outline" id="lotlCopyLink" title="Copy link"><i class="ti ti-link" style="font-size:16px;vertical-align:middle;margin-right:6px"></i>Copy</button>' +
      '</div>';

    var copyBtn = wrap.querySelector('#lotlCopyLink');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(base).then(function () {
          var orig = copyBtn.textContent;
          copyBtn.textContent = 'Copied';
          copyBtn.style.color = '#34C77B';
          setTimeout(function () { copyBtn.textContent = orig; copyBtn.style.color = ''; }, 1500);
        }).catch(function () {});
      });
    }
  }

  window.lotlSubscribe = lotlSubscribe;
  window.lotlShareButtons = lotlShareButtons;
})();