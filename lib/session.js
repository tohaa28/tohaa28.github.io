import crypto from "node:crypto";
import zlib from "node:zlib";
const COOKIE = "gifts_workbench_session";
const MAX_AGE = 12 * 60 * 60;
function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) throw new Error("SESSION_SECRET не настроен на сервере.");
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}
function cookieValue(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}
export function sealSession(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecret(), iv);
  const plain = zlib.deflateRawSync(Buffer.from(JSON.stringify(value), "utf8"));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unsealSession(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getSecret(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const zipped = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(zlib.inflateRawSync(zipped).toString("utf8"));
  } catch { return null; }
}
export function readSession(req) { return unsealSession(cookieValue(req, COOKIE)); }
export function writeSession(res, value) {
  const token = sealSession(value);
  if (token.length > 3800) throw new Error("Сессия gifts.ru слишком велика для cookie.");
  res.setHeader("Set-Cookie", COOKIE + "=" + token + "; Path=/; Max-Age=" + MAX_AGE + "; HttpOnly; Secure; SameSite=Lax");
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
}
