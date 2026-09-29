function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "GET required." }, 405);

  if (!process.env.OPENROUTER_API_KEY) {
    return json({ models: ["openrouter/free"], source: "fallback" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: "Bearer " + process.env.OPENROUTER_API_KEY,
        "HTTP-Referer": process.env.APP_URL || new URL(request.url).origin,
        "X-OpenRouter-Title": "Codebase"
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Could not load model catalog.");

    const models = (data.data || [])
      .filter(model => Array.isArray(model.architecture?.input_modalities)
        ? model.architecture.input_modalities.includes("text")
        : true)
      .filter(model => /code|coding|program|developer|coder/i.test(
        (model.name || "") + " " + (model.description || "")
      ))
      .sort((a, b) => {
        const freeA = String(a.pricing?.prompt || "1") === "0" && String(a.pricing?.completion || "1") === "0" ? 0 : 1;
        const freeB = String(b.pricing?.prompt || "1") === "0" && String(b.pricing?.completion || "1") === "0" ? 0 : 1;
        return freeA - freeB;
      })
      .slice(0, 60)
      .map(model => ({
        id: model.id,
        name: model.name,
        context_length: model.context_length || 0,
        prompt_price: model.pricing?.prompt || null,
        completion_price: model.pricing?.completion || null
      }));

    return json({ models, source: "openrouter" });
  } catch (error) {
    return json({ models: ["openrouter/free"], source: "fallback", error: error.message });
  }
}