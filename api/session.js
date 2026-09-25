import { sendJson } from "../lib/http.js";
import { getHtml } from "../lib/gifts.js";
import { sessionJar, persistJar } from "../lib/auth.js";
import { clearSession } from "../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Метод не поддерживается." });
  }

  const jar = sessionJar(req);
  if (!jar) return sendJson(res, 200, { active: false });

  try {
    await getHtml(jar, "/private");
    await persistJar(res, jar);
    return sendJson(res, 200, { active: true });
  } catch {
    clearSession(res);
    return sendJson(res, 200, { active: false });
  }
}
