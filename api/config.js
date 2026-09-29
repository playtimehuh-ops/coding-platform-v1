export default async function handler() {
  return new Response(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    appName: "Codebase"
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}