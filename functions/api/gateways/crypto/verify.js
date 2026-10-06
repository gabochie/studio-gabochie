import { json, readBody, ghsToUsd, finalizeCryptoPayment } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';

// Manual on-chain verification for direct wallet payments.
// POST { tx_ref, chain, tx_hash } — confirms the tx exists, is settled,
// pays one of our addresses, and covers the invoiced USD value (±2%).
// Supported chains: bitcoin, tron, bsc, polygon, ethereum, solana.
// Uses only keyless public APIs/RPCs. Never handles private keys.

const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523baf9';
const TRC20_USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM_TOKENS = {
  bsc: [
    { symbol: 'USDT', contract: '0x55d398a78f402414fd394685a394217bc7e98ada2', decimals: 18 },
    { symbol: 'USDC', contract: '0x8ac76a08582defb4f5679d2feb9c45d6955b1e', decimals: 18 }
  ],
  polygon: [
    { symbol: 'USDT', contract: '0xc2132d05d31c914abc47dcc6701c9bb892c', decimals: 6 },
    { symbol: 'USDC', contract: '0x3c499c542cef5e3811e1192ce70d8cc03', decimals: 6 }
  ],
  ethereum: [
    { symbol: 'USDT', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
    { symbol: 'USDC', contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 }
  ]
};
const EVM_RPCS = {
  bsc: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org'],
  polygon: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  ethereum: ['https://ethereum.publicnode.com', 'https://rpc.ankr.com/eth']
};
const EVM_MIN_CONF = { bsc: 15, polygon: 128, ethereum: 12 };
const SOL_MINTS = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 }
];
const COINGECKO_IDS = { bitcoin: 'bitcoin', tron: 'tron', bsc: 'binancecoin', polygon: 'matic-network', ethereum: 'ethereum', solana: 'solana' };

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(function () { c.abort(); }, ms);
  return { signal: c.signal, done: function () { clearTimeout(t); } };
}

