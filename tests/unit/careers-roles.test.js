import { describe, it, expect } from 'vitest';
import careers from '../../assets/js/careers-roles.json';

var API_ROLE_IDS = [
  'ops-revenue',
  'curriculum-editor',
  'growth-partnerships',
  'learner-support',
  'web-ops',
  'design'
];

describe('careers role catalogue', function () {
  it('publishes exactly one open role and a talent pool', function () {
    var open = careers.roles.filter(function (r) { return r.status === 'open'; });
    expect(open.length).toBe(1);
    expect(open[0].id).toBe('ops-revenue');
    expect(careers.roles.filter(function (r) { return r.status === 'pool'; }).length).toBeGreaterThan(0);
  });

  it('keeps role ids in sync with the API allowlist', function () {
    var ids = careers.roles.map(function (r) { return r.id; });
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(function (id) { expect(API_ROLE_IDS).toContain(id); });
    API_ROLE_IDS.forEach(function (id) { expect(ids).toContain(id); });
  });

  it('gives every role a visible pay band, location and application detail', function () {
    expect(careers.note).toContain('anywhere in the world');
    careers.roles.forEach(function (role) {
      expect(role.band).toContain('GH¢');
      expect(role.hours).toBeTruthy();
      expect(role.statusLabel).toBeTruthy();
      expect(role.outcome.length).toBeGreaterThan(20);
      expect(role.skills.length).toBeGreaterThan(0);
      expect(role.deliverables.length).toBeGreaterThan(0);
    });
  });
});
