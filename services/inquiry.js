(function() {
  window.submitServiceInquiry = function(formEl) {
    if (!formEl) return;
    var btn = formEl.querySelector('button[type="submit"]');
    var msgEl = formEl.querySelector('.si-msg');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    if (msgEl) { msgEl.style.display = 'none'; msgEl.className = 'si-msg'; }
    var gotcha = formEl.querySelector('input[name="_gotcha"]');
    if (gotcha) gotcha.value = '';
    var data = new FormData(formEl);
    fetch('/api/services/inquiry', { method: 'POST', body: data })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.status === 'ok') {
          if (msgEl) {
            msgEl.textContent = 'Thanks! We have received your inquiry and will get back to you within 1-2 business days.';
            msgEl.className = 'si-msg si-msg-success';
            msgEl.style.display = 'block';
          }
          formEl.reset();
        } else {
          if (msgEl) {
            msgEl.textContent = res.message || 'Something went wrong. Please try again or email us directly.';
            msgEl.className = 'si-msg si-msg-error';
            msgEl.style.display = 'block';
          }
        }
      })
      .catch(function() {
        if (msgEl) {
          msgEl.textContent = 'Network error. Please check your connection and try again.';
          msgEl.className = 'si-msg si-msg-error';
          msgEl.style.display = 'block';
        }
      })
      .finally(function() {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Inquiry'; }
      });
  };
})();
