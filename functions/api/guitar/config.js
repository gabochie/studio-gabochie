import { json } from './_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  try {
    const [paystack, flutterwave] = await Promise.all([
      db.prepare("SELECT value FROM settings WHERE key = 'guitar_paystack_key'").first(),
      db.prepare("SELECT value FROM settings WHERE key = 'guitar_flutterwave_key'").first()
    ]);
    return json({
      paystackPublicKey: paystack?.value || 'pk_test_7246579d3b5c565c392874d4c1068366eb11f0b2',
      flutterwavePublicKey: flutterwave?.value || 'FLWPUBK_TEST-6f4a7e5d8c9b0a1d2e3f4a5b6c7d8e9f-X'
    });
  } catch {
    return json({
      paystackPublicKey: 'pk_test_7246579d3b5c565c392874d4c1068366eb11f0b2',
      flutterwavePublicKey: 'FLWPUBK_TEST-6f4a7e5d8c9b0a1d2e3f4a5b6c7d8e9f-X'
    });
  }
}
