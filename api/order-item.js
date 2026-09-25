import { sendJson } from "../lib/http.js";
import { BASE, getHtml, parseOrder, getBinary } from "../lib/gifts.js";
import { sessionJar, persistJar } from "../lib/auth.js";

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Метод не поддерживается." });
  }

  const order = String(one(req.query?.order) || "").trim();
  const itemId = String(one(req.query?.itemId) || "").trim();
  if (!/^\d{5,12}$/.test(order) || !/^\d{1,20}$/.test(itemId)) {
    return sendJson(res, 400, { error: "Некорректная ссылка на шаблон." });
  }

  const jar = sessionJar(req);
  if (!jar) {
    return sendJson(res, 401, { error: "Сначала войдите в gifts.ru через приложение." });
  }

  try {
    const { html } = await getHtml(jar, "/private/order/" + order);
    const parsed = parseOrder(html, order);
    const item = parsed.items.find(x => String(x.itemId) === itemId);
    if (!item) {
      return sendJson(res, 404, { error: "Этот шаблон не относится к выбранному заказу." });
    }

    const url = new URL("/drawing", BASE);
    url.searchParams.set("action", "getOrderItemPdf");
    url.searchParams.set("orderitemid", itemId);

    const { bytes } = await getBinary(jar, url.toString(), {
      headers: { "Referer": BASE + "/private/order/" + order }
    });

    if (bytes.length < 5 || bytes.length > 40 * 1024 * 1024 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return sendJson(res, 502, { error: "gifts.ru вернул некорректный PDF." });
    }

    await persistJar(res, jar);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(bytes);
  } catch (error) {
    return sendJson(
      res,
      error?.code === "AUTH" ? 401 : 502,
      { error: error?.message || "Не удалось скачать PDF." }
    );
  }
}
