import { accountFromToken, getBearerToken } from "../lib/token.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async function handler(request) {
  const token = getBearerToken(request);
  const account = accountFromToken(token);
  if (!account) return json({ authenticated: false, error: "A valid account token is required." }, 401);

  return json({
    authenticated: true,
    account: {
      id: account.id,
      tokenPrefix: "cb_"
    }
  });
}
