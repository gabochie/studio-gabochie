/* MomoDirect — manual Ghana rails checkout widget (site-wide): MTN MoMo + bank transfer.
 * Shows the owner's dedicated MoMo number / bank account + a unique reference,
 * collects the payment transaction ID, and records the claim. Nothing settles
 * automatically: the owner confirms each payment in the admin queue.
 *
 * Usage:
 *   MomoDirect.start({ purpose: 'donation', amount: 50, name, email, phone })
 *   MomoDirect.start({ tx_ref: 'books_...', name, email })      // product flows
 *   MomoDirect.start({ rail: 'bank', ... })                      // bank tab first
 *   BankDirect.start({...}) — same modal, bank tab first
 * Optional: { button } — a submit button to disable/restore during the call.
 */
(function () {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s == null ? '' : String(s)));
    return d.innerHTML;
  }

  var CSS = [
    '#momoD-wrap{position:fixed;inset:0;background:rgba(4,10,22,.78);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif}',
    '#momoD-box{background:#0F1D33;border:1px solid #1E3250;border-radius:16px;max-width:430px;width:100%;max-height:92vh;overflow:auto;color:#CBD5E1}',
    '#momoD-head{background:#FFCC00;color:#0A1628;padding:14px 20px;border-radius:15px 15px 0 0;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '#momoD-head h3{margin:0;font-size:16px;font-weight:800;letter-spacing:.02em}',
    '#momoD-close{background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:#0A1628;padding:0 2px;font-weight:700}',
    '#momoD-body{padding:20px}',
    '#momoD-body .md-lbl{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#7A93B5;margin:12px 0 4px}',
    '#momoD-body .md-lbl:first-child{margin-top:0}',
    '#momoD-body .md-val{background:#0A1628;border:1px solid #1E3250;border-radius:10px;padding:10px 14px;font-size:15px;color:#F1F5F9;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '#momoD-body .md-num{font-family:Space Mono,ui-monospace,monospace;font-size:17px;font-weight:700;letter-spacing:.02em;overflow-wrap:anywhere}',
    '#momoD-body .md-copy{background:#C9A84C;color:#0A1628;border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}',
    '#momoD-steps{font-size:12.5px;line-height:1.65;color:#8A9BB5;margin:12px 0 0;padding-left:18px}',
    '#momoD-steps b{color:#F1F5F9}',
    '#momoD-claim{margin-top:16px;border-top:1px solid #1E3250;padding-top:14px}',
    '#momoD-claim input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid #1E3250;background:#0A1628;color:#F1F5F9;font-size:14px;outline:none;box-sizing:border-box}',
    '#momoD-claim input:focus{border-color:#FFCC00}',
    '#momoD-submit{width:100%;margin-top:10px;padding:12px;border:none;border-radius:9px;background:#FFCC00;color:#0A1628;font-weight:800;font-size:14px;cursor:pointer}',
    '#momoD-submit:disabled{opacity:.55;cursor:default}',
    '#momoD-msg{margin-top:10px;font-size:12.5px;line-height:1.55;display:none;border-radius:8px;padding:9px 12px}',
    '#momoD-msg.err{display:block;color:#F87171;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3)}',
    '#momoD-msg.ok{display:block;color:#34C77B;background:rgba(52,199,123,.1);border:1px solid rgba(52,199,123,.3)}',
    '#momoD-ref{color:#C9A84C}',
    '#momoD-switch{margin-top:12px;text-align:center;font-size:12px;color:#5A7A9F}',
    '#momoD-switch a{color:#C9A84C;cursor:pointer;text-decoration:underline}'
  ].join('');

  function close() {
    var w = document.getElementById('momoD-wrap');
    if (w) w.remove();
  }

  var HEADERS = {
    momo: { bg: '#FFCC00', fg: '#0A1628', title: 'MTN MoMo — Pay from your phone' },
    bank: { bg: '#C9A84C', fg: '#0A1628', title: 'Bank Transfer — Pay from your bank app' }
  };

  function open(opts) {
    opts = opts || {};
    var rail = opts.rail === 'bank' ? 'bank' : 'momo';
    var btn = opts.button;
    var btnDisabled = false, btnLabel = '';
    if (btn && btn.disabled !== undefined) { btnDisabled = btn.disabled; btnLabel = btn.textContent; btn.disabled = true; if (btn.textContent !== undefined) btn.textContent = 'Preparing payment...'; }

    fetch(rail === 'bank' ? '/api/gateways/bank/create' : '/api/gateways/momo/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: opts.tx_ref || '',
        purpose: opts.purpose || 'donation',
        token: opts.token || '',
        plan: opts.plan || '',
        amount: opts.amount || 0,
        name: opts.name || '',
        email: opts.email || '',
        phone: opts.phone || '',
        redirect: opts.redirect || ''
      })
    }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
      .then(function (res) {
        if (btn && !btnDisabled) { btn.disabled = false; btn.textContent = btnLabel; }
        if (res.d.status !== 'ok') {
          if (res.d.already) {
            if (typeof window.payToast === 'function') window.payToast(res.d.message || 'Already unlocked.', 'momo_info', rail);
            else alert(res.d.message || 'Already unlocked.');
            return;
          }
          if (typeof window.payToast === 'function') window.payToast(res.d.message || 'This payment option is unavailable right now.', 'momo_error', rail);
          else alert(res.d.message || 'This payment option is unavailable right now.');
          return;
        }
        var d = res.d;
        var other = rail === 'bank' ? 'momo' : 'bank';
        var h = HEADERS[rail];

        var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
        var wrap = document.createElement('div'); wrap.id = 'momoD-wrap';
        var isMomo = rail === 'momo';
        var steps = isMomo
          ? '<li>Dial <b>*170#</b> \u2192 Transfer Money \u2192 <b>Momo User</b>, or use the <b>MTN MoMo app</b>.</li>' +
            '<li>Send exactly <b>GH\u00a2 ' + esc(d.amount) + '</b> to the number above.</li>'
          : '<li>Open your <b>bank app</b> and transfer exactly <b>GH\u00a2 ' + esc(d.amount) + '</b> to the account above.</li>' +
            '<li>You can send from any Ghanaian bank \u2014 use the reference below so we can match it.</li>';
        wrap.innerHTML =
          '<div id="momoD-box" role="dialog" aria-modal="true" aria-label="' + esc(h.title) + '">' +
            '<div id="momoD-head" style="background:' + h.bg + '"><h3 style="color:' + h.fg + '">' + esc(h.title) + '</h3><button type="button" id="momoD-close" aria-label="Close" style="color:' + h.fg + '">&times;</button></div>' +
            '<div id="momoD-body">' +
              '<div class="md-lbl">Amount to send</div>' +
              '<div class="md-val"><span class="md-num">GH\u00a2 ' + esc(d.amount) + '</span>' + copyBtn('momoD-camt', String(d.amount), 'Copy') + '</div>' +
              '<div class="md-lbl">' + esc(d.destination_label) + '</div>' +
              '<div class="md-val"><span class="md-num">' + esc(d.destination) + '</span>' + copyBtn('momoD-cnum', d.destination, 'Copy') + '</div>' +
              '<div class="md-lbl">Account name</div>' +
              '<div class="md-val"><span>' + esc(d.account_name) + '</span></div>' +
              '<ul id="momoD-steps">' + steps +
                '<li>After paying, enter the <b>Transaction / Transfer ID</b> from your payment confirmation below \u2192 submit.</li>' +
                '<li>Your reference is <b id="momoD-ref">' + esc(d.tx_ref) + '</b> (we track it automatically).</li>' +
              '</ul>' +
              '<div id="momoD-claim">' +
                '<input type="text" id="momoD-txn" inputmode="numeric" maxlength="24" placeholder="Transaction ID (from your payment confirmation)" autocomplete="off">' +
                '<input type="text" id="momoD-phone" maxlength="15" placeholder="Your phone number (optional)" style="margin-top:8px" autocomplete="tel">' +
                '<button type="button" id="momoD-submit">I have paid \u2014 submit for confirmation</button>' +
                '<div id="momoD-msg"></div>' +
              '</div>' +
              '<div id="momoD-switch">Prefer ' + (isMomo ? 'a bank transfer' : 'MTN MoMo') + ' instead? <a id="momoD-alt">Switch</a></div>' +
            '</div>' +
          '</div>';
        document.body.appendChild(wrap);

        wrap.addEventListener('click', function (e) {
          if (e.target === wrap) close();
          var c = e.target.closest && e.target.closest('[data-mdcopy]');
          if (c) {
            var v = c.getAttribute('data-mdcopy');
            var done = function () { c.textContent = '\u2713 Copied'; setTimeout(function () { c.textContent = 'Copy'; }, 1600); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done);
            else done();
          }
        });
        document.getElementById('momoD-close').addEventListener('click', close);
        document.getElementById('momoD-alt').addEventListener('click', function () {
          close();
          open(Object.assign({}, opts, { rail: other }));
        });

        var submit = document.getElementById('momoD-submit');
        submit.addEventListener('click', function () {
          var txn = document.getElementById('momoD-txn').value.trim();
          var phone2 = document.getElementById('momoD-phone').value.trim();
          var msg = document.getElementById('momoD-msg');
          msg.className = ''; msg.id = 'momoD-msg';
          if (!txn) { msg.textContent = 'Enter the Transaction ID from your payment confirmation first.'; msg.className = 'err'; return; }
          submit.disabled = true;
          fetch('/api/gateways/momo/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tx_ref: d.tx_ref, momo_txn_id: txn, payer_number: phone2, rail: rail })
          }).then(function (r) { return r.json().then(function (x) { return { s: r.status, d: x }; }); })
            .then(function (r2) {
              msg.textContent = r2.d.message || (r2.d.status === 'ok' ? 'Submitted.' : 'Could not submit.');
              msg.className = r2.d.status === 'ok' ? 'ok' : 'err';
              if (r2.d.status === 'ok') {
                submit.textContent = 'Submitted \u2014 awaiting confirmation \u2713';
                try { navigator.sendBeacon('/api/event', JSON.stringify({ event_type: 'momo_claim_submitted', event_data: 'tx:' + d.tx_ref + ' rail:' + rail, page: location.pathname })); } catch (_e) {}
              } else { submit.disabled = false; }
            })
            .catch(function () { msg.textContent = 'Network error — please try again.'; msg.className = 'err'; submit.disabled = false; });
        });

        setTimeout(function () { var t = document.getElementById('momoD-txn'); if (t) t.focus(); }, 60);
      })
      .catch(function () {
        if (btn && !btnDisabled) { btn.disabled = false; btn.textContent = btnLabel; }
        if (typeof window.payToast === 'function') window.payToast('Network error — please try again.', 'momo_error', rail);
        else alert('Network error — please try again.');
      });
  }

  function copyBtn(id, val, label) {
    return '<button type="button" class="md-copy" data-mdcopy="' + esc(val) + '" id="' + id + '">' + esc(label || 'Copy') + '</button>';
  }

  window.MomoDirect = { start: open };
  window.BankDirect = { start: function (opts) { open(Object.assign({}, opts || {}, { rail: 'bank' })); } };
})();
