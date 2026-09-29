import { createHmac, timingSafeEqual } from "node:crypto";
import { saveSubscription } from "../lib/db.js";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const values = {};
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key && value) values[key] = value;
  }
  if (!values.t || !values.v1) return false;

  const age = Math.abs(Date.now() / 1000 - Number(values.t));
  if (!Number.isFinite(age) || age > 300) return false;

  const signed = values.t + "." + payload;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  const actual = values.v1;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function response(message, status=200) {
  return new Response(JSON.stringify({ ok: status < 300, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default async function handler(request) {
  if (request.method !== "POST") return response("POST required.", 405);

  try {
    const payload = await request.text();
    if (!verifyStripeSignature(
      payload,
      request.headers.get("stripe-signature"),
      env("STRIPE_WEBHOOK_SECRET")
    )) {
      return response("Invalid Stripe signature.", 400);
    }

    const event = JSON.parse(payload);
    const object = event.data?.object || {};
    const metadata = object.metadata || {};

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const subscriptionId = typeof object.subscription === "string"
        ? object.subscription
        : object.subscription?.id;

      if (metadata.user_id && subscriptionId) {
        await saveSubscription({
          user_id: String(metadata.user_id),
          stripe_customer_id: typeof object.customer === "string" ? object.customer : null,
          stripe_subscription_id: subscriptionId,
          plan: metadata.plan || "builder",
          status: "active",
          updated_at: new Date().toISOString()
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = object;
      if (subscription.metadata?.user_id) {
        let plan = subscription.metadata.plan || "free";
        let status = subscription.status || "inactive";
        if (event.type === "customer.subscription.deleted") {
          status = "canceled";
          plan = "free";
        }

        await saveSubscription({
          user_id: String(subscription.metadata.user_id),
          stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
          stripe_subscription_id: subscription.id || null,
          plan,
          status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString()
        });
      }
    }

    return response("Webhook received.");
  } catch (error) {
    return response(error.message || "Webhook processing failed.", 500);
  }
}