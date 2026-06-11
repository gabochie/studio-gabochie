export async function onRequest(context) {
  var { request, env, params } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response('D1 not bound', { status: 501 });

  try {
    var idOrNum = params.id || '';
    var url = new URL(request.url);
    var token = url.searchParams.get('token') || '';

    // Look up by invoice number or ID
    var invoice;
    if (idOrNum.startsWith('INV-')) {
      invoice = await env.DB.prepare('SELECT * FROM invoices WHERE invoice_number = ?').bind(idOrNum).first();
    } else {
      var num = parseInt(idOrNum);
      if (!isNaN(num)) invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(num).first();
    }
    if (!invoice) return new Response('Invoice not found', { status: 404 });

    // Token check — if the invoice has an email, require ?token={invoice_number}
    if (invoice.customer_email && token !== invoice.invoice_number) {
      return new Response('<html><body style="font-family:Georgia,serif;background:#FAFAFA;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;padding:40px"><h2 style="color:#0A1628">Invoice Locked</h2><p style="color:#6B7F9A">This invoice requires authentication. Use the link from your email.</p></div></body></html>', { status: 401, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    var items = JSON.parse(invoice.items || '[]');
    var dateStr = new Date(invoice.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var paidStr = invoice.paid_at ? new Date(invoice.paid_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    var rows = items.map(function(item, i) {
      return '<tr' + (i === items.length - 1 ? ' style="font-weight:700"' : '') + '><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#1E293B">' + (item.description || '') + '</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;text-align:center">' + (item.quantity || 1) + '</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;text-align:right">' + invoice.currency + ' ' + (item.unit_price || 0).toFixed(2) + '</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#1E293B;text-align:right">' + invoice.currency + ' ' + (item.total || 0).toFixed(2) + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ' + invoice.invoice_number + ' — GideonAbochie Studio</title>' +
      '<style>' +
      'body{font-family:Georgia,serif;background:#F4F6FA;margin:0;padding:20px;color:#1E293B}' +
      '.inv{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden}' +
      '.inv-hdr{background:#0A1628;padding:32px 40px;text-align:center}' +
      '.inv-hdr h1{font-family:"Barlow Condensed",sans-serif;color:#C9A84C;font-size:26px;margin:0;letter-spacing:-.02em}' +
      '.inv-hdr p{color:#6B7F9A;font-size:12px;margin:6px 0 0}' +
      '.inv-body{padding:32px 40px}' +
      '.inv-meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px;flex-wrap:wrap}' +
      '.inv-meta div{flex:1;min-width:180px}' +
      '.inv-meta .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:4px}' +
      '.inv-meta .val{font-size:15px;color:#1E293B}' +
      '.inv-meta .val.num{font-family:monospace;color:#C9A84C;font-weight:700}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:24px}' +
      'th{text-align:left;padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;border-bottom:2px solid #E2E8F0}' +
      'th:last-child,td:last-child{text-align:right}' +
      'th:nth-child(2),td:nth-child(2){text-align:center}' +
      '.totals{margin-left:auto;width:260px}' +
      '.totals tr td{padding:6px 0;border:none}' +
      '.totals tr td:last-child{text-align:right;font-weight:600}' +
      '.totals .grand td{font-size:16px;font-weight:700;color:#C9A84C;padding-top:12px;border-top:2px solid #C9A84C}' +
      '.inv-ftr{text-align:center;padding:20px 40px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8}' +
      '.inv-ftr a{color:#C9A84C;text-decoration:none}' +
      '@media print{body{background:#fff;padding:0}.inv{box-shadow:none;border-radius:0}.no-print{display:none!important}}' +
      '.no-print{text-align:center;margin-bottom:16px}' +
      '.no-print button{background:#C9A84C;color:#0A1628;border:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:"Barlow Condensed",sans-serif}' +
      '.badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase}' +
      '.badge-paid{background:#dcfce7;color:#166534}' +
      '</style></head><body>' +
      '<div class="no-print" style="margin-bottom:12px"><button onclick="window.print()">Download / Print PDF</button></div>' +
      '<div class="inv">' +
      '<div class="inv-hdr"><img src="https://gideonabochie.org/assets/images/logo.png" alt="GideonAbochie Studio" style="height:40px;margin-bottom:8px"><h1>GideonAbochie Studio</h1><p>Official Invoice</p></div>' +
      '<div class="inv-body">' +
      '<div class="inv-meta">' +
      '<div><div class="lbl">Invoice #</div><div class="val num">' + invoice.invoice_number + '</div></div>' +
      '<div><div class="lbl">Date Issued</div><div class="val">' + dateStr + '</div></div>' +
      '<div><div class="lbl">Status</div><div class="val"><span class="badge badge-paid">Paid</span></div></div>' +
      '</div>' +
      '<div style="margin-bottom:28px"><div class="lbl" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:4px">Bill To</div>' +
      '<div style="font-size:15px;color:#1E293B">' + (invoice.customer_name || 'Valued Customer') + '</div>' +
      '<div style="font-size:13px;color:#64748B">' + (invoice.customer_email || '') + '</div>' +
      (invoice.customer_phone ? '<div style="font-size:13px;color:#64748B">' + invoice.customer_phone + '</div>' : '') +
      (invoice.customer_company ? '<div style="font-size:13px;color:#64748B">' + invoice.customer_company + '</div>' : '') +
      '</div>' +
      '<table><thead><tr><th style="width:50%">Description</th><th style="width:60px">Qty</th><th style="width:100px">Unit Price</th><th style="width:100px">Amount</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '<table class="totals">' +
      '<tr><td>Subtotal</td><td>' + invoice.currency + ' ' + invoice.subtotal.toFixed(2) + '</td></tr>' +
      (invoice.tax ? '<tr><td>Tax</td><td>' + invoice.currency + ' ' + invoice.tax.toFixed(2) + '</td></tr>' : '') +
      '<tr class="grand"><td>Total</td><td>' + invoice.currency + ' ' + invoice.total.toFixed(2) + '</td></tr>' +
      '</table>' +
      '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:13px;color:#64748B;line-height:1.6">' +
      '<p style="margin:0 0 4px"><strong style="color:#1E293B">Payment Reference:</strong> ' + (invoice.reference_tx_ref || '-') + '</p>' +
      (paidStr ? '<p style="margin:0"><strong style="color:#1E293B">Paid On:</strong> ' + paidStr + '</p>' : '') +
      '</div>' +
      '</div>' +
      '<div class="inv-ftr">GideonAbochie Studio &mdash; Accra, Ghana &bull; <a href="mailto:info@gideonabochie.com">info@gideonabochie.com</a><br>Thank you for your support.</div>' +
      '</div></body></html>';

    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  } catch (err) {
    return new Response('Error loading invoice', { status: 500 });
  }
}
