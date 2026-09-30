const MODEL = "@cf/zai-org/glm-4.7-flash";
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const buckets = new Map();

function corsHeaders(origin) {
  const allowed = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function rateLimited(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const current = buckets.get(ip);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(message => message && typeof message.content !== "undefined")
    .map(message => ({
      role: ["system", "user", "assistant"].includes(message.role) ? message.role : "user",
      content: typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map(part => part?.text || "").join("")
          : String(message.content)
    }));
}

function buildPrompt(messages) {
  return normalizeMessages(messages)
    .map(message => {
      const label = message.role === "system"
        ? "SYSTEM"
        : message.role === "assistant"
          ? "ASSISTANT"
          : "USER";
      return label + ":\n" + message.content;
    })
    .join("\n\n") + "\n\nASSISTANT:\n";
}

function completion(content) {
  return {
    id: "codebase-" + crypto.randomUUID(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: MODEL,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content
      },
      finish_reason: "stop"
    }]
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        ok: true,
        service: "Codebase AI Server",
        provider: "Cloudflare Workers AI",
        model: MODEL,
        keyless: true
      }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/v1/models") {
      return json({
        object: "list",
        data: [{
          id: MODEL,
          object: "model",
          owned_by: "cloudflare"
        }]
      }, 200, origin);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return json({ error: { message: "Not found." } }, 404, origin);
    }

    if (rateLimited(request)) {
      return json({
        error: {
          message: "Rate limit reached. Please try again shortly.",
          type: "rate_limit_error"
        }
      }, 429, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: "Request body must be valid JSON." } }, 400, origin);
    }

    const messages = normalizeMessages(body.messages);
    if (!messages.length) {
      return json({ error: { message: "messages is required." } }, 400, origin);
    }

    const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 4096, 1), 12000);
    const temperature = Math.min(Math.max(Number(body.temperature) || 0.15, 0), 2);

    try {
      const result = await env.AI.run(MODEL, {
        messages,
        max_tokens: maxTokens,
        temperature
      });

      const content =
        typeof result === "string"
          ? result
          : result?.response
            || result?.result?.response
            || result?.text
            || "";

      if (!content) {
        return json({ error: { message: "Workers AI returned an empty response." } }, 502, origin);
      }

      return json(completion(content), 200, origin);
    } catch (error) {
      return json({
        error: {
          message: error?.message || "Workers AI request failed.",
          type: "provider_error"
        }
      }, 502, origin);
    }
  }
};
