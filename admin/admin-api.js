var API = (function() {

  var BASE = '/api/agents';
  var ADMIN_BASE = '/api/admin';

  function getToken() {
    return AdminState.get('agentAuthToken');
  }

  function getAdminKey() {
    return AdminState.get('adminKey');
  }

  function headers(extra) {
    var h = { 'Content-Type': 'application/json' };
    var at = getToken();
    var ak = getAdminKey();
    if (at) h['X-Agent-Auth'] = at;
    if (ak) h['X-Admin-Key'] = ak;
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k]; } }
    return h;
  }

  function handleResponse(res, url) {
    if (res.status === 403) {
      AdminState.setError('api', 'Authentication failed. Set your Agent Auth token in Settings.');
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
    AdminState.setError('api', null);
    return fetch(url, opts).then(function(res) { return handleResponse(res, url); });
  }

  function adminRequest(method, path, body) {
    var url = ADMIN_BASE + path;
    var opts = { method: method, headers: headers() };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    AdminState.setError('api', null);
    return fetch(url, opts).then(function(res) { return handleResponse(res, url); });
  }

  function get(path) { return request('GET', path); }
  function post(path, body) { return request('POST', path, body); }
  function put(path, body) { return request('PUT', path, body); }

  function getStatus() {
    return get('/status').then(function(data) {
      if (data.status === 'ok') {
        AdminState.merge({
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
      AdminState.set('runs', items);
      return items;
    });
  }

  function getQueue() {
    return get('/queue').then(function(data) {
      var items = data.items || [];
      AdminState.set('queue', items);
      return items;
    });
  }

  function getWorkflows() {
    return get('/workflows').then(function(data) {
      var items = data.items || [];
      AdminState.set('workflows', items);
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
        AdminState.set('activity', data.activity || []);
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
    var ak = AdminState.get('adminKey') || '';
    return adminRequest('POST', '/audit', {action: action, entity_type: entity_type, entity_id: entity_id, admin_key: ak, details: details});
  }

  function getAgentTypes() {
    return get('/agents').then(function(data) {
      if (data.status === 'ok') {
        AdminState.set('agentTypes', data.types || []);
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

  function getColdOutreach(params) {
    var q = '';
    if (params) {
      if (params.status) q += '&status=' + encodeURIComponent(params.status);
      if (params.category) q += '&category=' + encodeURIComponent(params.category);
      if (params.campaign) q += '&campaign=' + encodeURIComponent(params.campaign);
      if (params.search) q += '&search=' + encodeURIComponent(params.search);
      if (params.page) q += '&page=' + params.page;
      if (params.limit) q += '&limit=' + params.limit;
    }
    return adminRequest('GET', '/cold-outreach?' + q.substring(1));
  }

  function updateColdOutreach(id, data) {
    return adminRequest('PUT', '/cold-outreach', Object.assign({ id: id }, data));
  }

  function getInvoices(params) {
    var q = '';
    if (params) {
      if (params.type) q += '&type=' + encodeURIComponent(params.type);
      if (params.status) q += '&status=' + encodeURIComponent(params.status);
      if (params.search) q += '&search=' + encodeURIComponent(params.search);
      if (params.page) q += '&page=' + params.page;
      if (params.limit) q += '&limit=' + params.limit;
    }
    return adminRequest('GET', '/invoices?' + q.substring(1));
  }

  function getEmailQueue(params) {
    var q = '';
    if (params) {
      if (params.status) q += '&status=' + encodeURIComponent(params.status);
      if (params.limit) q += '&limit=' + params.limit;
    }
    return adminRequest('GET', '/email-queue?' + q.substring(1));
  }

  function updateInvoice(id, data) {
    return adminRequest('PUT', '/invoices?id=' + encodeURIComponent(id), data);
  }

  function getSubmissions(params) {
    var q = '';
    if (params) {
      if (params.status) q += '&status=' + encodeURIComponent(params.status);
      if (params.limit) q += '&limit=' + params.limit;
    }
    return adminRequest('GET', '/submissions?' + q.substring(1));
  }

  function updateSubmission(id, data) {
    return adminRequest('PUT', '/submissions?id=' + encodeURIComponent(id), data);
  }

  function orchestrate(maxItems) {
    return post('/orchestrate', { max_items: maxItems || 10 });
  }

  function runAction(action, payload) {
    var aiKey = AdminState.get('aiKey') || '';
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
    getColdOutreach: getColdOutreach,
    updateColdOutreach: updateColdOutreach,
    getInvoices: getInvoices,
    updateInvoice: updateInvoice,
    getEmailQueue: getEmailQueue,
    getSubmissions: getSubmissions,
    updateSubmission: updateSubmission,
    orchestrate: orchestrate,
    runAction: runAction,
    get: get, post: post, put: put, request: request
  };
})();
