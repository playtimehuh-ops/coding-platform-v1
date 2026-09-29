import { readSession } from "../lib/auth.js";

export default async function handler(request) {
  const session = readSession(request);
  return new Response(JSON.stringify({
    ok: true,
    service: "coding-platform-v1",
    authenticated: Boolean(session),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY)
  }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}