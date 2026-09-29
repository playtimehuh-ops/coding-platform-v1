import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "codebase_session";
const STATE_COOKIE = "codebase_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 7;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured on the server.");
  return value;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

function b64(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return b64(createHmac("sha256", env("AUTH_SECRET")).update(value).digest());
}

function encodeSession(user) {
  const payload = b64(JSON.stringify({
    sub: String(user.id),
    login: user.login,
    name: user.name || user.login,
    avatar_url: user.avatar_url || "",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE
  }));
  return payload + "." + sign(payload);
}

function parseCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const found = header.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function readSession(request) {
  const raw = parseCookie(request, COOKIE);
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const expected = sign(parts[0]);
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function setCookie(name, value, maxAge) {
  return name + "=" + encodeURIComponent(value) +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}

function redirect(url, cookies = []) {
  const headers = new Headers({ Location: url });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function githubToken(code, redirectUri) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
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
      authUrl.searchParams.set("scope", "read:user user:email");
      authUrl.searchParams.set("state", state);
      return redirect(authUrl.toString(), [
        setCookie(STATE_COOKIE, state, 600)
      ]);
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
      const session = encodeSession({
        id: user.id,
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url
      });

      return redirect("/", [
        setCookie(COOKIE, session, MAX_AGE),
        setCookie(STATE_COOKIE, "", 0)
      ]);
    }

    if (action === "me") {
      const session = readSession(request);
      if (!session) return json({ authenticated: false });
      return json({
        authenticated: true,
        user: {
          id: session.sub,
          login: session.login,
          name: session.name,
          avatar_url: session.avatar_url
        }
      });
    }

    if (action === "logout") {
      return redirect("/", [setCookie(COOKIE, "", 0)]);
    }

    return json({ error: "Unknown auth action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Authentication failed." }, 500);
  }
}