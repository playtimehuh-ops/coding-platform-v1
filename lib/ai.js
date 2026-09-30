const BASE_URL = "https://api.llmfaucet.dev/v1";

const ALLOWED_MODELS = new Set(["auto", "auto:coding", "auto:smart", "auto:fast"]);

function providerHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Codebase/0.5.0",
    Authorization: "Bearer free"
  };
}

function normalizeModel(value, fallback = "auto:coding") {
  const model = String(value || "").trim();
  return ALLOWED_MODELS.has(model) ? model : fallback;
}

function extractContent(data) {
  const value = data?.choices?.[0]?.message?.content;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(part => typeof part === "string" ? part : (part?.text || part?.content || "")).join("");
  }
  return "";
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("The keyless AI server returned an empty response.");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = [fenced?.[1], raw];
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));

  for (const candidate of candidates.filter(Boolean)) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  throw new Error("The keyless AI server returned invalid structured output.");
}

async function request(messages, model, maxTokens) {
  const requested=normalizeModel(model);
  const candidates=requested==="auto:coding"
    ? ["auto:coding","auto:fast"]
    : [requested];
  let lastError=null;

  for(const selectedModel of candidates){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);

    try{
      const response=await fetch(BASE_URL+"/chat/completions",{
        method:"POST",
        headers:providerHeaders(),
        signal:controller.signal,
        body:JSON.stringify({
          model:selectedModel,
          messages,
          temperature:0.15,
          max_tokens:maxTokens,
          stream:false
        })
      });

      const text=await response.text();
      let data={};
      try{data=text?JSON.parse(text):{}}catch{}

      if(!response.ok){
        const error=new Error(data?.error?.message||data?.message||"The keyless AI server is unavailable.");
        error.status=response.status;
        throw error;
      }

      const content=extractContent(data);
      if(!content)throw new Error("The keyless AI server returned no assistant response.");
      return content;
    }catch(error){
      lastError=error?.name==="AbortError"
        ? new Error("AI route "+selectedModel+" timed out after 25 seconds.")
        : error;
      if(selectedModel!==candidates[candidates.length-1])continue;
    }finally{
      clearTimeout(timer);
    }
  }

  throw lastError||new Error("The keyless AI server is unavailable.");
}

export async function freeAI({ messages, model = "auto:coding", maxTokens = 12000, json = false }) {
  const content = await request(messages, model, maxTokens);
  return json ? extractJson(content) : content;
}

export function publicModels() {
  return [
    { id: "auto:coding", name: "Free · Coding", description: "Automatically routes to the keyless coding server." },
    { id: "auto", name: "Free · Auto", description: "Balances quality, speed, and availability." },
    { id: "auto:smart", name: "Free · Smart", description: "Routes toward stronger available models." },
    { id: "auto:fast", name: "Free · Fast", description: "Prioritizes lower-latency models." }
  ];
}

export { normalizeModel, ALLOWED_MODELS };