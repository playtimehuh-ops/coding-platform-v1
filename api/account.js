import { readSession } from "../lib/auth.js";
import { dbConfigured, getSubscription, getUsage } from "../lib/db.js";
import { getPlan, PLAN_LIMITS } from "../lib/plan.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "GET required." }, 405);

  try {
    const session = readSession(request);
    if (!session) return json({ authenticated: false });

    const subscription = await getSubscription(session.sub);
    const plan = getPlan(subscription);
    const month = new Date().toISOString().slice(0, 7);
    const used = await getUsage(session.sub, month);

    return json({
      authenticated: true,
      user: {
        id: session.sub,
        email: session.email,
        name: session.name,
        avatar_url: session.avatar_url
      },
      persistence: dbConfigured(),
      plan,
      usage: {
        month,
        used,
        limit: PLAN_LIMITS[plan].runs,
        remaining: Math.max(0, PLAN_LIMITS[plan].runs - used)
      },
      subscription: subscription ? {
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        stripe_customer_id: Boolean(subscription.stripe_customer_id)
      } : null
    });
  } catch (error) {
    return json({ error: error.message || "Could not load account." }, 500);
  }
}