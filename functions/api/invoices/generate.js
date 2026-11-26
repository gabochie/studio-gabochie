function randomInvoiceToken() {
  // 24 random bytes = 48 hex chars. The invoice number stays sequential for
  // accounting; this token is the only credential for the public invoice view.
  var buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// Guarded migration for existing deployments: db/setup.js is not responsible
// for this column, so add it lazily and ignore the "already present" error.
async function ensureAccessTokenColumn(db) {
  try {
    await db.prepare("ALTER TABLE invoices ADD COLUMN access_token TEXT DEFAULT ''").run();
  } catch (_e) {
    // Column already exists (or is managed elsewhere) — carry on.
  }
}

// Returns a canonical public link only when a high-entropy token is stored.
// Invoices created before this migration have no token and are deliberately
// not linkable (no fallback to the sequential invoice number).
export async function invoicePublicLink(env, invNum) {
  if (!env || !env.DB || !invNum) return '';
  try {
    var row = await env.DB.prepare('SELECT access_token FROM invoices WHERE invoice_number = ?').bind(invNum).first();
    if (!row || !row.access_token) return '';
    var base = (env.PUBLIC_BASE_URL || 'https://studio.gabochie.com').replace(/\/$/, '');
    return base + '/api/invoices/' + encodeURIComponent(invNum) + '?token=' + encodeURIComponent(row.access_token);
  } catch (_e) {
    return '';
  }
}

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
    var token = randomInvoiceToken();

    await ensureAccessTokenColumn(env.DB);
    try {
      await env.DB.prepare(
        `INSERT INTO invoices (invoice_number, access_token, customer_name, customer_email, customer_phone, customer_company, invoice_type, reference_type, reference_id, reference_tx_ref, items, subtotal, tax, total, currency, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', datetime('now'))`
      ).bind(invNum, token, data.name || '', data.email || '', data.phone || '', data.company || '', type, ref, data.ref_id || 0, data.tx_ref || '', JSON.stringify(items), subtotal, tax, total, data.currency || 'GHS').run();
    } catch (_e) {
      // Pre-migration DB that refused the ALTER: still issue the invoice, but
      // with no public token (the receipt will simply omit the invoice link).
      await env.DB.prepare(
        `INSERT INTO invoices (invoice_number, customer_name, customer_email, customer_phone, customer_company, invoice_type, reference_type, reference_id, reference_tx_ref, items, subtotal, tax, total, currency, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', datetime('now'))`
      ).bind(invNum, data.name || '', data.email || '', data.phone || '', data.company || '', type, ref, data.ref_id || 0, data.tx_ref || '', JSON.stringify(items), subtotal, tax, total, data.currency || 'GHS').run();
    }

    return invNum;
  } catch (_e) {
    return null;
  }
}
