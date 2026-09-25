(() => {
  if (location.origin !== "https://gifts.ru") return;

  const nativeFetch = window.fetch.bind(window);
  const orderCache = new Map();

  const clean = value => String(value || "").replace(/\s+/g, " ").trim();

  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  function isAuthPage(html, finalUrl = "") {
    return /<form[^>]+name=["']authform["']/i.test(html) ||
      /Авторизация\s*-\s*Проект 111/i.test(html) ||
      /\/auth(?:[/?#]|$)/i.test(finalUrl);
  }

  async function getHtml(path) {
    const res = await nativeFetch(path, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
      headers: { "accept": "text/html,application/xhtml+xml" }
    });
    const html = await res.text();
    if (isAuthPage(html, res.url)) {
      const error = new Error("Сеанс gifts.ru не активен. Войдите в gifts.ru.");
      error.code = "AUTH";
      throw error;
    }
    if (!res.ok) throw new Error("gifts.ru вернул HTTP " + res.status + ".");
    return { html, url: res.url };
  }

  function parseBasketOrders(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const found = new Set();

    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/private\/order\/(\d{5,12})(?:[/?#]|$)/);
      if (m) found.add(m[1]);
    }

    const text = clean(doc.body?.textContent);
    for (const m of text.matchAll(/Заказ\s*(?:№|N)?\s*(\d{5,12})/gi)) {
      found.add(m[1]);
    }

    return [...found].map(number => ({ number }));
  }

  function absolute(url) {
    if (!url) return "";
    try { return new URL(url, "https://gifts.ru").toString(); }
    catch { return ""; }
  }

  function removeArticlePrefix(value, article) {
    const text = clean(value);
    if (!article || !text.startsWith(article)) return text;
    return clean(text.slice(article.length).replace(/^\s*[,;:]\s*/, ""));
  }

  function parseOrder(html, order) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [];

    for (const root of doc.querySelectorAll("li[data-itemid]")) {
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

    return { order: String(order), items };
  }

  async function getOrder(order) {
    if (orderCache.has(order)) return orderCache.get(order);
    const { html } = await getHtml("/private/order/" + order);
    const parsed = parseOrder(html, order);
    orderCache.set(order, parsed);
    return parsed;
  }

  async function apiSession() {
    try {
      await getHtml("/private");
      return json({ active: true, direct: true });
    } catch {
      return json({ active: false, direct: true });
    }
  }

  async function apiLogin(init) {
    if (String(init.method || "GET").toUpperCase() === "DELETE") {
      return json({ ok: true, note: "Сеанс gifts.ru остаётся в браузере." });
    }

    let body;
    try { body = JSON.parse(String(init.body || "{}")); }
    catch { body = {}; }

    const login = clean(body.login);
    const password = String(body.password || "");
    const code = clean(body.code);

    if (!login || !password) {
      return json({ error: "Введите логин и пароль gifts.ru." }, 400);
    }

    await nativeFetch("/auth", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

    const form = new URLSearchParams({
      login,
      password,
      code,
      redirect: "/",
      orderconf: ""
    });

    const res = await nativeFetch("/auth", {
      method: "POST",
      credentials: "include",
      redirect: "follow",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form
    });

    const html = await res.text();
    if (!res.ok || isAuthPage(html, res.url)) {
      return json({ error: "gifts.ru не подтвердил логин, пароль или код компании." }, 403);
    }

    orderCache.clear();
    return json({ ok: true, active: true, direct: true });
  }

  async function apiBasket() {
    const found = new Map();
    for (const path of ["/private", "/", "/private/orders", "/private/order"]) {
      try {
        const { html } = await getHtml(path);
        for (const order of parseBasketOrders(html)) found.set(order.number, order);
      } catch (error) {
        if (error?.code === "AUTH") return json({ error: error.message }, 401);
      }
      if (found.size >= 30) break;
    }
    return json({ orders: [...found.values()].slice(0, 30) });
  }

  async function apiOrder(order) {
    if (!/^\d{5,12}$/.test(order)) {
      return json({ error: "Некорректный номер заказа." }, 400);
    }
    try {
      const parsed = await getOrder(order);
      if (!parsed.items.length) {
        return json({ error: "В заказе не найдены выбранные нанесения." }, 404);
      }
      return json(parsed);
    } catch (error) {
      return json({ error: error?.message || String(error) }, error?.code === "AUTH" ? 401 : 502);
    }
  }

  async function apiPdf(order, itemId) {
    if (!/^\d{5,12}$/.test(order) || !/^\d{1,20}$/.test(itemId)) {
      return json({ error: "Некорректная ссылка на PDF." }, 400);
    }

    try {
      const parsed = await getOrder(order);
      if (!parsed.items.some(item => String(item.itemId) === String(itemId))) {
        return json({ error: "Этот PDF не относится к выбранному заказу." }, 404);
      }

      const res = await nativeFetch(
        "/drawing?action=getOrderItemPdf&orderitemid=" + encodeURIComponent(itemId),
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { "referer": "https://gifts.ru/private/order/" + order }
        }
      );

      const bytes = await res.arrayBuffer();
      const head = bytes.byteLength >= 5
        ? new TextDecoder().decode(bytes.slice(0, 5))
        : "";

      if (!res.ok || head !== "%PDF-") {
        return json({ error: "gifts.ru вернул некорректный PDF." }, 502);
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "cache-control": "no-store"
        }
      });
    } catch (error) {
      return json({ error: error?.message || String(error) }, error?.code === "AUTH" ? 401 : 502);
    }
  }

  async function apiPreview(order, itemId) {
    try {
      const parsed = await getOrder(order);
      const item = parsed.items.find(x => String(x.itemId) === String(itemId));
      if (!item?.imageUrl) return json({ error: "Превью не найдено." }, 404);

      const res = await nativeFetch(item.imageUrl, {
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) return json({ error: "Превью недоступно." }, 502);

      return new Response(await res.arrayBuffer(), {
        status: 200,
        headers: {
          "content-type": res.headers.get("content-type") || "image/jpeg",
          "cache-control": "private, max-age=300"
        }
      });
    } catch (error) {
      return json({ error: error?.message || String(error) }, 502);
    }
  }

  window.fetch = async (input, init = {}) => {
    try {
      const raw = typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      const url = new URL(raw, location.href);
      const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/session" && method === "GET") return apiSession();
        if (url.pathname === "/api/login") return apiLogin({ ...init, method });
        if (url.pathname === "/api/basket" && method === "GET") return apiBasket();

        let m = url.pathname.match(/^\/api\/orders\/(\d{5,12})\/items\/(\d{1,20})\.pdf$/);
        if (m && method === "GET") return apiPdf(m[1], m[2]);

        m = url.pathname.match(/^\/api\/orders\/(\d{5,12})\/items\/(\d{1,20})\/preview$/);
        if (m && method === "GET") return apiPreview(m[1], m[2]);

        m = url.pathname.match(/^\/api\/orders\/(\d{5,12})$/);
        if (m && method === "GET") return apiOrder(m[1]);

        return json({ error: "Неизвестный локальный запрос." }, 404);
      }
    } catch {}
    return nativeFetch(input, init);
  };

  document.documentElement.dataset.directGiftsMode = "true";
})();