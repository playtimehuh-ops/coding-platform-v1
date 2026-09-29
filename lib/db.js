const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function dbConfigured() {
  return Boolean(BASE && KEY);
}

async function request(path, options = {}) {
  if (!dbConfigured()) throw new Error("Supabase persistence is not configured.");
  const response = await fetch(BASE.replace(/\/$/, "") + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || ("Database request failed (" + response.status + ")"));
  }
  return data;
}

export async function upsertUser(user) {
  if (!dbConfigured()) return;
  await request("users", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      github_id: String(user.id),
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url || "",
      updated_at: new Date().toISOString()
    })
  });
}

export async function getSubscription(githubId) {
  if (!dbConfigured()) return null;
  const rows = await request("subscriptions?github_id=eq." + encodeURIComponent(String(githubId)) + "&select=*");
  return rows?.[0] || null;
}

export async function saveSubscription(subscription) {
  if (!dbConfigured()) return;
  await request("subscriptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(subscription)
  });
}

export async function getUsage(githubId, month) {
  if (!dbConfigured()) return 0;
  const rows = await request(
    "usage?github_id=eq." + encodeURIComponent(String(githubId)) +
    "&month=eq." + encodeURIComponent(month) + "&select=runs"
  );
  return Number(rows?.[0]?.runs || 0);
}

export async function setUsage(githubId, month, runs) {
  if (!dbConfigured()) return;
  await request("usage", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ github_id: String(githubId), month, runs })
  });
}

export async function addUsage(githubId) {
  if (!dbConfigured()) return 0;
  const month = new Date().toISOString().slice(0, 7);
  const current = await getUsage(githubId, month);
  const next = current + 1;
  await setUsage(githubId, month, next);
  return next;
}

export function monthKey() {
  return new Date().toISOString().slice(0, 7);
}