/* MomoDirect — manual MTN Mobile Money checkout widget (site-wide).
 * Shows the dedicated MoMo number + unique reference, collects the MoMo
 * transaction ID, and records the claim. Nothing settles automatically:
 * the owner confirms each payment in the admin panel.
 *
 * Usage:
 *   MomoDirect.start({ purpose: 'donation', amount: 50, name, email, phone })
 *   MomoDirect.start({ tx_ref: 'books_...', name, email })   // product flows
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
    '#momoD-body .md-num{font-family:Space Mono,ui-monospace,monospace;font-size:19px;font-weight:700;letter-spacing:.03em}',
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
    '#momoD-ref{color:#C9A84C}'
  ].join('');

  function close() {
    var w = document.getElementById('momoD-wrap');
    if (w) w.remove();
  }

  function copyBtn(id, val, label) {
    return '<button type="button" class="md-copy" data-mdcopy="' + esc(val) + '" id="' + id + '">' + esc(label || 'Copy') + '</button>';
  }

  window.MomoDirect = {
    start: function (opts) {
      opts = opts || {};
      var btn = opts.button;
      var btnDisabled = false, btnLabel = '';
      if (btn && btn.disabled !== undefined) { btnDisabled = btn.disabled; btnLabel = btn.textContent; btn.disabled = true; if (btn.textContent !== undefined) btn.textContent = 'Preparing MoMo...'; }

      fetch('/api/gateways/momo/create', {
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
            if (typeof window.payToast === 'function') window.payToast(res.d.message || 'MoMo is unavailable right now.', 'momo_error', 'momo');
            else alert(res.d.message || 'MoMo is unavailable right now.');
            return;
          }
          var d = res.d;
          var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
          var wrap = document.createElement('div'); wrap.id = 'momoD-wrap';
          wrap.innerHTML =
            '<div id="momoD-box" role="dialog" aria-modal="true" aria-label="MTN MoMo payment">' +
              '<div id="momoD-head"><h3>' + esc(d.network) + ' MoMo — Pay from your phone</h3><button type="button" id="momoD-close" aria-label="Close">&times;</button></div>' +
              '<div id="momoD-body">' +
                '<div class="md-lbl">Amount to send</div>' +
                '<div class="md-val"><span class="md-num">GH&#162; ' + esc(d.amount) + '</span>' + copyBtn('momoD-camt', String(d.amount), 'Copy') + '</div>' +
                '<div class="md-lbl">Send to this ' + esc(d.network) + ' number</div>' +
                '<div class="md-val"><span class="md-num">' + esc(d.momo_number) + '</span>' + copyBtn('momoD-cnum', d.momo_number, 'Copy') + '</div>' +
                '<div class="md-lbl">Account name</div>' +
                '<div class="md-val"><span>' + esc(d.momo_name) + '</span></div>' +
                '<ul id="momoD-steps">' +
                  '<li>Dial <b>*170#</b> \u2192 Transfer Money \u2192 <b>Momo User</b>, or use the <b>MTN MoMo app</b>.</li>' +
                  '<li>Send exactly <b>GH&#162; ' + esc(d.amount) + '</b> to the number above.</li>' +
                  '<li>After paying, enter the <b>Transaction ID</b> from your confirmation SMS below \u2192 submit.</li>' +
                  '<li>Your reference is <b id="momoD-ref">' + esc(d.tx_ref) + '</b> (we track it automatically).</li>' +
                '</ul>' +
                '<div id="momoD-claim">' +
                  '<input type="text" id="momoD-txn" inputmode="numeric" maxlength="24" placeholder="MoMo Transaction ID (from the SMS)" autocomplete="off">' +
                  '<input type="text" id="momoD-phone" maxlength="15" placeholder="Your phone number (optional)" style="margin-top:8px" autocomplete="tel">' +
                  '<button type="button" id="momoD-submit">I have paid \u2014 submit for confirmation</button>' +
                  '<div id="momoD-msg"></div>' +
                '</div>' +
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

          var submit = document.getElementById('momoD-submit');
          submit.addEventListener('click', function () {
            var txn = document.getElementById('momoD-txn').value.trim();
            var phone2 = document.getElementById('momoD-phone').value.trim();
            var msg = document.getElementById('momoD-msg');
            msg.className = ''; msg.id = 'momoD-msg';
            if (!txn) { msg.textContent = 'Enter the Transaction ID from your MoMo confirmation SMS first.'; msg.className = 'err'; return; }
            submit.disabled = true;
            fetch('/api/gateways/momo/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tx_ref: d.tx_ref, momo_txn_id: txn, payer_number: phone2 })
            }).then(function (r) { return r.json().then(function (x) { return { s: r.status, d: x }; }); })
              .then(function (r2) {
                msg.textContent = r2.d.message || (r2.d.status === 'ok' ? 'Submitted.' : 'Could not submit.');
                msg.className = r2.d.status === 'ok' ? 'ok' : 'err';
                if (r2.d.status === 'ok') {
                  submit.textContent = 'Submitted \u2014 awaiting confirmation \u2713';
                  try { navigator.sendBeacon('/api/event', JSON.stringify({ event_type: 'momo_claim_submitted', event_data: 'tx:' + d.tx_ref, page: location.pathname })); } catch (_e) {}
                } else { submit.disabled = false; }
              })
              .catch(function () { msg.textContent = 'Network error — please try again.'; msg.className = 'err'; submit.disabled = false; });
          });

          setTimeout(function () { var t = document.getElementById('momoD-txn'); if (t) t.focus(); }, 60);
        })
        .catch(function () {
          if (btn && !btnDisabled) { btn.disabled = false; btn.textContent = btnLabel; }
          if (typeof window.payToast === 'function') window.payToast('Network error — please try again.', 'momo_error', 'momo');
          else alert('Network error — please try again.');
        });
    }
  };
})();
