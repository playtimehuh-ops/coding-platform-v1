import { randomBytes } from "node:crypto";
import { STATE_COOKIE, SESSION_COOKIE, SESSION_AGE, cookie, parseCookie, readSession, encodeSession, publicSession } from "../lib/auth.js";
import { upsertUser } from "../lib/db.js";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

function redirect(url, cookies = []) {
  const headers = new Headers({ Location: url });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

async function githubToken(code, redirectUri) {
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
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || "GitHub sign-in failed.");
  }
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
    const action = url.searchParams.get("action") || "me";

    if (action === "login") {
      const state = randomBytes(24).toString("hex");
      const redirectUri = url.origin + "/api/auth?action=callback";
      const authUrl = new URL("https://github.com/login/oauth/authorize");
      authUrl.searchParams.set("client_id", env("GITHUB_CLIENT_ID"));
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "repo workflow read:user user:email");
      authUrl.searchParams.set("state", state);
      return redirect(authUrl.toString(), [cookie(STATE_COOKIE, state, 600)]);
    }

    if (action === "callback") {
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      const savedState = parseCookie(request, STATE_COOKIE);

      if (!code || !state || !savedState || state !== savedState) {
        return json({ error: "Invalid OAuth state." }, 400);
      }

      const redirectUri = url.origin + "/api/auth?action=callback";
      const accessToken = await githubToken(code, redirectUri);
      const user = await githubUser(accessToken);
      await upsertUser(user);
      const session = encodeSession(user, accessToken);

      return redirect("/", [
        cookie(SESSION_COOKIE, session, SESSION_AGE),
        cookie(STATE_COOKIE, "", 0)
      ]);
    }

    if (action === "me") {
      const session = readSession(request);
      return json({
        authenticated: Boolean(session),
        user: publicSession(session)
      });
    }

    if (action === "logout") {
      return redirect("/", [cookie(SESSION_COOKIE, "", 0)]);
    }

    return json({ error: "Unknown auth action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Authentication failed." }, 500);
  }
}