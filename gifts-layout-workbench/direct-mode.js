(() => {
  const GIFTS_ORIGIN = "https://gifts.ru";
  let inGiftsContext = location.origin === GIFTS_ORIGIN;
  if (!inGiftsContext) {
    try { inGiftsContext = parent !== window && parent.location.origin === GIFTS_ORIGIN; }
    catch {}
  }
  if (!inGiftsContext) return;

  const nativeFetch = window.fetch.bind(window);
  const giftsUrl = path => new URL(path, GIFTS_ORIGIN + "/").toString();
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
    const res = await nativeFetch(giftsUrl(path), {
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
    const add = value => {
      const number = String(value || "").trim();
      if (/^\d{5,12}$/.test(number)) found.add(number);
    };

    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      for (const re of [
        /\/private\/order\/(\d{5,12})(?:[/?#]|$)/i,
        /\/order\/(\d{5,12})(?:[/?#]|$)/i,
        /[?&](?:order|orderno|order_number|number)=(\d{5,12})(?:[&#]|$)/i
      ]) {
        const m = href.match(re);
        if (m) add(m[1]);
      }
    }

    for (const node of doc.querySelectorAll("[data-order],[data-order-number],[data-orderno]")) {
      const nearby = clean(node.textContent);
      if (/заказ/i.test(nearby)) {
        add(node.getAttribute("data-order"));
        add(node.getAttribute("data-order-number"));
        add(node.getAttribute("data-orderno"));
      }
    }

    const text = clean(doc.body?.textContent);
    for (const m of text.matchAll(/Заказ\s*(?:№|N)?\s*[:#-]?\s*(\d{5,12})/gi)) add(m[1]);

    for (const re of [
      /["']orderNumber["']\s*[:=]\s*["']?(\d{5,12})/gi,
      /["']order_number["']\s*[:=]\s*["']?(\d{5,12})/gi,
      /["']orderNo["']\s*[:=]\s*["']?(\d{5,12})/gi
    ]) {
      for (const m of html.matchAll(re)) add(m[1]);
    }

    return [...found].map(number => ({ number }));
  }

  function hostDocument() {
    try {
      if (parent !== window && parent.location.origin === GIFTS_ORIGIN) return parent.document;
    } catch {}
    return null;
  }

  function basketCandidatePaths() {
    const paths = new Set(["/cart", "/cart/", "/"]);
    const doc = hostDocument();
    if (!doc) return [...paths];

    const addUrl = raw => {
      if (!raw) return;
      try {
        const url = new URL(raw, GIFTS_ORIGIN + "/");
        if (url.origin !== GIFTS_ORIGIN) return;
        const probe = (url.pathname + url.search).toLowerCase();
        if (/logout|delete|remove|checkout|submit|confirm|action=|\/act\//.test(probe)) return;
        if (/cart|basket|private|order/.test(probe)) paths.add(url.pathname + url.search);
      } catch {}
    };

    try { addUrl(parent.location.pathname + parent.location.search); } catch {}

    for (const node of doc.querySelectorAll("a[href],[data-href],[data-url],[data-hash]")) {
      const label = clean([
        node.textContent,
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.getAttribute("class")
      ].filter(Boolean).join(" "));
      const raw =
        node.getAttribute("href") ||
        node.getAttribute("data-href") ||
        node.getAttribute("data-url") ||
        node.getAttribute("data-hash") ||
        "";
      if (/корзин|cart|basket|заказ/i.test(label + " " + raw)) addUrl(raw);
    }

    return [...paths].slice(0, 20);
  }

  async function readRenderedOrders(path) {
    const doc = hostDocument();
    if (!doc) return [];
    return await new Promise(resolve => {
      const frame = doc.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:2px;height:2px;opacity:0;pointer-events:none;border:0";
      let done = false;
      const finish = orders => {
        if (done) return;
        done = true;
        try { frame.remove(); } catch {}
        resolve(Array.isArray(orders) ? orders : []);
      };
      const timer = setTimeout(() => finish([]), 7000);
      frame.onload = () => {
        setTimeout(() => {
          try {
            const html = frame.contentDocument?.documentElement?.outerHTML || "";
            clearTimeout(timer);
            finish(parseBasketOrders(html));
          } catch {
            clearTimeout(timer);
            finish([]);
          }
        }, 1400);
      };
      try {
        frame.src = giftsUrl(path);
        doc.documentElement.appendChild(frame);
      } catch {
        clearTimeout(timer);
        finish([]);
      }
    });
  }

  function absolute(url) {
    if (!url) return "";
    try { return new URL(url, "https://gifts.ru").toString(); }
    catch { return ""; }
  }

  function imageUrlCandidates(root, article = "") {
    const found = [];
    const seen = new Set();
    const baseArticle = clean(article).split(".")[0].toLowerCase();

    const add = raw => {
      if (!raw) return;
      const value = clean(String(raw).split(",")[0].trim().split(/\s+/)[0]);
      if (!value || /^data:/i.test(value)) return;
      const url = absolute(value);
      if (!url || seen.has(url)) return;
      try {
        const parsed = new URL(url);
        if (!/\.(?:jpe?g|png|webp|gif)(?:$|[?#])/i.test(parsed.pathname + parsed.search)) return;
      } catch { return; }
      seen.add(url);
      found.push(url);
    };

    for (const node of root.querySelectorAll("img,source")) {
      for (const attr of ["src","data-src","data-original","data-lazy","data-image","data-url","srcset","data-srcset"]) {
        add(node.getAttribute(attr));
      }
    }

    for (const node of root.querySelectorAll("[style]")) {
      const style = node.getAttribute("style") || "";
      for (const m of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) add(m[2]);
    }

    for (const node of root.querySelectorAll("a[href]")) add(node.getAttribute("href"));

    return found.sort((a,b) => {
      const score = url => {
        const s = url.toLowerCase();
        let n = 0;
        if (s.includes("files.gifts.ru")) n += 20;
        if (s.includes("/reviewer/")) n += 15;
        if (baseArticle && (s.includes("/"+baseArticle+"_") || s.includes("/"+baseArticle+"."))) n += 40;
        if (/_(?:500|400|300|200)(?:\.|_)/.test(s)) n += 5;
        return n;
      };
      return score(b)-score(a);
    });
  }

  function productUrlFromItem(root) {
    const selectors = [
      ".cart-tbl-name a[href]",
      ".cart-tbl-id a[href]",
      "a[href*='/id/']"
    ];
    for (const selector of selectors) {
      for (const link of root.querySelectorAll(selector)) {
        const href = absolute(link.getAttribute("href") || "");
        try {
          const u = new URL(href);
          if (u.origin === GIFTS_ORIGIN && /\/id\/\d+(?:[/?#]|$)/i.test(u.pathname + u.search)) return u.href;
        } catch {}
      }
    }
    return "";
  }

  function imageFromProductHtml(html, article) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return imageUrlCandidates(doc, article)[0] || "";
  }

  async function resolveItemImage(item) {
    if (item?.imageUrl) return item.imageUrl;
    if (!item?.productUrl) return "";
    try {
      const { html } = await getHtml(item.productUrl);
      const imageUrl = imageFromProductHtml(html, item.article);
      if (imageUrl) item.imageUrl = imageUrl;
      return imageUrl;
    } catch {
      return "";
    }
  }

  function removeArticlePrefix(value, article) {
    const text = clean(value);
    if (!article || !text.startsWith(article)) return text;
    return clean(text.slice(article.length).replace(/^\s*[,;:]\s*/, ""));
  }

  function extractExactPlaces(root, article) {
    const result = [];
    const seen = new Set();
    const bad = /(?:скачать|шаблон|конструктор|pdf|cdr|макет|тираж|артикул|файл)/i;
    const placeWord = /(?:лицо|оборот|спереди|сзади|слева|справа|сторон[аы]|клапан|крышк|дно|ручк|карман|рукав|груд|спин|капюшон|чехол|шов|клин|купол|горловин|этикет|бирк|упаковк|бок|периметр|основан|поле)/i;
    const methodWord = /(?:DTF|DTG|шелк|тампо|грав|УФ|UV|сублим|вышив|тиснен|деколь|лазер|флекс|трансфер|печать)/i;

    const add = raw => {
      let value = removeArticlePrefix(raw, article);
      value = clean(value)
        .replace(/^место\s+нанесения\s*[:—-]?\s*/i, "")
        .replace(/^место\s*[:—-]?\s*/i, "")
        .replace(/^поверхность\s*[:—-]?\s*/i, "")
        .replace(/^сторона\s*[:—-]?\s*/i, "");
      if (!value || value.length > 180 || bad.test(value) || methodWord.test(value)) return;
      const key = value.toLocaleLowerCase("ru-RU");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
    };

    for (const select of root.querySelectorAll("select")) {
      const attrs = [
        select.getAttribute("name"),
        select.id,
        String(select.className),
        select.parentElement?.textContent
      ].filter(Boolean).join(" ");
      if (!/место|сторон|поле|поверхност|place|position|side|field|location/i.test(attrs)) continue;
      const option = [...select.options].find(o => o.selected) || select.options[select.selectedIndex];
      if (option) add(option.textContent || option.value);
    }

    for (const node of root.querySelectorAll(".cart-tbl-imp .flex-center.flex-column .color-text, div.size--sm.flex.flex-center.flex-column > div")) {
      const value = clean(node.textContent);
      if (placeWord.test(value)) add(value);
    }

    for (const label of root.querySelectorAll("[data-label],label,dt,th")) {
      if (!/место\s*нанесения|поле\s*нанесения|сторона|поверхность/i.test(clean(label.textContent))) continue;
      const next = label.nextElementSibling;
      if (next) add(next.textContent);
    }

    for (const node of root.querySelectorAll("*")) {
      for (const attr of [...node.attributes]) {
        if (!/place|position|side|field|location|место|сторон|поле|поверхност/i.test(attr.name)) continue;
        if (placeWord.test(attr.value)) add(attr.value);
      }
    }

    return result;
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

      const places = extractExactPlaces(root, article);

      if (!/^\d+$/.test(itemId) || !article || !method ||
          !Number.isSafeInteger(quantity) || quantity < 1) continue;

      const imageUrl = imageUrlCandidates(root, article)[0] || "";
      const productUrl = productUrlFromItem(root);

      items.push({
        itemId,
        article,
        product,
        quantity,
        method,
        place: places.join(", "),
        places,
        drawTaskIds: drawTaskRaw ? drawTaskRaw.split(/[\s,;]+/).filter(Boolean) : [],
        imageUrl,
        productUrl,
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

  function authStateFromHost() {
    const doc = hostDocument();
    if (!doc) return null;

    const bodyText = clean(doc.body?.innerText || doc.body?.textContent || "");
    const logoutNode = [...doc.querySelectorAll("a,button,[role='button']")].find(node => {
      const label = clean([
        node.textContent,
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.getAttribute("href")
      ].filter(Boolean).join(" "));
      return /(?:^|\s)(?:выйти|выход|logout)(?:\s|$)/i.test(label);
    });
    if (logoutNode) return true;

    const loginNode = [...doc.querySelectorAll("a,button,[role='button'],form")].find(node => {
      const label = clean([
        node.textContent,
        node.getAttribute("title"),
        node.getAttribute("aria-label"),
        node.getAttribute("href"),
        node.getAttribute("action")
      ].filter(Boolean).join(" "));
      return /(?:^|\s)(?:войти|вход|авторизац|login)(?:\s|$)/i.test(label);
    });
    if (loginNode && !/выйти/i.test(bodyText)) return false;

    return null;
  }

  async function apiSession() {
    const hostState = authStateFromHost();
    if (hostState !== null) return json({ active: hostState, direct: true, source: "host-dom" });

    for (const path of ["/", "/auth"]) {
      try {
        const res = await nativeFetch(giftsUrl(path), {
          method: "GET",
          credentials: "include",
          redirect: "follow",
          cache: "no-store",
          headers: { accept: "text/html,application/xhtml+xml" }
        });
        const html = await res.text();
        if (path === "/" && res.ok && !isAuthPage(html, res.url)) {
          return json({ active: true, direct: true, source: "home" });
        }
      } catch {}
    }
    return json({ active: false, direct: true, source: "fallback" });
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

    await nativeFetch(giftsUrl("/auth"), {
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

    const res = await nativeFetch(giftsUrl("/auth"), {
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

    const state = authStateFromHost();
    if (state === false) {
      return json({ error: "Сеанс gifts.ru не активен. Войдите в gifts.ru." }, 401);
    }

    const host = hostDocument();
    if (host) {
      for (const order of parseBasketOrders(host.documentElement?.outerHTML || "")) {
        found.set(order.number, order);
      }
    }

    const candidates = basketCandidatePaths();

    for (const path of candidates) {
      try {
        const { html } = await getHtml(path);
        for (const order of parseBasketOrders(html)) found.set(order.number, order);
      } catch {}
      if (found.size >= 30) break;
    }

    if (!found.size) {
      for (const path of candidates) {
        const rendered = await readRenderedOrders(path);
        for (const order of rendered) found.set(order.number, order);
        if (found.size >= 30) break;
      }
    }

    const rawOrders = [...found.values()].slice(0, 30);
    const verified = [];
    let cursor = 0;

    async function verifyNext() {
      while (cursor < rawOrders.length) {
        const candidate = rawOrders[cursor++];
        try {
          const parsed = await getOrder(String(candidate.number));
          if (Array.isArray(parsed.items) && parsed.items.length) {
            verified.push(candidate);
          }
        } catch {}
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(3, rawOrders.length) }, () => verifyNext())
    );

    verified.sort((a, b) => rawOrders.findIndex(x => x.number === a.number) - rawOrders.findIndex(x => x.number === b.number));

    return json({
      orders: verified,
      direct: true,
      scanned: candidates,
      candidates: rawOrders.length,
      verified: verified.length
    });
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
        giftsUrl("/drawing?action=getOrderItemPdf&orderitemid=" + encodeURIComponent(itemId)),
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
      if (!item) return json({ error: "Артикул заказа не найден." }, 404);

      const imageUrl = await resolveItemImage(item);
      if (!imageUrl) return json({ error: "Превью не найдено ни в заказе, ни в карточке товара." }, 404);

      const res = await nativeFetch(imageUrl, {
        credentials: "include",
        cache: "no-store",
        headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" }
      });
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!res.ok || !/^image\//i.test(contentType)) return json({ error: "Превью недоступно." }, 502);

      return new Response(await res.arrayBuffer(), {
        status: 200,
        headers: {
          "content-type": contentType,
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
      const url = new URL(raw, document.baseURI || (GIFTS_ORIGIN + "/"));
      const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (url.origin === GIFTS_ORIGIN && url.pathname.startsWith("/api/")) {
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