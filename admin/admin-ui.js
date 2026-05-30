/* ── DOM builder ── */
function el(tag, attrs) {
  var elem = document.createElement(tag);
  if (attrs) {
    for (var k in attrs) {
      if (attrs.hasOwnProperty(k)) {
        var v = attrs[k];
        if (k === 'className') { elem.className = v; }
        else if (k === 'textContent') { elem.textContent = v; }
        else if (k === 'htmlContent') { elem.innerHTML = v; }
        else if (k === 'style' && typeof v === 'object') {
          for (var sk in v) { if (v.hasOwnProperty(sk)) elem.style[sk] = v[sk]; }
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          elem.addEventListener(k.slice(2).toLowerCase(), v);
        } else { elem.setAttribute(k, v); }
      }
    }
  }
  var children = Array.prototype.slice.call(arguments, 2);
  children.forEach(function(c) { if (c != null) elem.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return elem;
}

function frag() {
  var f = document.createDocumentFragment();
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] != null) f.appendChild(typeof arguments[i] === 'string' ? document.createTextNode(arguments[i]) : arguments[i]);
  }
  return f;
}

/* ── Toast ── */
var Toast = (function() {
  var container;
  function ensure() {
    if (!container) {
      container = el('div', { className: 'toast-container' });
      document.body.appendChild(container);
    }
    return container;
  }
  function show(message, type, duration) {
    var c = ensure();
    type = type || 'info';
    duration = duration || 4000;
    var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: '\u2139' };
    var icon = icons[type] || '\u2139';
    var toast = el('div', { className: 'toast toast-' + type },
      el('span', { className: 'toast-icon', textContent: icon }),
      el('span', { className: 'toast-msg', textContent: message })
    );
    c.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  }
  return { success: function(m, d) { show(m, 'success', d); }, error: function(m, d) { show(m, 'error', d || 6000); }, warning: function(m, d) { show(m, 'warning', d); }, info: function(m, d) { show(m, 'info', d); }, show: show };
})();

/* ── Modal ── */
var Modal = (function() {
  var stack = [];
  function create(id, contentFn) {
    var overlay = el('div', { className: 'modal-overlay', id: id, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-title' });
    var modal = el('div', { className: 'modal' });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(id); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && stack.length && stack[stack.length - 1] === id) close(id);
    });
    function getModal() { return overlay.querySelector('.modal'); }
    function open() {
      overlay.classList.add('open');
      if (stack.length) stack[stack.length - 1] && document.getElementById(stack[stack.length - 1]);
      stack.push(id);
      focusFirst(overlay);
    }
    function close() {
      overlay.classList.remove('open');
      stack = stack.filter(function(s) { return s !== id; });
    }
    function render(htmlOrEl) {
      var m = getModal();
      if (m) { m.innerHTML = ''; if (typeof htmlOrEl === 'string') m.innerHTML = htmlOrEl; else m.appendChild(htmlOrEl); }
    }
    function setTitle(title) {
      var m = getModal();
      if (m) { var h = m.querySelector('.modal-title'); if (h) h.textContent = title; }
    }
    function focusFirst(parent) {
      var inputs = parent.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
      if (inputs.length) setTimeout(function() { inputs[0].focus(); }, 50);
    }
    return { overlay: overlay, open: open, close: close, render: render, setTitle: setTitle, id: id };
  }
  function close(id) {
    if (id) { var o = document.getElementById(id); if (o) o.classList.remove('open'); }
    else { document.querySelectorAll('.modal-overlay.open').forEach(function(o) { o.classList.remove('open'); }); }
  }
  return { create: create, close: close };
})();

/* ── Tabs ── */
var Tabs = (function() {
  var instances = {};
  function create(opts) {
    var tabBar = opts.tabBar;
    var panels = opts.panels || {};
    var defaultTab = opts.default || Object.keys(panels)[0] || '';
    var onChange = opts.onChange || function() {};
    var current = defaultTab;
    var tabElements = tabBar.querySelectorAll('[data-tab]');
    function switchTab(name) {
      if (!name || !panels[name]) return;
      current = name;
      tabElements.forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
      for (var k in panels) {
        if (panels.hasOwnProperty(k)) {
          panels[k].classList.toggle('active', k === name);
        }
      }
      onChange(name);
    }
    tabElements.forEach(function(t) {
      t.addEventListener('click', function() { switchTab(t.getAttribute('data-tab')); });
    });
    switchTab(defaultTab);
    var inst = { switchTab: switchTab, getCurrent: function() { return current; } };
    instances[opts.id || 'default'] = inst;
    return inst;
  }
  return { create: create, get: function(id) { return instances[id || 'default']; } };
})();

/* ── Skeleton ── */
var Skeleton = {
  stat: function() { return '<div class="skeleton skeleton-stat"></div>'; },
  line: function(width) { return '<div class="skeleton skeleton-line' + (width ? ' w' + width : '') + '"></div>'; },
  card: function() { return '<div class="skeleton skeleton-card"></div>'; },
  table: function(rows, cols) {
    rows = rows || 5; cols = cols || 6;
    var h = '';
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        h += '<div class="skeleton skeleton-line" style="width:' + (40 + Math.random() * 50) + '%;margin-bottom:12px;display:inline-block;margin-right:2%"></div>';
      }
      h += '<div style="margin-bottom:8px"></div>';
    }
    return h;
  }
};

/* ── Time formatting ── */
function formatTime(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso.replace(' ', 'T') + 'Z');
    var now = new Date();
    var diff = Math.round((now - d) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return diff + 'm ago';
    var hrs = Math.round(diff / 60);
    if (hrs < 24) return hrs + 'h ago';
    if (hrs < 48) return 'yesterday';
    return d.toLocaleDateString();
  } catch(e) { return iso; }
}

/* ── Status badge helper ── */
function statusBadge(s) {
  if (!s) return '<span class="tag tag-dim">-</span>';
  var m = { idle: 'tag-gold', busy: 'tag-blue', online: 'tag-green', offline: 'tag-dim', error: 'tag-red', completed: 'tag-green', pending: 'tag-purple', in_progress: 'tag-blue', active: 'tag-green' };
  var cls = m[s.toLowerCase()] || 'tag-dim';
  return '<span class="tag ' + cls + '">' + s + '</span>';
}

function statusDot(s) {
  if (!s) return '<span class="activity-dot"></span>';
  var cls = s.toLowerCase();
  return '<span class="activity-dot ' + cls + '"></span>';
}
