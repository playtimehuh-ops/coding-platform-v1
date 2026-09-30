import { accountFromToken, getBearerToken } from "../lib/token.js";

export default async function handler(request) {
  const account = accountFromToken(getBearerToken(request));
  return new Response(JSON.stringify({
    ok: true,
    service: "coding-platform-v1",
    mode: "local",
    authenticated: Boolean(account),
    github: false,
    aiProvider: "llmfaucet",
    accountId: account?.id || null
  }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
