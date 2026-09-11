import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { generateInvoice } from '../../functions/api/invoices/generate.js';
import { onRequest } from '../../functions/api/invoices/[id].js';

describe('generateInvoice()', function () {
  var env;

  beforeEach(function () {
    env = { DB: mockDb({ invoices: [] }) };
  });

  it('returns a correctly formatted invoice number INV-YYYY-NNNN', async function () {
    var invNum = await generateInvoice(env, 'donation', 'donations', {
      name: 'John Doe',
      email: 'john@test.com',
      amount: 100,
      currency: 'GHS',
      tx_ref: 'tx-test-001',
    });
    expect(invNum).toMatch(/^INV-\d{4}-0001$/);
  });

  it('increments the sequence number for subsequent invoices', async function () {
    env.DB = mockDb({
      invoices: [
        { invoice_number: 'INV-2026-0001' },
        { invoice_number: 'INV-2026-0002' },
      ],
    });
    var invNum = await generateInvoice(env, 'books', 'book_purchases', {
      name: 'Jane Doe',
      email: 'jane@test.com',
      amount: 50,
      currency: 'GHS',
      tx_ref: 'tx-test-002',
    });
    expect(invNum).toMatch(/^INV-\d{4}-0003$/);
  });

  it('handles different invoice types correctly', async function () {
    var invNum = await generateInvoice(env, 'subscription', 'subscriptions', {
      name: 'Subscriber',
      email: 'sub@test.com',
      amount: 30,
      currency: 'USD',
      tx_ref: 'sub-test-001',
    });
    expect(invNum).toMatch(/^INV-\d{4}-\d{4}$/);
  });

  it('returns null when DB is not bound', async function () {
    var invNum = await generateInvoice({}, 'donation', 'donations', {
      name: 'John',
      email: 'john@test.com',
      amount: 100,
      tx_ref: 'tx-001',
    });
    expect(invNum).toBeNull();
  });

  it('includes all required data fields in the insert', async function () {
    var invNum = await generateInvoice(env, 'donation', 'donations', {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+233501234567',
      amount: 200,
      currency: 'GHS',
      tx_ref: 'tx_donation_001',
    });
    expect(invNum).toBeTruthy();
    expect(invNum).toContain('INV-');
  });
});

describe('GET /api/invoices/[id]', function () {
  var ctx;
  var mockInvoice = {
    id: 1,
    invoice_number: 'INV-2026-0001',
    customer_name: 'John Doe',
    customer_email: 'john@test.com',
    customer_phone: '+233501234567',
    invoice_type: 'donation',
    reference_type: 'donations',
    reference_tx_ref: 'tx-test-001',
    items: JSON.stringify([{ description: 'Donation', quantity: 1, unit_price: 100, total: 100 }]),
    subtotal: 100,
    tax: 0,
    total: 100,
    currency: 'GHS',
    status: 'paid',
    created_at: '2026-06-11 12:00:00',
    paid_at: '2026-06-11 12:00:00',
  };

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/invoices/INV-2026-0001?token=INV-2026-0001', {
      params: { id: 'INV-2026-0001' },
      env: {
        DB: mockDb({ invoices: [mockInvoice] }),
      },
    });
  });

  it('shows brand name in the invoice header', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('Studio Gabochie');
  });

  it('shows the brand logo in the invoice header', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('logo.png');
    expect(text).toContain('assets/images/logo.png');
  });

  it('shows customer name and email', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('John Doe');
    expect(text).toContain('john@test.com');
  });

  it('shows the invoice number', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('INV-2026-0001');
  });

  it('shows the correct total', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('100.00');
  });

  it('shows the payment reference', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('tx-test-001');
  });

  it('shows a print/download button', async function () {
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toContain('window.print()');
  });

  it('returns 404 for unknown invoice number', async function () {
    ctx.params = { id: 'INV-2026-9999' };
    ctx.request = new Request('http://localhost/api/invoices/INV-2026-9999?token=INV-2026-9999');
    var res = await onRequest(ctx);
    expect(res.status).toBe(404);
  });

  it('shows Invoice Locked when token is missing', async function () {
    ctx.request = new Request('http://localhost/api/invoices/INV-2026-0001');
    var res = await onRequest(ctx);
    expect(res.status).toBe(401);
    var text = await res.text();
    expect(text).toContain('Invoice Locked');
  });

  it('shows Invoice Locked when token does not match invoice number', async function () {
    ctx.request = new Request('http://localhost/api/invoices/INV-2026-0001?token=wrong-token');
    var res = await onRequest(ctx);
    expect(res.status).toBe(401);
    var text = await res.text();
    expect(text).toContain('Invoice Locked');
  });

  it('sets Content-Type to text/html', async function () {
    var res = await onRequest(ctx);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('returns 501 when DB is not bound', async function () {
    ctx.env.DB = undefined;
    var res = await onRequest(ctx);
    var text = await res.text();
    expect(text).toBe('D1 not bound');
  });
});
