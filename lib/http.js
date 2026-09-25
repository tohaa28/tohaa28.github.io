export function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(value));
}
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw new Error("Слишком большой запрос.");
  }
  return raw ? JSON.parse(raw) : {};
}
export function requireSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return;
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { throw new Error("Недопустимый источник запроса."); }
  if (originHost !== host) throw new Error("Недопустимый источник запроса.");
}
export function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
