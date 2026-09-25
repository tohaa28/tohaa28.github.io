import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import { cleanText } from "./http.js";

export const BASE = "https://gifts.ru";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36";

function requestHeaders(extra = {}) {
  return {
    "User-Agent": UA,
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...extra
  };
}

export function createJar(serialized) {
  return serialized ? CookieJar.deserializeSync(serialized) : new CookieJar();
}

export async function serializeJar(jar) {
  return await jar.serialize();
}

export function clientForJar(jar) {
  const wrapped = makeFetchCookie(fetch, jar);
  return (url, options = {}) => wrapped(url, {
    redirect: "follow",
    ...options,
    headers: requestHeaders(options.headers || {})
  });
}

export function isAuthPage(html, finalUrl = "") {
  return /<form[^>]+name=["']authform["']/i.test(html) ||
    /Авторизация\s*-\s*Проект 111/i.test(html) ||
    /\/auth(?:[?#]|$)/i.test(finalUrl);
}

export async function loginToGifts({ login, password, code }) {
  const jar = new CookieJar();
  const request = clientForJar(jar);

  await request(BASE + "/auth", { method: "GET" });

  const body = new URLSearchParams({
    login,
    password,
    code: code || "",
    redirect: "/",
    orderconf: ""
  });

  const response = await request(BASE + "/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": BASE,
      "Referer": BASE + "/auth"
    },
    body
  });

  const html = await response.text();
  if (!response.ok || isAuthPage(html, response.url)) {
    throw new Error("gifts.ru не подтвердил логин, пароль или код компании.");
  }
  return jar;
}

export async function getHtml(jar, path) {
  const request = clientForJar(jar);
  const response = await request(new URL(path, BASE).toString(), {
    method: "GET",
    headers: { "Referer": BASE + "/" }
  });
  const html = await response.text();
  if (isAuthPage(html, response.url)) {
    const error = new Error("Сеанс gifts.ru истёк. Войдите снова.");
    error.code = "AUTH";
    throw error;
  }
  if (!response.ok) throw new Error("gifts.ru вернул HTTP " + response.status + ".");
  return { html, url: response.url };
}

export async function getBinary(jar, url, options = {}) {
  const request = clientForJar(jar);
  const response = await request(url, { method: "GET", ...options });
  if (!response.ok) throw new Error("gifts.ru вернул HTTP " + response.status + ".");
  return { bytes: Buffer.from(await response.arrayBuffer()), response };
}

function absolute(url) {
  if (!url) return "";
  try { return new URL(url, BASE).toString(); } catch { return ""; }
}

export function parseBasketOrders(html) {
  const $ = cheerio.load(html);
  const found = new Set();

  $("a[href]").each((_, node) => {
    const href = $(node).attr("href") || "";
    const m = href.match(/\/private\/order\/(\d{5,12})(?:[/?#]|$)/);
    if (m) found.add(m[1]);
  });

  for (const m of html.matchAll(/Заказ\s*(?:№|N)?\s*(\d{5,12})/gi)) found.add(m[1]);
  return [...found].map(number => ({ number }));
}

function removeArticlePrefix(value, article) {
  const text = cleanText(value);
  if (!article || !text.startsWith(article)) return text;
  const rest = text.slice(article.length);
  const sep = rest.match(/^\s*[,;:]\s*/);
  return cleanText(sep ? rest.slice(sep[0].length) : rest);
}

export function parseOrder(html, order) {
  const $ = cheerio.load(html);
  const items = [];

  $("li[data-itemid]").each((_, node) => {
    const root = $(node);
    const itemId = cleanText(root.attr("data-itemid"));
    const article = cleanText(root.find(".cart-tbl-name").first().text()).replace(/^Артикул\s*/i, "");
    const product = cleanText(root.find(".cart-tbl-id .cart-tbl-lbl").first().text());
    const qtyMatch = cleanText(root.find(".cart-qty").first().text()).match(/\d+/);
    const quantity = qtyMatch ? Number(qtyMatch[0]) : NaN;
    const method = cleanText(root.find(".cart-tbl-imp g-droper > span").first().text());
    const drawTaskIds = cleanText(root.attr("data-drawtaskids"));

    const places = [];
    root.find(".cart-tbl-imp .flex-center.flex-column").each((__, placeNode) => {
      const value = cleanText($(placeNode).find(".color-text").first().text());
      const place = removeArticlePrefix(value, article);
      if (place) places.push(place);
    });

    if (!/^\d+$/.test(itemId) || !article || !method || !Number.isSafeInteger(quantity) || quantity < 1) return;

    let imageUrl = "";
    root.find("img").each((__, img) => {
      if (imageUrl) return;
      const src = $(img).attr("src") || $(img).attr("data-src") || "";
      if (src && src.includes(article.split(".")[0])) imageUrl = absolute(src);
    });
    if (!imageUrl) {
      const src = root.find("img").first().attr("src") || root.find("img").first().attr("data-src") || "";
      imageUrl = absolute(src);
    }

    items.push({
      itemId,
      article,
      product,
      quantity,
      method,
      place: places.join(", "),
      places,
      drawTaskIds: drawTaskIds ? drawTaskIds.split(/[\s,;]+/).filter(Boolean) : [],
      imageUrl,
      requirements: cleanText(root.text()).slice(0, 5000),
      source: "order-dom"
    });
  });

  return { order: String(order), items };
}

export function findPreviewUrl(html, itemId) {
  const $ = cheerio.load(html);
  const escaped = String(itemId).replace(/["\\]/g, "");
  const root = $('li[data-itemid="' + escaped + '"]').first();
  if (!root.length) return "";
  let selected = "";
  root.find("img").each((_, img) => {
    if (selected) return;
    const src = $(img).attr("src") || $(img).attr("data-src") || "";
    if (src) selected = absolute(src);
  });
  return selected;
}
