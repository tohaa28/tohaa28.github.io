import { sendJson } from "../lib/http.js";
import { getHtml, parseOrder } from "../lib/gifts.js";
import { sessionJar, persistJar } from "../lib/auth.js";

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Метод не поддерживается." });
  }

  const order = String(one(req.query?.order) || "").trim();
  if (!/^\d{5,12}$/.test(order)) {
    return sendJson(res, 400, { error: "Некорректный номер заказа." });
  }

  const jar = sessionJar(req);
  if (!jar) {
    return sendJson(res, 401, { error: "Сначала войдите в gifts.ru через приложение." });
  }

  try {
    const { html } = await getHtml(jar, "/private/order/" + order);
    const parsed = parseOrder(html, order);

    if (!parsed.items.length) {
      return sendJson(res, 404, { error: "В заказе не найдены выбранные нанесения с PDF-шаблонами." });
    }

    await persistJar(res, jar);
    return sendJson(res, 200, parsed);
  } catch (error) {
    return sendJson(
      res,
      error?.code === "AUTH" ? 401 : 502,
      { error: error?.message || "Не удалось получить заказ." }
    );
  }
}
