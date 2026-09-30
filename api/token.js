import { generateAccountToken } from "../lib/token.js";

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
  if (request.method !== "POST") return json({ error: "POST required." }, 405);
  return json({
    ok: true,
    token: generateAccountToken()
  });
}
