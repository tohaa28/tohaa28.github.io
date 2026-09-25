import { sendJson } from "../lib/http.js";
import { getHtml, parseBasketOrders } from "../lib/gifts.js";
import { sessionJar, persistJar } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Метод не поддерживается." });
  }

  const jar = sessionJar(req);
  if (!jar) {
    return sendJson(res, 401, { error: "Сначала войдите в gifts.ru через приложение." });
  }

  try {
    const all = new Map();

    for (const path of ["/private", "/", "/private/orders", "/private/order"]) {
      try {
        const { html } = await getHtml(jar, path);
        for (const order of parseBasketOrders(html)) all.set(order.number, order);
      } catch (e) {
        if (e?.code === "AUTH") throw e;
      }
      if (all.size >= 30) break;
    }

    await persistJar(res, jar);
    return sendJson(res, 200, { orders: [...all.values()].slice(0, 30) });
  } catch (error) {
    return sendJson(
      res,
      error?.code === "AUTH" ? 401 : 502,
      { error: error?.message || "Не удалось прочитать корзины." }
    );
  }
}
