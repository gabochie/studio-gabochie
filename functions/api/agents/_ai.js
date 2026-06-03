var PROVIDERS = [
  {
    name: 'openai',
    match: function(m) { return /^gpt-|^o1-|^o3-/.test(m); },
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: function(key) { return { 'Authorization': 'Bearer ' + key }; },
    body: function(model, sys, msgs, opts) {
      var b = { model: model, messages: msgs, temperature: opts.temperature, max_tokens: opts.maxTokens };
      if (sys) b.messages = [{ role: 'system', content: sys }].concat(msgs);
      return b;
    },
    parse: function(data) { return { content: data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content, usage: data.usage }; }
  },
  {
    name: 'openrouter',
    match: function() { return true; },
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: function(key) { return { 'Authorization': 'Bearer ' + key }; },
    body: function(model, sys, msgs, opts) {
      var b = { model: model, messages: msgs, temperature: opts.temperature, max_tokens: opts.maxTokens };
      if (sys) b.messages = [{ role: 'system', content: sys }].concat(msgs);
      return b;
    },
    parse: function(data) { return { content: data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content, usage: data.usage }; }
  },
  {
    name: 'anthropic',
    match: function(m) { return /^claude-/.test(m); },
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: function(key) { return { 'x-api-key': key, 'anthropic-version': '2023-06-01' }; },
    body: function(model, sys, msgs, opts) {
      var b = { model: model, max_tokens: opts.maxTokens || 1024, messages: msgs };
      if (sys) b.system = sys;
      if (opts.temperature !== undefined) b.temperature = opts.temperature;
      return b;
    },
    parse: function(data) { return { content: data.content && data.content[0] && data.content[0].text, usage: data.usage }; }
  }
];

function buildFallbackChain(model) {
  var primary = PROVIDERS.filter(function(p) { return p.match(model); });
  var rest = PROVIDERS.filter(function(p) { return !p.match(model); });
  return primary.concat(rest);
}

function getKey(env, options, providerName) {
  if (options && options.api_key) return options.api_key;
  if (providerName === 'openai') return env.OPENAI_API_KEY || env.AI_API_KEY || '';
  if (providerName === 'openrouter') return env.OPENROUTER_API_KEY || '';
  if (providerName === 'anthropic') return env.ANTHROPIC_API_KEY || '';
  return '';
}

function isRetryable(res) {
  var code = res.status;
  return code === 401 || code === 403 || code === 429 || code >= 500;
}

export async function callAI(env, systemPrompt, userPrompt, options) {
  options = options || {};
  var model = options.model || 'gpt-4o-mini';
  var temperature = options.temperature !== undefined ? options.temperature : 0.7;
  var maxTokens = options.max_tokens !== undefined ? options.max_tokens : 1024;
  var messages = [{ role: 'user', content: userPrompt }];
  var chain = buildFallbackChain(model);
  var lastError = '';

  for (var i = 0; i < chain.length; i++) {
    var provider = chain[i];
    var apiKey = getKey(env, options, provider.name);
    if (!apiKey) { lastError = 'No API key for ' + provider.name; continue; }

    try {
      var body = provider.body(model, systemPrompt, messages, { temperature: temperature, maxTokens: maxTokens });
      var res = await fetch(provider.endpoint, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, provider.headers(apiKey)),
        body: JSON.stringify(body)
      });
      var data = await res.json();

      if (!res.ok) {
        if (isRetryable(res)) { lastError = (data.error && data.error.message) || 'HTTP ' + res.status; continue; }
        return { error: (data.error && data.error.message) || 'HTTP ' + res.status };
      }

      return provider.parse(data);
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return { error: lastError || 'All AI providers failed' };
}
