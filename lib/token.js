import { randomBytes, createHash } from "node:crypto";

const PREFIX = "cb_";
const TOKEN_BYTES = 32;

export function generateAccountToken() {
  return PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
}

export function normalizeAccountToken(value) {
  const token = String(value || "").trim();
  return /^cb_[A-Za-z0-9_-]{40,80}$/.test(token) ? token : null;
}

export function accountFromToken(value) {
  const token = normalizeAccountToken(value);
  if (!token) return null;

  const id = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return { id, token };
}

export function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!/^Bearer\s+/i.test(header)) return null;
  return normalizeAccountToken(header.replace(/^Bearer\s+/i, ""));
}
