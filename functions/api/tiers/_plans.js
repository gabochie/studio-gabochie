// Shared Flutterwave plan resolution for membership tiers.
//
// Returns the plan id string, or '' when no plan is configured for the
// tier + interval (the caller must then treat the charge as one-time).
// Priority: per-tier env var > legacy defaults > '' (one-time).
//
// NOTE: supporter/yearly intentionally keeps the legacy FLW_PLAN_PATRON /
// '160303' fallback: that plan id is the long-standing annual plan
// (GHS 500/yr, i.e. the supporter yearly price), only the env name is
// misleading. Do NOT reuse it for the patron tier (GHS 2,990/yr).

export function resolvePlanId(env, slug, interval, dbPlanId) {
  env = env || {};
  if (slug === 'supporter') {
    return interval === 'yearly'
      ? (env.FLW_PLAN_SUPPORTER_YEARLY || env.FLW_PLAN_PATRON || '160303')
      : (env.FLW_PLAN_SUPPORTER || '160302');
  }
  if (slug === 'scholar') {
    return interval === 'yearly'
      ? (env.FLW_PLAN_SCHOLAR_YEARLY || dbPlanId || '')
      : (env.FLW_PLAN_SCHOLAR_MONTHLY || env.FLW_PLAN_SCHOLAR || dbPlanId || '');
  }
  if (slug === 'patron') {
    return interval === 'yearly'
      ? (env.FLW_PLAN_PATRON_YEARLY || dbPlanId || '')
      : (env.FLW_PLAN_PATRON_MONTHLY || dbPlanId || '');
  }
  if (slug === 'founding') {
    return env.FLW_PLAN_FOUNDING || dbPlanId || '160304';
  }
  return '';
}
