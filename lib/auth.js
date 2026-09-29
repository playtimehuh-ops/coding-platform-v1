import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "codebase_session";
export const STATE_COOKIE = "codebase_oauth_state";
export const SESSION_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured on the server.");
  return value;
}

function key() {
  return createHash("sha256").update(secret()).digest();
}

export function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function sign(value) {
  return base64url(createHmac("sha256", secret()).update(value).digest());
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64url")).join(".");
}

export function decrypt(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(parts[0], "base64url")
    );
    decipher.setAuthTag(Buffer.from(parts[1], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2], "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function encodeSession(user, accessToken) {
  const body = {
    sub: String(user.id),
    login: user.login,
    name: user.name || user.login,
    avatar_url: user.avatar_url || "",
    token: encrypt(accessToken),
    exp: Math.floor(Date.now() / 1000) + SESSION_AGE
  };
  const payload = base64url(JSON.stringify(body));
  return payload + "." + sign(payload);
}

export function parseCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const found = header
    .split(";")
    .map(v => v.trim())
    .find(v => v.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

export function readSession(request) {
  const raw = parseCookie(request, SESSION_COOKIE);
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

    const token = decrypt(payload.token);
    return {
      ...payload,
      accessToken: token
    };
  } catch {
    return null;
  }
}

export function cookie(name, value, maxAge) {
  return name + "=" + encodeURIComponent(value) +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}

export function publicSession(session) {
  if (!session) return null;
  return {
    id: session.sub,
    login: session.login,
    name: session.name,
    avatar_url: session.avatar_url
  };
}