async function getJson(url, opts) {
  opts = opts || {};
  const t = withTimeout(opts.timeout || 15000);
  try {
    const res = await fetch(url, { signal: t.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  } finally {
    t.done();
  }
}

async function rpcCall(url, method, params) {
  const t = withTimeout(15000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: t.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params || [] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.result !== undefined ? data.result : null;
  } catch (_e) {
    return null;
  } finally {
    t.done();
  }
}

function hexToBigInt(h) {
  try {
    if (!h) return 0n;
    return BigInt(h);
  } catch (_e) {
    return 0n;
  }
}

function addrEq(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function paddedTopicMatches(topic, address) {
  if (!topic) return false;
  const t = String(topic).toLowerCase();
  const a = String(address).toLowerCase().replace(/^0x/, '');
  return t.length === 66 && t.slice(26) === a;
}

async function coinPrices(chains) {
  const ids = chains.map(function (c) { return COINGECKO_IDS[c]; }).filter(Boolean).join(',');
  if (!ids) return {};
  const data = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids) + '&vs_currencies=usd', { timeout: 12000 });
  const out = {};
  Object.keys(COINGECKO_IDS).forEach(function (chain) {
    const id = COINGECKO_IDS[chain];
    if (data && data[id] && data[id].usd > 0) out[chain] = Number(data[id].usd);
  });
  return out;
}

async function verifyBitcoin(txHash, to, expectedUsd, prices) {
  const data = await getJson('https://api.blockchair.com/bitcoin/dashboards/transaction/' + encodeURIComponent(txHash));
  if (!data || !data.data) return { ok: false, code: 'TX_NOT_FOUND' };
  const info = data.data[txHash];
  if (!info || !info.transaction) return { ok: false, code: 'TX_NOT_FOUND' };
  if (!info.transaction.block_id || info.transaction.block_id < 0) return { ok: false, code: 'NOT_CONFIRMED' };
  const price = prices.bitcoin || 0;
  if (!price) return { ok: false, code: 'PROVIDER_ERROR', message: 'Price feed unavailable, try again shortly' };
  const outs = info.outputs || [];
  for (let i = 0; i < outs.length; i++) {
    if (outs[i].recipient === to) {
      const usd = (Number(outs[i].value) || 0) / 1e8 * price;
      if (usd >= expectedUsd * 0.98) return { ok: true, asset: 'BTC', value_usd: usd };
      return { ok: false, code: 'UNDERPAID', message: 'Received ~$' + usd.toFixed(2), received_usd: usd };
    }
  }
  return { ok: false, code: 'RECIPIENT_MISMATCH' };
}

async function verifyTron(txHash, to, expectedUsd, prices) {
  const info = await getJson('https://apilist.tronscanapi.com/api/transaction-info?hash=' + encodeURIComponent(txHash));
  if (!info || !info.hash) return { ok: false, code: 'TX_NOT_FOUND' };
  if (info.contractRet !== 'SUCCESS') return { ok: false, code: 'NOT_CONFIRMED' };
  // TRC20 transfer? Only USDT counts (reject dust/scam tokens).
  const tt = info.tokenTransferInfo || info.trc20TransferInfo;
  if (tt && tt.to_address) {
    const _contract = tt.contract_address || tt.token_address || '';
    if (_contract && !addrEq(_contract, TRC20_USDT)) {
      return { ok: false, code: 'RECIPIENT_MISMATCH', message: 'Not a USDT transfer' };
    }
    if (!addrEq(tt.to_address, to)) return { ok: false, code: 'RECIPIENT_MISMATCH' };
    const dec = Number(tt.decimals || 6);
    const usd = (Number(tt.amount_str) || 0) / Math.pow(10, dec); // USDT pegged
    if (usd >= expectedUsd * 0.98) return { ok: true, asset: 'USDT', value_usd: usd };
    return { ok: false, code: 'UNDERPAID', message: 'Received ~$' + usd.toFixed(2), received_usd: usd };
  }
  // Native TRX
  const c = info.contractData || {};
  if (!addrEq(c.to_address || info.to, to)) return { ok: false, code: 'RECIPIENT_MISMATCH' };
  const price = prices.tron || 0;
  if (!price) return { ok: false, code: 'PROVIDER_ERROR', message: 'Price feed unavailable, try again shortly' };
  const usd = (Number(c.amount) || 0) / 1e6 * price;
  if (usd >= expectedUsd * 0.98) return { ok: true, asset: 'TRX', value_usd: usd };
  return { ok: false, code: 'UNDERPAID', message: 'Received ~$' + usd.toFixed(2), received_usd: usd };
}

async function verifyEvm(chain, txHash, to, expectedUsd, prices) {
  const rpcs = EVM_RPCS[chain] || [];
  let receipt = null;
  for (let i = 0; i < rpcs.length && !receipt; i++) {
    receipt = await rpcCall(rpcs[i], 'eth_getTransactionReceipt', [txHash]);
  }
  if (!receipt) return { ok: false, code: 'TX_NOT_FOUND' };
  if (receipt.status !== '0x1') return { ok: false, code: 'NOT_CONFIRMED' };
  try {
    let tip = null;
    for (let i = 0; i < rpcs.length && tip == null; i++) {
      const n = await rpcCall(rpcs[i], 'eth_blockNumber', []);
      if (n) tip = hexToBigInt(n);
    }
    const need = EVM_MIN_CONF[chain] || 12;
    if (tip != null && tip - hexToBigInt(receipt.blockNumber) < BigInt(need)) {
      return { ok: false, code: 'NOT_CONFIRMED', message: 'Waiting for confirmations' };
    }
  } catch (_e) {}
  // Native coin payment?
  if (addrEq(receipt.to, to)) {
    let tx = null;
    for (let i = 0; i < rpcs.length && !tx; i++) {
      tx = await rpcCall(rpcs[i], 'eth_getTransactionByHash', [txHash]);
    }
    const price = prices[chain] || 0;
    if (tx && price) {
      const usd = Number(hexToBigInt(tx.value || '0x0')) / 1e18 * price;
      if (usd >= expectedUsd * 0.98) return { ok: true, asset: 'native', value_usd: usd };
    }
  }
  // Stablecoin transfer logs (USDT/USDC pegged at ~$1, no oracle needed).
  const tokens = EVM_TOKENS[chain] || [];
  const logs = receipt.logs || [];
  for (let li = 0; li < logs.length; li++) {
    const log = logs[li] || {};
    const topics = log.topics || [];
    if (!topics[0] || String(topics[0]).toLowerCase() !== TRANSFER_SIG) continue;
    if (!paddedTopicMatches(topics[2], to)) continue;
    for (let ti = 0; ti < tokens.length; ti++) {
      if (addrEq(log.address, tokens[ti].contract)) {
        const usd = Number(hexToBigInt(log.data)) / Math.pow(10, tokens[ti].decimals);
        if (usd >= expectedUsd * 0.98) return { ok: true, asset: tokens[ti].symbol, value_usd: usd };
        return { ok: false, code: 'UNDERPAID', message: 'Received ~$' + usd.toFixed(2) + ' ' + tokens[ti].symbol, received_usd: usd };
      }
    }
  }
  return { ok: false, code: 'RECIPIENT_MISMATCH' };
}

async function verifySolana(txHash, to, expectedUsd, prices) {
  const rpc = 'https://api.mainnet-beta.solana.com';
  const tx = await (async function () {
    const t = withTimeout(20000);
    try {
      const res = await fetch(rpc, {
        method: 'POST', signal: t.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txHash, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }] })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data ? data.result : null;
    } catch (_e) {
      return null;
    } finally {
      t.done();
    }
  })();
  if (!tx || !tx.meta || tx.meta.err) return { ok: false, code: 'TX_NOT_FOUND' };
  // Native SOL balance increase?
  const pre = tx.meta.preBalances || [];
  const post = tx.meta.postBalances || [];
  const keys = ((tx.transaction || {}).message || {}).accountKeys || [];
  const price = prices.solana || 0;
  for (let i = 0; i < keys.length; i++) {
    const key = typeof keys[i] === 'string' ? keys[i] : keys[i].pubkey;
    if (key === to) {
      const lamports = (post[i] || 0) - (pre[i] || 0);
      if (lamports > 0 && price) {
        const usd = lamports / 1e9 * price;
        if (usd >= expectedUsd * 0.98) return { ok: true, asset: 'SOL', value_usd: usd };
      }
    }
  }
  // SPL USDC/USDT balance increase (pegged at ~$1, no oracle needed).
  const preT = tx.meta.preTokenBalances || [];
  const postT = tx.meta.postTokenBalances || [];
  const before = {};
  preT.forEach(function (b) { before[b.accountIndex + ':' + b.mint] = Number((b.uiTokenAmount || {}).uiAmount || 0); });
  for (let i = 0; i < postT.length; i++) {
    const b = postT[i] || {};
    const owner = b.owner;
    if (owner !== to) continue;
    for (let m = 0; m < SOL_MINTS.length; m++) {
      if (b.mint !== SOL_MINTS[m].mint) continue;
      const gain = Number((b.uiTokenAmount || {}).uiAmount || 0) - (before[b.accountIndex + ':' + b.mint] || 0);
      if (gain >= expectedUsd * 0.98) return { ok: true, asset: SOL_MINTS[m].symbol, value_usd: gain };
      if (gain > 0) return { ok: false, code: 'UNDERPAID', message: 'Received ~$' + gain.toFixed(2) + ' ' + SOL_MINTS[m].symbol, received_usd: gain };
    }
  }
  return { ok: false, code: 'RECIPIENT_MISMATCH' };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  try {
    if (env.DB && !(await checkRateLimit(env.DB, ip, 'crypto_verify', 10, 300))) {
      return json({ status: 'error', message: 'Too many attempts. Try again later.' }, 429);
    }
  } catch (_e) {}
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }
  const tx_ref = (body.tx_ref || '').trim();
  const chain = (body.chain || '').trim().toLowerCase();
  const tx_hash = (body.tx_hash || '').trim();
  if (!tx_ref || !chain || !tx_hash) return json({ status: 'error', message: 'tx_ref, chain and tx_hash are required' }, 400);

  const row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(tx_ref).first().catch(() => null);
  if (!row || row.provider !== 'crypto') return json({ status: 'error', message: 'Unknown crypto payment', code: 'UNKNOWN_TX' }, 404);
  if (row.status === 'successful') return json({ status: 'ok', already: true });

  // TRON: USDT-TRC20 address by default; native TRX only when explicitly requested.
  let to = '';
  if (chain === 'tron' && (body.asset || '').toUpperCase() === 'TRX') {
    to = env.CRYPTO_TRX_ADDRESS || '';
  } else {
    const ourAddresses = {
      bitcoin: env.CRYPTO_BTC_ADDRESS || '',
      tron: env.CRYPTO_USDT_ADDRESS || '',
      bsc: env.CRYPTO_EVM_ADDRESS || '',
      polygon: env.CRYPTO_EVM_ADDRESS || '',
      ethereum: env.CRYPTO_EVM_ADDRESS || '',
      solana: env.CRYPTO_SOL_ADDRESS || ''
    };
    to = ourAddresses[chain] || '';
  }
  if (!to && ['bitcoin', 'tron', 'bsc', 'polygon', 'ethereum', 'solana'].indexOf(chain) < 0) {
    return json({ status: 'error', message: 'Unsupported chain', code: 'UNKNOWN_CHAIN' }, 400);
  }
  if (!to) return json({ status: 'error', message: 'Receiving address is not configured for ' + chain, code: 'NO_ADDRESS_CONFIGURED' }, 400);

  const { usd } = await ghsToUsd(parseFloat(row.amount) || 0, env);
  const expectedUsd = usd || 0;
  if (!expectedUsd || expectedUsd <= 0) return json({ status: 'error', message: 'Nothing payable' }, 400);

  const prices = await coinPrices([chain]);
  let verdict = { ok: false, code: 'PROVIDER_ERROR' };
  try {
    if (chain === 'bitcoin') verdict = await verifyBitcoin(tx_hash, to, expectedUsd, prices);
    else if (chain === 'tron') verdict = await verifyTron(tx_hash, to, expectedUsd, prices);
    else if (chain === 'bsc' || chain === 'polygon' || chain === 'ethereum') verdict = await verifyEvm(chain, tx_hash, to, expectedUsd, prices);
    else if (chain === 'solana') verdict = await verifySolana(tx_hash, to, expectedUsd, prices);
  } catch (_e) {
    verdict = { ok: false, code: 'PROVIDER_ERROR', message: 'Verification provider error, try again shortly' };
  }
  if (!verdict.ok) return json({ status: 'error', message: verdict.message || 'Payment not verified', code: verdict.code || 'NOT_VERIFIED', received_usd: verdict.received_usd || 0 }, 400);

  const done = await finalizeCryptoPayment(env, { tx_ref, gateway_txid: tx_hash });
  return json({ status: 'ok', purpose: done.purpose || 'donation', asset: verdict.asset, value_usd: verdict.value_usd });
}
