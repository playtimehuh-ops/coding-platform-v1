export const PLAN_LIMITS = {
  free: { runs: 20, contextFiles: 12, privateRepos: 1 },
  builder: { runs: 500, contextFiles: 40, privateRepos: 10 },
  team: { runs: 2000, contextFiles: 80, privateRepos: 50 }
};

export function normalizePlan(value) {
  return PLAN_LIMITS[value] ? value : "free";
}

export function getPlan(subscription) {
  if (!subscription) return "free";
  if (subscription.status !== "active" && subscription.status !== "trialing") return "free";
  return normalizePlan(subscription.plan);
}

export function remaining(plan, used) {
  const limit = PLAN_LIMITS[plan]?.runs ?? PLAN_LIMITS.free.runs;
  return Math.max(0, limit - used);
}