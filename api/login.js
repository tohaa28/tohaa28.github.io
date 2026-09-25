import { readJson, requireSameOrigin, sendJson } from "../lib/http.js";
import { loginToGifts, serializeJar } from "../lib/gifts.js";
import { clearSession, writeSession } from "../lib/session.js";

export default async function handler(req, res) {
  try {
    requireSameOrigin(req);

    if (req.method === "DELETE") {
      clearSession(res);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Метод не поддерживается." });
    }

    const body = await readJson(req);
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    const code = String(body.code || "").trim();

    if (!login || !password || login.length > 100 || password.length > 300 || code.length > 20) {
      return sendJson(res, 400, { error: "Введите логин и пароль gifts.ru." });
    }

    const jar = await loginToGifts({ login, password, code });
    writeSession(res, {
      jar: await serializeJar(jar),
      updatedAt: Date.now()
    });

    return sendJson(res, 200, { ok: true, active: true });
  } catch (error) {
    return sendJson(res, 403, { error: error?.message || "Вход не подтверждён." });
  }
}
