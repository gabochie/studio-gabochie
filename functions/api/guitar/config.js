import { json } from './_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  try {
    const paystackKey = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_paystack_key'").first();
    return json({
      paystackPublicKey: paystackKey?.value || 'pk_test_7246579d3b5c565c392874d4c1068366eb11f0b2'
    });
  } catch {
    return json({
      paystackPublicKey: 'pk_test_7246579d3b5c565c392874d4c1068366eb11f0b2'
    });
  }
}
