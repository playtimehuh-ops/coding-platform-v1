import { readSession } from "../lib/auth.js";
import { PLANS, publicPlans } from "../config/plans.js";
import { getSubscription } from "../lib/db.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

async function stripe(path, body) {
  const response = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(env("STRIPE_SECRET_KEY") + ":").toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data.error?.message || "Stripe request failed.");
  return data;
}

function field(name, value) {
  return encodeURIComponent(name) + "=" + encodeURIComponent(value);
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);

  try {
    const body = await request.json();
    const action = body.action || "catalog";

    if (action === "catalog") {
      return json({ plans: publicPlans(), configured: Boolean(process.env.STRIPE_SECRET_KEY) });
    }

    const session = readSession(request);
    if (!session) return json({ error: "Sign in first." }, 401);

    if (action === "portal") {
      const subscription = await getSubscription(session.sub);
      if (!subscription?.stripe_customer_id) {
        return json({ error: "No active Stripe customer was found for this account." }, 404);
      }
      const origin = new URL(request.url).origin;
      const encoded = [
        field("customer", subscription.stripe_customer_id),
        field("return_url", origin)
      ].join("&");
      const portal = await stripe("/billing_portal/sessions", encoded);
      return json({ ok: true, url: portal.url });
    }

    if (action === "checkout") {
      const planId = String(body.plan || "").trim();
      const plan = PLANS[planId];

      if (!plan || planId === "free") return json({ error: "Choose a paid plan." }, 400);

      const priceEnv = planId === "builder" ? "STRIPE_PRICE_BUILDER" : "STRIPE_PRICE_TEAM";
      const price = env(priceEnv);
      const origin = new URL(request.url).origin;

      const encoded = [
        field("mode", "subscription"),
        field("line_items[0][price]", price),
        field("line_items[0][quantity]", "1"),
        field("success_url", origin + "/?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
        field("cancel_url", origin + "/?checkout=cancelled"),
        field("client_reference_id", session.login),
        field("customer_creation", "always"),
        field("subscription_data[metadata][plan]", planId),
        field("subscription_data[metadata][user_id]", session.sub),
        field("subscription_data[metadata][account_email]", session.email)
      ].join("&");

      const checkout = await stripe("/checkout/sessions", encoded);
      return json({ ok: true, url: checkout.url });
    }

    return json({ error: "Unknown billing action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Billing request failed." }, 500);
  }
}