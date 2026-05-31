var API = (function() {

  var BASE = '/api/agents';
  var ADMIN_BASE = '/api/admin';

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

  function adminRequest(method, path, body) {
    var url = ADMIN_BASE + path;
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

  function deleteWorkflow(id) {
    return request('DELETE', '/workflows?id=' + encodeURIComponent(id));
  }

  function getSteps(workflowId) {
    return get('/steps?workflow_id=' + encodeURIComponent(workflowId));
  }

  function createStep(workflowId, data) {
    return post('/steps?workflow_id=' + encodeURIComponent(workflowId), data);
  }

  function updateStep(id, data) {
    return put('/steps?id=' + encodeURIComponent(id), data);
  }

  function deleteStep(id) {
    return request('DELETE', '/steps?id=' + encodeURIComponent(id));
  }

  function getActivity() {
    return get('/activity').then(function(data) {
      if (data.status === 'ok') {
        AppState.set('activity', data.activity || []);
      }
      return data.activity || [];
    });
  }

  function getPreferences() {
    return adminRequest('GET', '/preferences');
  }

  function setPreference(key, value) {
    return adminRequest('PUT', '/preferences', {key: key, value: value});
  }

  function getAuditLog(limit) {
    return adminRequest('GET', '/audit?limit=' + (limit||50));
  }

  function logAudit(action, entity_type, entity_id, details) {
    var ak = AppState.get('adminKey') || '';
    return adminRequest('POST', '/audit', {action: action, entity_type: entity_type, entity_id: entity_id, admin_key: ak, details: details});
  }

  function getAgentTypes() {
    return get('/agents').then(function(data) {
      if (data.status === 'ok') {
        AppState.set('agentTypes', data.types || []);
      }
      return data.types || [];
    });
  }

  function spawnAgent(name, typeName, config) {
    return post('/agents', { agent_type_name: typeName, name: name, config: config || {} });
  }

  function updateAgent(id, data) {
    return put('/agents?id=' + encodeURIComponent(id), data);
  }

  function deleteAgent(id) {
    return request('DELETE', '/agents?id=' + encodeURIComponent(id));
  }

  function orchestrate(maxItems) {
    return post('/orchestrate', { max_items: maxItems || 10 });
  }

  function runAction(action, payload) {
    var aiKey = AppState.get('aiKey') || '';
    var opts = Object.assign({ action: action }, payload || {});
    if (aiKey) opts.ai_key = aiKey;
    return post('/run', opts);
  }

  return {
    getStatus: getStatus,
    getRuns: getRuns,
    getQueue: getQueue,
    getWorkflows: getWorkflows,
    createQueueItem: createQueueItem,
    createWorkflow: createWorkflow,
    updateWorkflow: updateWorkflow,
    deleteWorkflow: deleteWorkflow,
    getSteps: getSteps,
    createStep: createStep,
    updateStep: updateStep,
    deleteStep: deleteStep,
    getActivity: getActivity,
    getPreferences: getPreferences,
    setPreference: setPreference,
    getAuditLog: getAuditLog,
    logAudit: logAudit,
    getAgentTypes: getAgentTypes,
    spawnAgent: spawnAgent,
    updateAgent: updateAgent,
    deleteAgent: deleteAgent,
    orchestrate: orchestrate,
    runAction: runAction,
    get: get, post: post, put: put, request: request
  };
})();
