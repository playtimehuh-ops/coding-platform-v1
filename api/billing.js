import { accountFromToken, getBearerToken } from "../lib/token.js";
import { PLANS } from "../config/plans.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

async function stripe(path, options = {}) {
  const response = await fetch("https://api.stripe.com/v1" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + env("STRIPE_SECRET_KEY"),
      "Content-Type": "application/x-www-form-urlencoded",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}

  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe request failed.");
  }

  return data;
}

function field(name, value) {
  return encodeURIComponent(name) + "=" + encodeURIComponent(String(value));
}

function account(request) {
  return accountFromToken(getBearerToken(request));
}

async function findCustomer(accountId) {
  const query = encodeURIComponent("metadata['codebase_account_id']:'" + accountId + "'");
  const data = await stripe("/customers/search?query=" + query + "&limit=1");
  return data.data?.[0] || null;
}

async function ensureCustomer(accountId) {
  const existing = await findCustomer(accountId);
  if (existing) return existing;

  return stripe("/customers", {
    method: "POST",
    body: [
      field("description", "Codebase token account"),
      field("metadata[codebase_account_id]", accountId)
    ].join("&")
  });
}

async function subscriptionStatus(customerId) {
  const data = await stripe("/subscriptions?customer=" + encodeURIComponent(customerId) + "&status=all&limit=20");
  const active = (data.data || []).find(sub =>
    ["active", "trialing", "past_due", "unpaid"].includes(sub.status)
  );

  if (!active) {
    return { plan: "free", status: "inactive", subscriptionId: null, currentPeriodEnd: null };
  }

  return {
    plan: PLANS[active.metadata?.plan] ? active.metadata.plan : "free",
    status: active.status,
    subscriptionId: active.id,
    currentPeriodEnd: active.current_period_end
      ? new Date(active.current_period_end * 1000).toISOString()
      : null
  };
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "catalog");

    if (action === "catalog") {
      return json({ plans: Object.values(PLANS) });
    }

    const acc = account(request);
    if (!acc) return json({ error: "Account token required.", code: "TOKEN_REQUIRED" }, 401);

    if (action === "status") {
      const customer = await findCustomer(acc.id);
      if (!customer) return json({
        plan: "free",
        status: "inactive",
        subscriptionId: null,
        currentPeriodEnd: null
      });

      return json(await subscriptionStatus(customer.id));
    }

    if (action === "checkout") {
      const planId = String(body.plan || "").trim();
      const plan = PLANS[planId];

      if (!plan || planId === "free") {
        return json({ error: "Choose a paid plan." }, 400);
      }

      const customer = await ensureCustomer(acc.id);
      const origin = new URL(request.url).origin;

      const encoded = [
        field("mode", "subscription"),
        field("line_items[0][price_data][currency]", "usd"),
        field("line_items[0][price_data][unit_amount]", Math.round(plan.price * 100)),
        field("line_items[0][price_data][recurring][interval]", "month"),
        field("line_items[0][price_data][product_data][name]", "Codebase " + plan.name),
        field("line_items[0][price_data][product_data][description]", plan.runs.toLocaleString() + " AI coding runs per month"),
        field("line_items[0][quantity]", 1),
        field("customer", customer.id),
        field("client_reference_id", acc.id),
        field("metadata[codebase_account_id]", acc.id),
        field("metadata[plan]", plan.id),
        field("subscription_data[metadata][codebase_account_id]", acc.id),
        field("subscription_data[metadata][plan]", plan.id),
        field("success_url", origin + "/?payment=success&plan=" + encodeURIComponent(plan.id)),
        field("cancel_url", origin + "/?payment=cancelled")
      ].join("&");

      const session = await stripe("/checkout/sessions", {
        method: "POST",
        body: encoded
      });

      return json({ ok: true, url: session.url, plan: plan.id });
    }

    if (action === "portal") {
      const customer = await findCustomer(acc.id);
      if (!customer) return json({ error: "No paid account was found yet." }, 404);

      const origin = new URL(request.url).origin;
      const portal = await stripe("/billing_portal/sessions", {
        method: "POST",
        body: [
          field("customer", customer.id),
          field("return_url", origin)
        ].join("&")
      });

      return json({ ok: true, url: portal.url });
    }

    return json({ error: "Unknown billing action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Billing request failed." }, 500);
  }
}
