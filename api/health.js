export default async function handler() {
  return new Response(JSON.stringify({
    ok: true,
    service: "coding-platform-v1",
    mode: "local",
    authenticated: false,
    github: false,
    aiProvider: "llmfaucet"
  }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
