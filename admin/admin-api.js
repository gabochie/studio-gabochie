var API = (function() {

  var BASE = '/api/agents';

  function getToken() {
    return AppState.get('agentAuthToken');
  }

  function getAdminKey() {
    return AppState.get('adminKey');
  }

  function headers(extra) {
    var h = { 'Content-Type': 'application/json' };
    var at = getToken();
    var ak = getAdminKey();
    if (at) h['X-Agent-Auth'] = at;
    if (ak) h['X-Admin-Key'] = ak;
    if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) h[k] = extra[k]; } }
    return h;
  }

  function handleResponse(res, url) {
    if (res.status === 403) {
      AppState.setError('api', 'Authentication failed. Set your Agent Auth token in Settings.');
    }
    if (!res.ok) {
      return res.json().then(function(d) {
        var msg = (d && d.message) || d.error || ('HTTP ' + res.status);
        throw new Error(msg);
      }).catch(function(e) {
        if (e instanceof SyntaxError) throw new Error('HTTP ' + res.status);
        throw e;
      });
    }
    return res.json();
  }

  function request(method, path, body) {
    var url = BASE + path;
    var opts = { method: method, headers: headers() };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    AppState.setError('api', null);
    return fetch(url, opts).then(function(res) { return handleResponse(res, url); });
  }

  function get(path) { return request('GET', path); }
  function post(path, body) { return request('POST', path, body); }
  function put(path, body) { return request('PUT', path, body); }

  function getStatus() {
    return get('/status').then(function(data) {
      if (data.status === 'ok') {
        AppState.merge({
          status: data,
          agents: data.agents || [],
          runs: data.latest_runs || []
        });
      }
      return data;
    });
  }

  function getRuns(params) {
    var q = '?limit=' + (params && params.limit ? params.limit : '100');
    if (params && params.status) q += '&status=' + params.status;
    if (params && params.agent_id) q += '&agent_id=' + params.agent_id;
    return get('/runs' + q).then(function(data) {
      var items = data.items || [];
      AppState.set('runs', items);
      return items;
    });
  }

  function getQueue() {
    return get('/queue').then(function(data) {
      var items = data.items || [];
      AppState.set('queue', items);
      return items;
    });
  }

  function getWorkflows() {
    return get('/workflows').then(function(data) {
      var items = data.items || [];
      AppState.set('workflows', items);
      return items;
    });
  }

  function createQueueItem(item) {
    return post('/queue', item);
  }

  function createWorkflow(wf) {
    return post('/workflows', wf);
  }

  function updateWorkflow(id, data) {
    return put('/workflows?id=' + encodeURIComponent(id), data);
  }

  function getActivity() {
    return get('/activity').then(function(data) {
      if (data.status === 'ok') {
        AppState.set('activity', data.activity || []);
      }
      return data.activity || [];
    });
  }

  function orchestrate(maxItems) {
    return post('/orchestrate', { max_items: maxItems || 10 });
  }

  function runAction(action, payload) {
    return post('/run', { action: action, payload: payload || {} });
  }

  return {
    getStatus: getStatus,
    getRuns: getRuns,
    getQueue: getQueue,
    getWorkflows: getWorkflows,
    createQueueItem: createQueueItem,
    createWorkflow: createWorkflow,
    updateWorkflow: updateWorkflow,
    getActivity: getActivity,
    orchestrate: orchestrate,
    runAction: runAction,
    get: get, post: post, put: put
  };
})();
