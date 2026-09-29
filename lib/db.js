const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  let data = null;
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
      id: String(user.id),
      email: user.email || "",
      name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Developer",
      avatar_url: user.user_metadata?.avatar_url || "",
      updated_at: new Date().toISOString()
    })
  });
}

export async function getSubscription(userId) {
  if (!dbConfigured()) return null;

  const rows = await request(
    "subscriptions?user_id=eq." + encodeURIComponent(String(userId)) + "&select=*"
  );
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

export async function getUsage(userId, month) {
  if (!dbConfigured()) return 0;

  const rows = await request(
    "usage?user_id=eq." + encodeURIComponent(String(userId)) +
    "&month=eq." + encodeURIComponent(month) + "&select=runs"
  );
  return Number(rows?.[0]?.runs || 0);
}

export async function addUsage(userId) {
  if (!dbConfigured()) return 0;

  const month = new Date().toISOString().slice(0, 7);

  try {
    const rows = await request("rpc/increment_usage", {
      method: "POST",
      body: JSON.stringify({ p_user_id: String(userId), p_month: month })
    });
    return Number(rows ?? 0);
  } catch {
    const current = await getUsage(userId, month);
    const next = current + 1;
    await request("usage", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: String(userId), month, runs: next })
    });
    return next;
  }
}

export async function getGithubConnection(userId) {
  if (!dbConfigured()) return null;

  const rows = await request(
    "github_connections?user_id=eq." + encodeURIComponent(String(userId)) +
    "&select=id,github_id,login,avatar_url,token_encrypted,connected_at,updated_at"
  );
  return rows?.[0] || null;
}

export async function saveGithubConnection(connection) {
  if (!dbConfigured()) return;

  await request("github_connections", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(connection)
  });
}

export async function removeGithubConnection(userId) {
  if (!dbConfigured()) return;

  await request(
    "github_connections?user_id=eq." + encodeURIComponent(String(userId)),
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
}