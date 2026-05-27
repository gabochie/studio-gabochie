import { describe, it, expect } from 'vitest';

// Mirror of formatPrice() from support/index.html
function formatPrice(amount, currency, exchangeRates) {
  if (currency === 'GHS') return 'GH\u00a2 ' + amount;
  var rates = exchangeRates || {};
  if (!rates[currency]) return null;
  var converted = amount * rates[currency];
  var d = converted >= 10 ? 0 : 1;
  var sym = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
  return (sym[currency] || '') + converted.toFixed(d);
}

// Mirror of renderPlans small-currencies filter logic
function otherCurrencies(selected) {
  var mainOrder = ['GHS', 'USD', 'EUR', 'GBP'];
  return mainOrder.filter(function (c) { return c !== selected; });
}

// Mirror of decimals logic inline
function decimals(v) { return v >= 10 ? 0 : 1; }

describe('formatPrice', function () {
  var rates = { USD: 0.083, EUR: 0.077, GBP: 0.065 };

  it('returns GHS price with GH¢ prefix', function () {
    expect(formatPrice(50, 'GHS')).toBe('GH\u00a2 50');
  });

  it('returns GHS price for zero amount', function () {
    expect(formatPrice(0, 'GHS')).toBe('GH\u00a2 0');
  });

  it('returns null when rates are unavailable', function () {
    expect(formatPrice(50, 'USD')).toBeNull();
  });

  it('returns null when rates object is empty', function () {
    expect(formatPrice(50, 'USD', {})).toBeNull();
  });

  it('converts 50 GHS to USD correctly', function () {
    var result = formatPrice(50, 'USD', rates);
    expect(result).toBe('$4.2');
  });

  it('converts 500 GHS to USD with whole number', function () {
    var result = formatPrice(500, 'USD', rates);
    expect(result).toBe('$42');
  });

  it('converts 50 GHS to EUR', function () {
    var result = formatPrice(50, 'EUR', rates);
    expect(result).toMatch(/^\u20AC/);
    expect(result).toBe('\u20AC3.9');
  });

  it('converts 50 GHS to GBP', function () {
    var result = formatPrice(50, 'GBP', rates);
    expect(result).toBe('\u00A33.3');
  });

  it('converts 2500 GHS to USD with whole number', function () {
    var result = formatPrice(2500, 'USD', rates);
    expect(result).toBe('$208');
  });

  it('handles missing rate for a currency gracefully', function () {
    var partialRates = { USD: 0.083 };
    expect(formatPrice(50, 'EUR', partialRates)).toBeNull();
  });
});

describe('decimals helper', function () {
  it('returns 0 for values >= 10', function () {
    expect(decimals(10)).toBe(0);
    expect(decimals(100)).toBe(0);
    expect(decimals(10.0)).toBe(0);
  });

  it('returns 1 for values < 10', function () {
    expect(decimals(9.99)).toBe(1);
    expect(decimals(4.15)).toBe(1);
    expect(decimals(0.5)).toBe(1);
  });
});

describe('otherCurrencies (small line filter)', function () {
  it('excludes GHS when GHS is selected', function () {
    expect(otherCurrencies('GHS')).toEqual(['USD', 'EUR', 'GBP']);
  });

  it('excludes USD when USD is selected', function () {
    expect(otherCurrencies('USD')).toEqual(['GHS', 'EUR', 'GBP']);
  });

  it('excludes EUR when EUR is selected', function () {
    expect(otherCurrencies('EUR')).toEqual(['GHS', 'USD', 'GBP']);
  });

  it('excludes GBP when GBP is selected', function () {
    expect(otherCurrencies('GBP')).toEqual(['GHS', 'USD', 'EUR']);
  });
});
