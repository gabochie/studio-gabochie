var AppState = (function() {

  var state = {
    tab: 'dashboard',
    agentAuthToken: '',
    adminKey: '',
    status: null,
    runs: [],
    agents: [],
    queue: [],
    workflows: [],
    loading: { dashboard: false, agents: false, workflows: false, runs: false, queue: false, settings: false },
    errors: {}
  };

  var listeners = {};

  function get(key) {
    return key ? state[key] : state;
  }

  function set(key, value) {
    var old = state[key];
    state[key] = value;
    if (old !== value) {
      emit(key, value, old);
      emit('*', key, value, old);
    }
  }

  function merge(obj) {
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) {
        var old = state[k];
        state[k] = obj[k];
        if (old !== obj[k]) { emit(k, obj[k], old); emit('*', k, obj[k], old); }
      }
    }
  }

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return function() { listeners[event] = (listeners[event] || []).filter(function(f) { return f !== fn; }); };
  }

  function emit(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    (listeners[event] || []).forEach(function(fn) { try { fn.apply(null, args); } catch(e) {} });
  }

  return {
    get: get,
    set: set,
    merge: merge,
    on: on,
    loading: function(key) { return state.loading[key]; },
    error: function(key) { return state.errors[key]; },
    setError: function(key, msg) {
      state.errors[key] = msg;
      emit('error', key, msg);
      emit('*', 'errors', state.errors);
    },
    clearError: function(key) {
      delete state.errors[key];
      emit('error', key, null);
      emit('*', 'errors', state.errors);
    }
  };
})();

(function initTokens() {
  try {
    var at = localStorage.getItem('ga_at');
    var ak = localStorage.getItem('ga_ak');
    if (at) AppState.set('agentAuthToken', at);
    if (ak) AppState.set('adminKey', ak);
  } catch(e) {}
})();
