import { publicModels } from "../lib/ai.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" }
  });
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "GET required." }, 405);
  return json({ models: publicModels(), source: "free" });
}