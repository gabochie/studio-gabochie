(function () {
  var slug = window.COURSE_SLUG || '';
  function findCourse(data) {
    var courses = (data && data.courses) || [];
    for (var i = 0; i < courses.length; i++) {
      if (courses[i].slug === slug) return courses[i];
    }
    return null;
  }

  function openEnroll() {
    document.getElementById('enrollModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('enrollName').focus();
  }
  function closeEnroll() {
    document.getElementById('enrollModal').classList.remove('open');
    document.body.style.overflow = '';
  }
  function toggleFaq(btn) {
    var item = btn.closest('.faq-item');
    if (!item) return;
    item.classList.toggle('open');
  }

  function init() {
    var c = findCourse(window.COURSE_DATA);
    if (c) {
      var els = {
        heroTagline: document.getElementById('heroTagline'),
        heroDesc: document.getElementById('heroDesc'),
        heroSample: document.getElementById('heroSample'),
        priceValue: document.getElementById('priceValue'),
        priceNote: document.getElementById('priceNote'),
        priceMeta: document.getElementById('priceMeta'),
        outcomesGrid: document.getElementById('outcomesGrid'),
        moduleList: document.getElementById('moduleList'),
        curriculumSub: document.getElementById('curriculumSub'),
        whoItsFor: document.getElementById('whoItsFor'),
        ctaBandSub: document.getElementById('ctaBandSub'),
        enrollSub: document.getElementById('enrollSub'),
        faqList: document.getElementById('faqList')
      };
      if (els.heroTagline) els.heroTagline.textContent = c.tagline || '';
      if (els.heroDesc) els.heroDesc.textContent = c.description || '';
      if (els.heroSample) els.heroSample.textContent = c.sampleIncludes || 'Module 1 free - no card required';
      if (els.priceValue) {
        els.priceValue.innerHTML = (c.price > 0 ? 'GH\u00a2 ' + c.price : 'Free') + (c.price > 0 ? ' <small>one-time</small>' : '');
      }
      if (els.priceNote) els.priceNote.textContent = c.priceNote || '';
      if (els.priceMeta) {
        var meta = [];
        var addMeta = function (icon, text) {
          if (text) meta.push('<span><i class="ti ' + icon + '"></i> ' + text + '</span>');
        };
        addMeta('ti-clock', c.duration);
        addMeta('ti-chart-line', c.level);
        addMeta('ti-certificate', c.certification);
        els.priceMeta.innerHTML = meta.join('');
      }
      if (els.outcomesGrid && c.outcomes) {
        els.outcomesGrid.innerHTML = c.outcomes.map(function (o) {
          return '<div class="outcome"><i class="ti ti-check"></i><span>' + o + '</span></div>';
        }).join('');
      }
      if (els.moduleList && c.modules) {
        els.moduleList.innerHTML = c.modules.map(function (m, i) {
          return '<div class="module-item"><div class="module-num">' + (i + 1) + '</div><div><h3>' + m.title + '</h3><p>' + m.summary + '</p></div></div>';
        }).join('');
      }
      if (els.curriculumSub) {
        els.curriculumSub.textContent = (c.modules ? c.modules.length : 0) + ' short, practical modules. ' + (c.duration || 'Self-paced') + '.';
      }
      if (els.whoItsFor) els.whoItsFor.textContent = c.whoItsFor || '';
      if (els.ctaBandSub) els.ctaBandSub.textContent = c.sampleIncludes || 'Module 1 free, no card required.';
      if (els.enrollSub) els.enrollSub.textContent = c.tagline || '';
      if (els.faqList && c.faqs) {
        els.faqList.innerHTML = c.faqs.map(function (f) {
          return '<div class="faq-item"><button class="faq-question" onclick="toggleFaq(this)">' + f.q + ' <i class="ti ti-chevron-down"></i></button><div class="faq-answer">' + f.a + '</div></div>';
        }).join('');
      }
    }

    var modal = document.getElementById('enrollModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeEnroll();
      });
    }
    var form = document.getElementById('enrollForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('enrollName').value.trim();
        var email = document.getElementById('enrollEmail').value.trim();
        var phone = document.getElementById('enrollPhone').value.trim();
        var btn = document.getElementById('enrollBtn');
        var msg = document.getElementById('enrollMsg');
        if (!name || !email || !email.includes('@')) {
          msg.className = 'msg err';
          msg.innerHTML = 'Please enter your name and a valid email.';
          return;
        }
        if (typeof window.tagOnboard === 'function') window.tagOnboard(email, name, 'course:' + slug);
        btn.disabled = true;
        btn.innerHTML = 'Enrolling...';
        msg.className = 'msg';
        var utm = {};
        try { var u = JSON.parse(localStorage.getItem('ga_utm') || '{}'); if (u && u.utm_source) utm = u; } catch (_e) {}
        fetch('/api/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_slug: slug, name: name, email: email, phone: phone, utm: utm })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d.status === 'ok') {
            msg.className = 'msg ok';
            msg.innerHTML = "<strong>You're in!</strong> Check your email for dashboard access. <a href='/dashboard/?token=" + (d.enrollment ? d.enrollment.access_token : '') + "'>Go to your dashboard &rarr;</a>";
            btn.style.display = 'none';
            if (typeof window.tagOnboard === 'function') window.tagOnboard(email, name, 'enrolled:' + slug);
          } else {
            msg.className = 'msg err';
            msg.innerHTML = d.message || 'Something went wrong. Please try again.';
            btn.disabled = false;
            btn.innerHTML = 'Start Free';
          }
        }).catch(function () {
          msg.className = 'msg err';
          msg.innerHTML = 'Network error. Please check your connection and try again.';
          btn.disabled = false;
          btn.innerHTML = 'Start Free';
        });
      });
    }
  }

  window.openEnroll = openEnroll;
  window.closeEnroll = closeEnroll;
  window.toggleFaq = toggleFaq;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();