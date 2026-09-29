import { randomBytes } from "node:crypto";
import { GITHUB_STATE_COOKIE, cookie, clearCookie, parseCookie, readSession } from "../lib/auth.js";
import { encrypt } from "../lib/auth.js";
import { getGithubConnection, removeGithubConnection, saveGithubConnection } from "../lib/db.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

function redirect(url, cookies = []) {
  const headers = new Headers({ Location: url });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

async function exchange(code, redirectUri) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("GITHUB_CLIENT_ID"),
      client_secret: env("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "GitHub connection failed.");
  return data.access_token;
}

async function githubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "coding-platform-v1"
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not read GitHub profile.");
  return data;
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "status";
    const session = readSession(request);

    if (!session) {
      return action === "status"
        ? json({ connected: false })
        : json({ error: "Create a Codebase account first." }, 401);
    }

    if (request.method === "GET" && action === "login") {
      const state = randomBytes(32).toString("hex");
      const redirectUri = url.origin + "/api/github-link?action=callback";
      const target = new URL("https://github.com/login/oauth/authorize");
      target.searchParams.set("client_id", env("GITHUB_CLIENT_ID"));
      target.searchParams.set("redirect_uri", redirectUri);
      target.searchParams.set("scope", "repo workflow read:user user:email");
      target.searchParams.set("state", state);

      return redirect(target.toString(), [cookie(GITHUB_STATE_COOKIE, state, 600)]);
    }

    if (request.method === "GET" && action === "callback") {
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      const savedState = parseCookie(request, GITHUB_STATE_COOKIE);

      if (!code || !state || !savedState || state !== savedState) {
        return json({ error: "Invalid GitHub authorization state." }, 400);
      }

      const redirectUri = url.origin + "/api/github-link?action=callback";
      const accessToken = await exchange(code, redirectUri);
      const user = await githubUser(accessToken);

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return json({ error: "Supabase persistence is required before linking GitHub." }, 503);
      }

      await saveGithubConnection({
        user_id: session.sub,
        github_id: user.id,
        login: user.login,
        avatar_url: user.avatar_url || "",
        token_encrypted: encrypt(accessToken),
        updated_at: new Date().toISOString()
      });

      return redirect("/", [clearCookie(GITHUB_STATE_COOKIE)]);
    }

    if (request.method === "GET" && action === "status") {
      const connection = await getGithubConnection(session.sub);
      return json({
        connected: Boolean(connection),
        github: connection ? {
          login: connection.login,
          avatar_url: connection.avatar_url || "",
          github_id: connection.github_id,
          connected_at: connection.connected_at
        } : null
      });
    }

    if (request.method === "POST" && action === "unlink") {
      await removeGithubConnection(session.sub);
      return json({ ok: true });
    }

    return json({ error: "Unknown GitHub link action." }, 400);
  } catch (error) {
    return json({ error: error.message || "GitHub linking failed." }, 500);
  }
}