const ext = globalThis.browser ?? globalThis.chrome;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitTabComplete(tabId, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const tab = await ext.tabs.get(tabId);
    if (tab.status === "complete") return tab;
    await sleep(120);
  }
  throw new Error("Страница gifts.ru загружается слишком долго.");
}

async function runOnHiddenTab(url, func, args = []) {
  const tab = await ext.tabs.create({ url, active: false });
  try {
    await waitTabComplete(tab.id);
    const result = await ext.scripting.executeScript({
      target: { tabId: tab.id },
      func,
      args
    });
    return result?.[0]?.result;
  } finally {
    try { await ext.tabs.remove(tab.id); } catch {}
  }
}

function scrapeSessionDom() {
  const authForm = document.querySelector('form[name="authform"]');
  const loggedOut =
    !!authForm ||
    /Авторизация\s*-\s*Проект 111/i.test(document.title) ||
    /\/auth(?:[/?#]|$)/i.test(location.href);
  return { active: !loggedOut, url: location.href };
}

async function sessionStatus() {
  try {
    return await runOnHiddenTab("https://gifts.ru/private", scrapeSessionDom);
  } catch {
    return { active: false };
  }
}

function scrapeBasketDom() {
  const found = new Set();
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    const m = href.match(/\/private\/order\/(\d{5,12})(?:[/?#]|$)/);
    if (m) found.add(m[1]);
  }
  const text = document.body?.innerText || "";
  for (const m of text.matchAll(/Заказ\s*(?:№|N)?\s*(\d{5,12})/gi)) {
    found.add(m[1]);
  }
  return [...found].map(number => ({ number }));
}

async function readBasket() {
  for (const path of ["/private", "/private/orders", "/private/order", "/"]) {
    try {
      const orders = await runOnHiddenTab("https://gifts.ru" + path, scrapeBasketDom);
      if (Array.isArray(orders) && orders.length) return { orders };
    } catch {}
  }
  return { orders: [] };
}

function scrapeOrderDom(orderNumber) {
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  const absolute = value => {
    try { return new URL(value, location.origin).toString(); } catch { return ""; }
  };
  const removeArticlePrefix = (value, article) => {
    const text = clean(value);
    if (!article || !text.startsWith(article)) return text;
    return clean(text.slice(article.length).replace(/^\s*[,;:]\s*/, ""));
  };

  const items = [];
  for (const root of document.querySelectorAll("li[data-itemid]")) {
    const itemId = clean(root.getAttribute("data-itemid"));
    const article = clean(root.querySelector(".cart-tbl-name")?.textContent)
      .replace(/^Артикул\s*/i, "");
    const product = clean(root.querySelector(".cart-tbl-id .cart-tbl-lbl")?.textContent);
    const qtyMatch = clean(root.querySelector(".cart-qty")?.textContent).match(/\d+/);
    const quantity = qtyMatch ? Number(qtyMatch[0]) : NaN;
    const method = clean(root.querySelector(".cart-tbl-imp g-droper > span")?.textContent);
    const drawTaskRaw = clean(root.getAttribute("data-drawtaskids"));

    const places = [];
    for (const placeNode of root.querySelectorAll(".cart-tbl-imp .flex-center.flex-column")) {
      const value = clean(placeNode.querySelector(".color-text")?.textContent);
      const place = removeArticlePrefix(value, article);
      if (place && !places.includes(place)) places.push(place);
    }

    if (!/^\d+$/.test(itemId) || !article || !method ||
        !Number.isSafeInteger(quantity) || quantity < 1) continue;

    const images = [...root.querySelectorAll("img")];
    const preferred = images.find(img => {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
      return src.includes(article.split(".")[0]);
    }) || images[0];

    items.push({
      itemId,
      article,
      product,
      quantity,
      method,
      place: places.join(", "),
      places,
      drawTaskIds: drawTaskRaw ? drawTaskRaw.split(/[\s,;]+/).filter(Boolean) : [],
      imageUrl: preferred
        ? absolute(preferred.getAttribute("src") || preferred.getAttribute("data-src") || "")
        : "",
      requirements: clean(root.textContent).slice(0, 5000),
      source: "order-dom"
    });
  }

  return { order: String(orderNumber), items };
}

async function readOrder(order) {
  if (!/^\d{5,12}$/.test(order)) throw new Error("Некорректный номер заказа.");
  const data = await runOnHiddenTab(
    "https://gifts.ru/private/order/" + order,
    scrapeOrderDom,
    [order]
  );
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Не удалось прочитать страницу заказа.");
  }
  return data;
}

function fetchPdfOnOrderPage(itemId) {
  return (async () => {
    const res = await fetch(
      "/drawing?action=getOrderItemPdf&orderitemid=" + encodeURIComponent(itemId),
      { credentials: "include", cache: "no-store" }
    );
    if (!res.ok) throw new Error("gifts.ru вернул HTTP " + res.status + ".");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 5) throw new Error("Пустой PDF.");
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return {
      contentType: res.headers.get("content-type") || "application/pdf",
      base64: btoa(binary)
    };
  })();
}

async function fetchOrderPdf(order, itemId) {
  if (!/^\d{5,12}$/.test(order) || !/^\d{1,20}$/.test(itemId)) {
    throw new Error("Некорректная ссылка на PDF.");
  }
  const data = await readOrder(order);
  if (!data.items.some(item => String(item.itemId) === String(itemId))) {
    throw new Error("Этот PDF не относится к выбранному заказу.");
  }
  return await runOnHiddenTab(
    "https://gifts.ru/private/order/" + order,
    fetchPdfOnOrderPage,
    [itemId]
  );
}

function fetchCurrentBinary() {
  return (async () => {
    const res = await fetch(location.href, { cache: "no-store" });
    if (!res.ok) throw new Error("Файл изображения недоступен.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return {
      contentType: res.headers.get("content-type") || "image/jpeg",
      base64: btoa(binary)
    };
  })();
}

async function fetchPreview(order, itemId) {
  const data = await readOrder(order);
  const item = data.items.find(x => String(x.itemId) === String(itemId));
  if (!item?.imageUrl) throw new Error("Превью артикула не найдено.");
  return await runOnHiddenTab(item.imageUrl, fetchCurrentBinary);
}

async function handle(message) {
  switch (message.type) {
    case "PING":
      return { version: ext.runtime.getManifest().version };
    case "SESSION":
      return await sessionStatus();
    case "OPEN_LOGIN": {
      const tab = await ext.tabs.create({ url: "https://gifts.ru/auth", active: true });
      return { opened: true, tabId: tab.id };
    }
    case "BASKET":
      return await readBasket();
    case "ORDER":
      return await readOrder(String(message.order || ""));
    case "PDF":
      return await fetchOrderPdf(String(message.order || ""), String(message.itemId || ""));
    case "PREVIEW":
      return await fetchPreview(String(message.order || ""), String(message.itemId || ""));
    default:
      throw new Error("Неизвестная команда моста.");
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.channel !== "gifts-workbench") return;

  const task = handle(message)
    .then(data => ({ ok: true, data }))
    .catch(error => ({ ok: false, error: error?.message || String(error) }));

  if (typeof browser !== "undefined") return task;

  task.then(sendResponse);
  return true;
});