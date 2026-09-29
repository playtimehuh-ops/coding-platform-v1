import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCOUNT_COOKIE = "codebase_session";
export const GITHUB_STATE_COOKIE = "codebase_github_state";
export const SESSION_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured on the server.");
  return value;
}

function key() {
  return createHash("sha256").update(secret()).digest();
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64url")).join(".");
}

export function decrypt(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(parts[0], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[1], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function sign(value) {
  return base64url(createHmac("sha256", secret()).update(value).digest());
}

export function encodeAccountSession(user, accessToken, refreshToken) {
  const body = {
    sub: String(user.id),
    email: user.email || "",
    name: user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "Developer",
    avatar_url: user.user_metadata?.avatar_url || "",
    access: encrypt(accessToken),
    refresh: refreshToken ? encrypt(refreshToken) : null,
    exp: Math.floor(Date.now() / 1000) + SESSION_AGE
  };

  const payload = base64url(JSON.stringify(body));
  return payload + "." + sign(payload);
}

export function parseCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const found = header.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

export function readSession(request) {
  const raw = parseCookie(request, ACCOUNT_COOKIE);
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 2) return null;

  const expected = sign(parts[0]);
  const actual = Buffer.from(parts[1]);
  const wanted = Buffer.from(expected);

  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      ...payload,
      accessToken: decrypt(payload.access),
      refreshToken: payload.refresh ? decrypt(payload.refresh) : null
    };
  } catch {
    return null;
  }
}

export function publicSession(session) {
  if (!session) return null;
  return {
    id: session.sub,
    email: session.email,
    name: session.name,
    avatar_url: session.avatar_url
  };
}

export function cookie(name, value, maxAge, { httpOnly = true } = {}) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    httpOnly ? "HttpOnly" : "",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=" + maxAge
  ].filter(Boolean).join("; ");
}

export function clearCookie(name) {
  return cookie(name, "", 0);
}