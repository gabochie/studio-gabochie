import { json } from './_utils.js';

const DEFAULTS = {
  paystackPublicKey: 'pk_test_7246579d3b5c565c392874d4c1068366eb11f0b2',
  flutterwavePublicKey: 'FLWPUBK_TEST-6f4a7e5d8c9b0a1d2e3f4a5b6c7d8e9f-X',
  price: '99',
  comparePrice: '500',
  currencySymbol: 'GH₵',
  freeModules: '3',
  urgencyText: '',
  pricingTagline: 'One-time payment — lifetime access — no hidden fees'
};

const SETTING_KEYS = [
  'guitar_paystack_key', 'guitar_flutterwave_key',
  'guitar_price', 'guitar_compare_price', 'guitar_currency_symbol',
  'guitar_free_modules', 'guitar_urgency_text', 'guitar_pricing_tagline'
];

const KEY_MAP = {
  guitar_paystack_key: 'paystackPublicKey',
  guitar_flutterwave_key: 'flutterwavePublicKey',
  guitar_price: 'price',
  guitar_compare_price: 'comparePrice',
  guitar_currency_symbol: 'currencySymbol',
  guitar_free_modules: 'freeModules',
  guitar_urgency_text: 'urgencyText',
  guitar_pricing_tagline: 'pricingTagline'
};

export async function onRequest(context) {
  const db = context.env.DB;
  try {
    const placeholders = SETTING_KEYS.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`
    ).bind(...SETTING_KEYS).all();

    const out = { ...DEFAULTS };
    results.forEach(r => {
      const mapped = KEY_MAP[r.key];
      if (mapped) out[mapped] = r.value;
    });
    return json(out);
  } catch {
    return json(DEFAULTS);
  }
}
