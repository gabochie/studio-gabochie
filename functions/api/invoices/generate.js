export async function generateInvoice(env, type, ref, data) {
  if (!env.DB) return null;
  try {
    var year = new Date().getFullYear();
    var counter = await env.DB.prepare(
      "SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number, 9) AS INTEGER)), 0) + 1 AS next FROM invoices WHERE invoice_number LIKE ?"
    ).bind('INV-' + year + '-%').first();
    var seq = counter ? String(counter.next).padStart(4, '0') : '0001';
    var invNum = 'INV-' + year + '-' + seq;

    var items = data.items || [{ description: type === 'donation' ? 'Donation' : type === 'books' ? 'Book Purchase' : type === 'store' ? 'Store Purchase' : type === 'subscription' ? 'Subscription' : type === 'booking' ? 'Ad Booking' : type === 'enrollment' ? 'Program Enrollment' : 'Payment', quantity: 1, unit_price: data.amount, total: data.amount }];
    var subtotal = data.subtotal || data.amount || 0;
    var tax = data.tax || 0;
    var total = data.total || (subtotal + tax);

    await env.DB.prepare(
      `INSERT INTO invoices (invoice_number, customer_name, customer_email, customer_phone, customer_company, invoice_type, reference_type, reference_id, reference_tx_ref, items, subtotal, tax, total, currency, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', datetime('now'))`
    ).bind(invNum, data.name || '', data.email || '', data.phone || '', data.company || '', type, ref, data.ref_id || 0, data.tx_ref || '', JSON.stringify(items), subtotal, tax, total, data.currency || 'GHS').run();

    return invNum;
  } catch (_e) {
    return null;
  }
}
