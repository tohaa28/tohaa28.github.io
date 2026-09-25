import { sendJson } from "../lib/http.js";
import { getHtml, parseOrder, getBinary } from "../lib/gifts.js";
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
    return sendJson(res, 400, { error: "Некорректная ссылка на превью." });
  }

  const jar = sessionJar(req);
  if (!jar) {
    return sendJson(res, 401, { error: "Сначала войдите в gifts.ru через приложение." });
  }

  try {
    const { html } = await getHtml(jar, "/private/order/" + order);
    const parsed = parseOrder(html, order);
    const item = parsed.items.find(x => String(x.itemId) === itemId);
    if (!item?.imageUrl) {
      return sendJson(res, 404, { error: "Превью артикула не найдено." });
    }

    const { bytes, response } = await getBinary(jar, item.imageUrl, {
      headers: { "Referer": "https://gifts.ru/private/order/" + order }
    });

    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      return sendJson(res, 502, { error: "Некорректное превью артикула." });
    }

    await persistJar(res, jar);
    res.statusCode = 200;
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.end(bytes);
  } catch (error) {
    return sendJson(
      res,
      error?.code === "AUTH" ? 401 : 502,
      { error: error?.message || "Не удалось получить превью." }
    );
  }
}
