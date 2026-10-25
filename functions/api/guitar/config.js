import { json } from './_utils.js';

const DEFAULTS = {
  price: '299',
  comparePrice: '500',
  currencySymbol: 'GH₵',
  freeModules: '3',
  urgencyText: '',
  pricingTagline: 'One-time payment — lifetime access — no hidden fees',
  priceBronze: '299',
  priceSilver: '199',
  priceGold: '299',
  priceApprentice: '699'
};

const SETTING_KEYS = [
  'guitar_price', 'guitar_compare_price', 'guitar_currency_symbol',
  'guitar_free_modules', 'guitar_urgency_text', 'guitar_pricing_tagline',
  'guitar_price_bronze', 'guitar_price_silver', 'guitar_price_gold', 'guitar_price_apprentice'
];

const KEY_MAP = {
  guitar_price: 'price',
  guitar_compare_price: 'comparePrice',
  guitar_currency_symbol: 'currencySymbol',
  guitar_free_modules: 'freeModules',
  guitar_urgency_text: 'urgencyText',
  guitar_pricing_tagline: 'pricingTagline',
  guitar_price_bronze: 'priceBronze',
  guitar_price_silver: 'priceSilver',
  guitar_price_gold: 'priceGold',
  guitar_price_apprentice: 'priceApprentice'
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
