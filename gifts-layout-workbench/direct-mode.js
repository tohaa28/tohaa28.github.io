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
    const found = new Map();

    for (const a of doc.querySelectorAll("a[href]")) {
      try {
        const url = new URL(a.getAttribute("href") || "", GIFTS_ORIGIN + "/");
        if (url.origin !== GIFTS_ORIGIN) continue;
        const match = url.pathname.match(/^\/private\/order\/(\d{5,12})(?:\/|$)/i);
        if (match && !found.has(match[1])) found.set(match[1], { number: match[1] });
      } catch {}
    }

    return [...found.values()];
  }

  function hostDocument() {
    try {
      if (parent !== window && parent.location.origin === GIFTS_ORIGIN) return parent.document;
    } catch {}
    return null;
  }

  function basketLinksFromHtml(html) {
    const paths = new Set();
    const doc = new DOMParser().parseFromString(html || "", "text/html");

    const addUrl = raw => {
      if (!raw) return;
      try {
        const url = new URL(raw, GIFTS_ORIGIN + "/");
        if (url.origin !== GIFTS_ORIGIN) return;
        const probe = (url.pathname + url.search).toLowerCase();
        if (/logout|delete|remove|checkout|submit|confirm|action=|\/act\//.test(probe)) return;
        if (/cart|basket/.test(probe)) paths.add(url.pathname + url.search);
      } catch {}
    };

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
      if (/корзин|cart|basket/i.test(label + " " + raw)) addUrl(raw);
    }

    return [...paths];
  }

  async function readBasketFromSite() {
    const scanned = [];

    for (const path of ["/private/orders/basket", "/private/orders/basket/"]) {
      try {
        const { html } = await getHtml(path);
        scanned.push(path);
        const orders = parseBasketOrders(html);
        return {
          found: new Map(orders.map(order => [order.number, order])),
          scanned,
          source: "private-orders-basket"
        };
      } catch (error) {
        if (error?.code === "AUTH") throw error;
      }
    }

    return {
      found: new Map(),
      scanned,
      source: "private-orders-basket-not-found"
    };
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

  function imageMatchesArticle(url, article) {
    try {
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "").toLowerCase();
      const full = clean(article).toLowerCase();
      const base = full.split(".")[0];
      return !!full && (name.startsWith(full + "_") || name.startsWith(full + ".") ||
        name.startsWith(base + "_") || name.startsWith(base + "."));
    } catch {
      return false;
    }
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
    const candidates = imageUrlCandidates(doc, article); return candidates.find(url => imageMatchesArticle(url, article)) || candidates[0] || "";
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

  function normalizeOrderPlace(raw, article) {
    const bad = /(?:скачать|шаблон|конструктор|pdf|cdr|макет|тираж|артикул|файл)/i;
    const methodWord = /(?:DTF|DTG|шелк|тампо|грав|УФ|UV|сублим|вышив|тиснен|деколь|лазер|флекс|трансфер|печать)/i;
    let value = removeArticlePrefix(raw, article);
    value = clean(value)
      .replace(/^место\s+нанесения\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "")
      .replace(/^место\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "")
      .replace(/^поле\s+нанесения\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "")
      .replace(/^поле\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "")
      .replace(/^поверхность\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "")
      .replace(/^сторона\s*(?:№|#)?\s*\d{0,2}\s*[:—-]?\s*/i, "");
    if (!value || value.length > 180 || bad.test(value) || methodWord.test(value)) return "";
    return value;
  }

  function placeKey(value) {
    return clean(value)
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function selectedApplicationId(raw) {
    const text = clean(raw);
    const match = text.match(/(?:,|\()\s*(\d{1,20})\s*\)?\s*$/);
    return match ? match[1] : "";
  }

  function printIdForApplication(id) {
    return /^\d{1,20}$/.test(String(id || "")) ? "print" + String(Number(id)) : "";
  }

  function extractOrderApplicationBindings(root, article) {
    const methodNodes = [...root.querySelectorAll(".cart-tbl-imp g-droper > span")];
    const placeNodes = [...root.querySelectorAll(".cart-tbl-imp .flex-center.flex-column > .color-text")];
    const bindings = [];

    const localPlaceFor = methodNode => {
      let container = methodNode.parentElement;
      while (container && container !== root) {
        const methods = container.querySelectorAll?.("g-droper > span") || [];
        const places = container.querySelectorAll?.(".flex-center.flex-column > .color-text") || [];
        if (methods.length === 1 && places.length === 1) return places[0];
        container = container.parentElement;
      }
      return null;
    };

    methodNodes.forEach((methodNode, index) => {
      const rawMethod = clean(methodNode.textContent || "");
      const taskId = selectedApplicationId(rawMethod);
      let placeNode = localPlaceFor(methodNode);
      if (!placeNode && methodNodes.length === placeNodes.length) placeNode = placeNodes[index];
      const name = normalizeOrderPlace(placeNode?.textContent || "", article);
      if (!name) return;
      bindings.push({
        name,
        taskId,
        printId: printIdForApplication(taskId),
        index: /^\d+$/.test(taskId) ? Number(taskId) : null,
        method: rawMethod,
        source: "order-application-row"
      });
    });

    return bindings;
  }

  function popupApplicationIdsFromContext(context) {
    if (!context) return [];
    let text = "";
    const row = context.closest?.("tr");
    const table = row?.closest?.("table");
    if (row && table) {
      const headerRow = table.querySelector("thead tr") || [...table.querySelectorAll("tr")].find(candidate => candidate.querySelector("th"));
      const headers = headerRow ? [...headerRow.children] : [];
      const cells = [...row.children];
      for (let index = 0; index < headers.length; index++) {
        const label = clean(headers[index].textContent);
        if (!/нанесени|application|print/i.test(label) || /макет|template/i.test(label)) continue;
        text += " " + clean(cells[index]?.textContent || "");
      }
    }
    if (!text.trim()) text = clean(context.textContent || "");
    const ids = [...text.matchAll(/\((\d{1,20})\)/g)].map(match => match[1]);
    return [...new Set(ids)];
  }

  function explicitPlaceIndex(raw) {
    const text = clean(raw);
    const match = text.match(/(?:место(?:\s+нанесения)?|поле(?:\s+нанесения)?|позиция|place|field)\s*(?:№|#)?\s*(\d{1,2})\b/i);
    const value = match ? Number(match[1]) : 0;
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function makePlaceBindings(entries, article, source) {
    const bindings = [];
    const seen = new Set();
    for (const entry of entries) {
      const raw = typeof entry === "string" ? entry : entry?.raw;
      const index = typeof entry === "object" && Number.isInteger(entry?.index)
        ? entry.index
        : explicitPlaceIndex(raw);
      const name = normalizeOrderPlace(raw, article);
      if (!name) continue;
      const key = `${index || ""}|${placeKey(name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bindings.push({ name, index, source });
    }
    return bindings;
  }

  function placeAuditFromBindings(bindings, source, reliable, signals) {
    return {
      places: bindings.map(binding => binding.name),
      placeBindings: bindings,
      source,
      reliable,
      signals
    };
  }

  function extractPlaceAudit(root, article) {
    const placeWord = /(?:лицо|оборот|спереди|сзади|слева|справа|верх|низ|внутр|наруж|торец|сторон[аы]|клапан|крышк|дно|ручк|карман|рукав|груд|спин|капюшон|чехол|шов|клин|купол|горловин|этикет|бирк|упаковк|бок|периметр|основан|поле|центр)/i;

    const fromNodes = (nodes, source) => makePlaceBindings(
      [...nodes].map(node => ({ raw: node.textContent || node.value || "", index: explicitPlaceIndex(node.textContent || node.value || "") })),
      article,
      source
    );

    // Authoritative place rows on the order page. These selectors already mean
    // "selected application place", so do not reject an unfamiliar place name.
    const orderRows = fromNodes(
      root.querySelectorAll(".cart-tbl-imp .flex-center.flex-column > .color-text"),
      "order-place-row"
    );
    if (orderRows.length) {
      return placeAuditFromBindings(
        orderRows,
        "order-place-row",
        true,
        { orderRows: orderRows.length, selectedControls: 0, labelledValues: 0, attributes: 0 }
      );
    }

    // Alternative rendered order layout used on some gifts.ru pages.
    const renderedRows = fromNodes(
      root.querySelectorAll("div.size--sm.flex.flex-center.flex-column > div"),
      "rendered-place-row"
    );
    if (renderedRows.length) {
      return placeAuditFromBindings(
        renderedRows,
        "rendered-place-row",
        true,
        { orderRows: renderedRows.length, selectedControls: 0, labelledValues: 0, attributes: 0 }
      );
    }

    const selectedEntries = [];
    for (const select of root.querySelectorAll("select")) {
      const attrs = [
        select.getAttribute("name"),
        select.id,
        String(select.className),
        select.parentElement?.textContent
      ].filter(Boolean).join(" ");
      if (!/место|сторон|поле|поверхност|place|position|side|field|location/i.test(attrs)) continue;
      const option = [...select.options].find(o => o.selected) || select.options[select.selectedIndex];
      if (option) selectedEntries.push({ raw: option.textContent || option.value || "", index: explicitPlaceIndex(option.textContent || option.value || "") });
    }
    const selected = makePlaceBindings(selectedEntries, article, "selected-place-control");
    if (selected.length) {
      return placeAuditFromBindings(
        selected,
        "selected-place-control",
        true,
        { orderRows: 0, selectedControls: selected.length, labelledValues: 0, attributes: 0 }
      );
    }

    const labelledEntries = [];
    for (const label of root.querySelectorAll("[data-label],label,dt,th")) {
      const labelText = clean(label.textContent);
      if (!/место\s*нанесения|поле\s*нанесения|сторона|поверхность|place|position|side|field|location/i.test(labelText)) continue;
      const valueNode = label.nextElementSibling;
      if (!valueNode) continue;
      labelledEntries.push({
        raw: valueNode.textContent || "",
        index: explicitPlaceIndex(labelText) || explicitPlaceIndex(valueNode.textContent || "")
      });
    }
    const labelled = makePlaceBindings(labelledEntries, article, "labelled-place-value");
    if (labelled.length) {
      return placeAuditFromBindings(
        labelled,
        "labelled-place-value",
        true,
        { orderRows: 0, selectedControls: 0, labelledValues: labelled.length, attributes: 0 }
      );
    }

    // Attribute scanning is only a last-resort hint.
    const attrEntries = [];
    for (const node of root.querySelectorAll("*")) {
      for (const attr of [...node.attributes]) {
        if (!/place|position|side|field|location|место|сторон|поле|поверхност/i.test(attr.name)) continue;
        const value = normalizeOrderPlace(attr.value, article);
        if (value && placeWord.test(value)) {
          attrEntries.push({ raw: attr.value, index: explicitPlaceIndex(attr.value) });
        }
      }
    }
    const attrs = makePlaceBindings(attrEntries, article, "place-attribute-fallback");
    return placeAuditFromBindings(
      attrs,
      attrs.length ? "place-attribute-fallback" : "not-found",
      false,
      { orderRows: 0, selectedControls: 0, labelledValues: 0, attributes: attrs.length }
    );
  }

  function getOrderInternalId(doc) {
    const nodes = [
      doc.querySelector("#j_cart_host[data-orderid]"),
      doc.querySelector(".cart-order[data-orderid]"),
      doc.querySelector(".j_add_maket[data-orderid]")
    ];

    for (const node of nodes) {
      const value = clean(node?.getAttribute("data-orderid"));
      if (/^\d{1,20}$/.test(value)) return value;
    }
    return "";
  }

  function popupArticleHint(text) {
    const value = clean(text);
    const match = value.match(/(?:артикул|арт\.?)[\s:№#-]*([\p{L}\p{N}][\p{L}\p{N}._\/-]*)/iu);
    return clean(match?.[1] || "");
  }

  function articleKey(value) {
    return clean(value).replace(/^артикул\s*/i, "").replace(/\s+/g, "").toLocaleLowerCase("ru-RU");
  }

  function popupArticleFromContext(context) {
    if (!context) return "";
    const attr = clean(
      context.getAttribute?.("data-article") ||
      context.getAttribute?.("data-articul") ||
      ""
    );
    if (attr) return attr;

    const candidates = context.querySelectorAll?.(
      "[data-article],[data-articul],.cart-tbl-name,.article,.articul,td,th,span,strong"
    ) || [];
    for (const node of candidates) {
      const directAttr = clean(
        node.getAttribute?.("data-article") ||
        node.getAttribute?.("data-articul") ||
        ""
      );
      if (directAttr) return directAttr;
      const hint = popupArticleHint(node.textContent || "");
      if (hint) return hint;
    }
    return popupArticleHint(context.textContent || "");
  }


  function escapeRegExp(value) {
    const specials = "\\^$.*+?()[]{}|";
    return [...String(value)].map(char => specials.includes(char) ? "\\" + char : char).join("");
  }

  function contextHasArticle(contextText, article) {
    const haystack = clean(contextText);
    const needle = clean(article);
    if (!haystack || !needle) return false;
    try {
      return new RegExp("(^|[^\\p{L}\\p{N}._\\/-])" + escapeRegExp(needle) + "(?=$|[^\\p{L}\\p{N}._\\/-])", "iu").test(haystack);
    } catch {
      return haystack.includes(needle);
    }
  }

  function popupPlaceBindingsFromContext(context, article) {
    if (!context) return [];
    const entries = [];
    const add = (raw, index = null) => {
      const text = clean(raw);
      if (!text) return;
      entries.push({ raw: text, index: Number.isInteger(index) ? index : explicitPlaceIndex(text) });
    };

    // Most reliable case: a table column explicitly named "Место нанесения",
    // "Поле", "Сторона" etc. Read the cell in the same template row.
    const row = context.closest?.("tr");
    const table = row?.closest?.("table");
    if (row && table) {
      const headerRow = table.querySelector("thead tr") || [...table.querySelectorAll("tr")].find(candidate => candidate.querySelector("th"));
      const headers = headerRow ? [...headerRow.children] : [];
      const cells = [...row.children];
      headers.forEach((header, index) => {
        const label = clean(header.textContent);
        if (!/место(?:\s+нанесения)?|поле(?:\s+нанесения)?|сторона|поверхность|place|position|side|field|location/i.test(label)) return;
        const cell = cells[index];
        if (cell) add(cell.textContent, explicitPlaceIndex(label) || explicitPlaceIndex(cell.textContent || ""));
      });
    }

    // Explicitly labelled value pairs in non-table popup layouts.
    for (const label of context.querySelectorAll?.("[data-label],label,dt,th,.label") || []) {
      const labelText = clean(label.textContent);
      if (!/место(?:\s+нанесения)?|поле(?:\s+нанесения)?|сторона|поверхность|place|position|side|field|location/i.test(labelText)) continue;
      const value = label.nextElementSibling;
      if (value) add(value.textContent, explicitPlaceIndex(labelText) || explicitPlaceIndex(value.textContent || ""));
    }

    // Dedicated attributes/classes are also authoritative because they encode
    // the semantic role of the value, not a guessed word from arbitrary text.
    for (const node of context.querySelectorAll?.(
      "[data-place],[data-position],[data-side],[data-field],[data-location],[class*='place'],[class*='position'],[class*='side'],[class*='field'],[class*='location']"
    ) || []) {
      const attrValue =
        node.getAttribute?.("data-place") ||
        node.getAttribute?.("data-position") ||
        node.getAttribute?.("data-side") ||
        node.getAttribute?.("data-field") ||
        node.getAttribute?.("data-location");
      add(attrValue || node.textContent || "", explicitPlaceIndex(node.textContent || "") || explicitPlaceIndex(attrValue || ""));
    }

    // Some popup versions render "Место нанесения: ..." as plain text in a
    // small leaf element. Restrict this fallback to explicit place prefixes.
    for (const node of context.querySelectorAll?.("td,li,div,span,p,strong") || []) {
      const text = clean(node.textContent);
      if (!text || text.length > 220) continue;
      if (!/^(?:место(?:\s+нанесения)?|поле(?:\s+нанесения)?|сторона|поверхность)\b/i.test(text)) continue;
      add(text);
    }

    return makePlaceBindings(entries, article, "makets-popup-place");
  }

  function popupMethodFromContext(context) {
    if (!context) return "";
    const row = context.closest?.("tr");
    const table = row?.closest?.("table");
    if (row && table) {
      const headerRow = table.querySelector("thead tr") || [...table.querySelectorAll("tr")].find(candidate => candidate.querySelector("th"));
      const headers = headerRow ? [...headerRow.children] : [];
      const cells = [...row.children];
      for (let index = 0; index < headers.length; index++) {
        const label = clean(headers[index].textContent);
        if (!/(?:^|\s)(?:вид\s+)?нанесени|способ\s+печати|метод(?:\s+нанесения)?/i.test(label) || /место/i.test(label)) continue;
        const value = clean(cells[index]?.textContent || "");
        if (value) return value;
      }
    }
    const node = context.querySelector?.("[data-method],[data-print-method],.method,.printing-method");
    return clean(
      node?.getAttribute?.("data-method") ||
      node?.getAttribute?.("data-print-method") ||
      node?.textContent ||
      ""
    );
  }

  async function getPopupTemplateRelations(orderId) {
    if (!/^\d{1,20}$/.test(String(orderId || ""))) return [];

    const res = await nativeFetch(
      giftsUrl("/ajax/gifts/order?action=makets_popup&oid=" + encodeURIComponent(orderId)),
      {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        cache: "no-store",
        headers: {
          "accept": "application/json,text/html;q=0.9,*/*;q=0.8",
          "x-requested-with": "XMLHttpRequest"
        }
      }
    );

    const raw = await res.text();
    if (isAuthPage(raw, res.url)) {
      const error = new Error("Сеанс gifts.ru не активен. Войдите в gifts.ru.");
      error.code = "AUTH";
      throw error;
    }
    if (!res.ok) throw new Error("gifts.ru не вернул раздел «Макеты для заказа».");

    let html = raw;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data.html === "string") html = data.html;
    } catch {}

    const doc = new DOMParser().parseFromString(html, "text/html");
    const relations = [];
    const seen = new Set();

    for (const node of doc.querySelectorAll("a[href*=\'getOrderItemPdf\'],[data-orderitemid],[data-oiid]")) {
      let pdfItemId = clean(node.getAttribute("data-orderitemid") || node.getAttribute("data-oiid"));
      if (!pdfItemId) {
        try {
          const url = new URL(node.getAttribute("href") || "", GIFTS_ORIGIN + "/");
          pdfItemId = clean(url.searchParams.get("orderitemid") || url.searchParams.get("oiid"));
        } catch {}
      }
      if (!/^\d{1,20}$/.test(pdfItemId) || seen.has(pdfItemId)) continue;
      seen.add(pdfItemId);

      const context = node.closest("tr,li,[data-itemid],.cart-tbl-row,.maket-row,.template-row") || node.parentElement;
      const contextText = clean(context?.textContent || node.textContent || "");
      const article = popupArticleFromContext(context);
      const placeBindings = popupPlaceBindingsFromContext(context, article);
      const places = placeBindings.map(binding => binding.name);
      const method = popupMethodFromContext(context);
      const applicationIds = popupApplicationIdsFromContext(context);

      relations.push({
        pdfItemId,
        article,
        method,
        places,
        placeBindings,
        applicationIds,
        placeSource: places.length ? "makets-popup-place" : "not-found",
        contextText
      });
    }

    return relations;
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
      const drawTaskIds = drawTaskRaw ? drawTaskRaw.split(/[\s,;]+/).filter(Boolean) : [];
      const placeAudit = extractPlaceAudit(root, article);
      const applicationBindings = extractOrderApplicationBindings(root, article);
      if (applicationBindings.length) {
        const byName = new Map(applicationBindings.map(binding => [placeKey(binding.name), binding]));
        placeAudit.placeBindings = (placeAudit.placeBindings || []).map(binding => {
          const application = byName.get(placeKey(binding.name));
          return application ? {...binding, ...application} : binding;
        });
      }
      const places = placeAudit.places;

      if (!/^\d+$/.test(itemId) || !article || !method ||
          !Number.isSafeInteger(quantity) || quantity < 1) continue;

      const imageUrl = imageUrlCandidates(root, article).find(url => imageMatchesArticle(url, article)) || "";
      const productUrl = productUrlFromItem(root);

      items.push({
        itemId,
        article,
        product,
        quantity,
        method,
        place: places.join(", "),
        places,
        placeBindings: placeAudit.placeBindings || [],
        applicationBindings,
        placeCount: places.length,
        placeCountSource: placeAudit.source,
        placeCountReliable: placeAudit.reliable,
        placeCountSignals: {
          ...placeAudit.signals,
          drawTasks: drawTaskIds.length,
          methods: root.querySelectorAll(".cart-tbl-imp g-droper > span").length
        },
        drawTaskIds,
        imageUrl,
        productUrl,
        requirements: clean(root.textContent).slice(0, 5000),
        source: "order-dom"
      });
    }

    const articleSummary = {};
    for (const item of items) {
      const key = item.article;
      if (!articleSummary[key]) articleSummary[key] = { article: key, itemCount: 0, placeCount: 0, itemIds: [] };
      articleSummary[key].itemCount++;
      articleSummary[key].placeCount += item.placeCount || 0;
      articleSummary[key].itemIds.push(item.itemId);
    }
    for (const item of items) {
      item.articlePlaceCount = articleSummary[item.article]?.placeCount || item.placeCount || 0;
      item.articleItemCount = articleSummary[item.article]?.itemCount || 1;
    }

    return { order: String(order), orderInternalId: getOrderInternalId(doc), items, articlePlaceSummary: Object.values(articleSummary) };
  }

  async function getOrder(order, fresh = false) {
    if (!fresh && orderCache.has(order)) return orderCache.get(order);
    const { html } = await getHtml("/private/order/" + order);
    const parsed = parseOrder(html, order);

    // Preserve the complete order composition separately from the subset that has
    // an application-template. Basket/order UI needs every real item; the editor
    // must only attempt PDF download for template-linked items.
    const orderItems = parsed.items;
    let templateItemIds = null;

    if (parsed.orderInternalId) {
      try {
        const relations = await getPopupTemplateRelations(parsed.orderInternalId);
        parsed.maketsPopupLoaded = true;
        parsed.popupTemplateRelations = relations;
        parsed.popupOrderItemIds = relations.map(relation => relation.pdfItemId);

        if (relations.length) {
          const claimed = new Set();
          const assign = (item, relation, source) => {
            item.hasTemplate = true;
            item.pdfItemId = String(relation.pdfItemId);
            item.templateRelationSource = source;
            item.templateRelationArticle = relation.article || "";
            item.templateRelationMethod = relation.method || "";
            item.templatePlaces = Array.isArray(relation.places) ? [...relation.places] : [];
            item.templatePlaceBindings = Array.isArray(relation.placeBindings)
              ? relation.placeBindings.map(binding => ({...binding}))
              : [];
            item.templateApplicationIds = Array.isArray(relation.applicationIds)
              ? [...relation.applicationIds]
              : [];

            if (!Array.isArray(item.placeBindings)) item.placeBindings = [];
            if (!Array.isArray(item.applicationBindings)) item.applicationBindings = [];

            // Strongest mapping visible on the real Gifts pages:
            // order row ",N" -> template popup "(N)" -> PDF [printN].
            if (item.templateApplicationIds.length && item.applicationBindings.length) {
              const matched = item.templateApplicationIds
                .map(id => item.applicationBindings.find(binding => String(binding.taskId) === String(id)))
                .filter(Boolean);
              const unique = [...new Map(matched.map(binding => [placeKey(binding.name), binding])).values()];
              if (unique.length === item.templateApplicationIds.length) {
                item.places = unique.map(binding => binding.name);
                item.place = item.places.join(", ");
                item.placeBindings = unique.map(binding => ({
                  ...binding,
                  index: Number.isInteger(binding.index) ? binding.index : (/^\d+$/.test(binding.taskId) ? Number(binding.taskId) : null),
                  printId: binding.printId || printIdForApplication(binding.taskId),
                  source: "order-application-id+makets-popup"
                }));
                item.placeCount = item.places.length;
                item.placeCountSource = "order-application-id";
                item.placeCountReliable = true;
                item.templatePlacesMatch = true;
              }
            }

            // The order page owns the place name. The popup may add an explicit
            // field number for the same name, which is useful for numeric PDF labels.
            if (item.places?.length) {
              item.placeBindings = item.places.map(name => {
                const existing = item.placeBindings.find(binding => placeKey(binding.name) === placeKey(name));
                const popup = item.templatePlaceBindings.find(binding => placeKey(binding.name) === placeKey(name));
                return {
                  name,
                  taskId: existing?.taskId || "",
                  printId: existing?.printId || "",
                  index: existing?.index || popup?.index || null,
                  method: existing?.method || "",
                  source: existing?.source || (popup ? "order+makets-popup" : item.placeCountSource)
                };
              });

              if (item.templatePlaces.length) {
                const orderKeys = new Set(item.places.map(placeKey));
                const templateKeys = new Set(item.templatePlaces.map(placeKey));
                item.templatePlacesMatch =
                  orderKeys.size === templateKeys.size &&
                  [...orderKeys].every(key => templateKeys.has(key));
              }
            } else if (item.templatePlaces.length) {
              // Some order layouts hide the selected place in the item row, while
              // "Макеты для заказа" prints it next to the PDF link. Use that exact
              // value instead of inventing "Место 1/2".
              item.places = [...item.templatePlaces];
              item.place = item.places.join(", ");
              item.placeBindings = item.templatePlaceBindings.map(binding => ({...binding}));
              item.placeCount = item.places.length;
              item.placeCountSource = "makets-popup-place";
              item.placeCountReliable = true;
              item.templatePlacesMatch = true;
            }

            claimed.add(String(relation.pdfItemId));
          };

          // Strongest relation: order row id exactly equals PDF orderitemid.
          for (const item of orderItems) {
            const exact = relations.filter(relation =>
              !claimed.has(String(relation.pdfItemId)) &&
              String(relation.pdfItemId) === String(item.itemId)
            );
            if (exact.length === 1) assign(item, exact[0], "makets-popup-orderitemid");
          }

          // If Gifts uses a different PDF id, use the article printed in that popup
          // row only when both the order article and popup relation are unique.
          for (const item of orderItems) {
            if (item.hasTemplate) continue;
            const sameArticleItems = orderItems.filter(other => articleKey(other.article) === articleKey(item.article));
            const candidates = relations.filter(relation =>
              !claimed.has(String(relation.pdfItemId)) &&
              (
                (relation.article && articleKey(relation.article) === articleKey(item.article)) ||
                contextHasArticle(relation.contextText, item.article)
              )
            );

            const itemPlaceKeys = new Set((item.places || []).map(placeKey));
            const placeMatched = itemPlaceKeys.size
              ? candidates.filter(relation => {
                  const relationKeys = new Set((relation.places || []).map(placeKey));
                  return relationKeys.size &&
                    [...itemPlaceKeys].every(key => relationKeys.has(key));
                })
              : [];
            const itemApplicationIds = new Set(
              (item.applicationBindings || []).map(binding => String(binding.taskId || "")).filter(Boolean)
            );
            const applicationMatched = itemApplicationIds.size
              ? candidates.filter(relation => {
                  const ids = Array.isArray(relation.applicationIds) ? relation.applicationIds : [];
                  return ids.length && ids.every(id => itemApplicationIds.has(String(id)));
                })
              : [];
            const resolvedCandidates =
              applicationMatched.length === 1 ? applicationMatched :
              placeMatched.length === 1 ? placeMatched :
              candidates;

            if ((sameArticleItems.length === 1 || placeMatched.length === 1 || applicationMatched.length === 1) && resolvedCandidates.length === 1) {
              assign(
                item,
                resolvedCandidates[0],
                applicationMatched.length === 1
                  ? "makets-popup-article-application"
                  : placeMatched.length === 1
                    ? "makets-popup-article-place"
                    : "makets-popup-article"
              );
            } else {
              item.hasTemplate = false;
              item.templateRelationSource = candidates.length > 1 || sameArticleItems.length > 1
                ? "makets-popup-ambiguous"
                : "unassigned";
            }
          }
        } else {
          for (const item of orderItems) {
            item.hasTemplate = Boolean(item.drawTaskIds?.length);
            item.templateRelationSource = item.hasTemplate ? "drawtask-fallback" : "unassigned";
            if (item.hasTemplate) item.pdfItemId = String(item.itemId);
          }
        }
      } catch (error) {
        if (error?.code === "AUTH") throw error;
        parsed.maketsPopupLoaded = false;
        parsed.maketsPopupError = error?.message || String(error);
        for (const item of orderItems) {
          item.hasTemplate = Boolean(item.drawTaskIds?.length);
          item.templateRelationSource = item.hasTemplate ? "drawtask-fallback" : "unassigned";
          if (item.hasTemplate) item.pdfItemId = String(item.itemId);
        }
      }
    } else {
      parsed.maketsPopupLoaded = false;
      for (const item of orderItems) {
        item.hasTemplate = Boolean(item.drawTaskIds?.length);
        item.templateRelationSource = item.hasTemplate ? "drawtask-fallback" : "unassigned";
        if (item.hasTemplate) item.pdfItemId = String(item.itemId);
      }
    }

    parsed.orderItems = orderItems;
    parsed.items = orderItems.filter(item => item.hasTemplate);

    const summary = {};
    for (const item of parsed.items) {
      if (!summary[item.article]) {
        summary[item.article] = {
          article: item.article,
          itemCount: 0,
          placeCount: 0,
          itemIds: []
        };
      }
      summary[item.article].itemCount++;
      summary[item.article].placeCount += item.placeCount || 0;
      summary[item.article].itemIds.push(item.itemId);
    }

    parsed.articlePlaceSummary = Object.values(summary);
    for (const item of parsed.items) {
      item.articlePlaceCount = summary[item.article]?.placeCount || item.placeCount || 0;
      item.articleItemCount = summary[item.article]?.itemCount || 1;
    }

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
    // A basket refresh must reflect gifts.ru now, not the DOM/cache captured when the editor opened.
    orderCache.clear();

    try {
      const snapshot = await readBasketFromSite();
      const rawOrders = [...snapshot.found.values()].slice(0, 30);
      const verified = [];
      let cursor = 0;

      async function verifyNext() {
        while (cursor < rawOrders.length) {
          const candidate = rawOrders[cursor++];
          try {
            const parsed = await getOrder(String(candidate.number), true);
            if (Array.isArray(parsed.orderItems) && parsed.orderItems.length) {
              verified.push(candidate);
            }
          } catch (error) {
            if (error?.code === "AUTH") throw error;
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(3, rawOrders.length) }, () => verifyNext())
      );

      verified.sort((a, b) => rawOrders.findIndex(x => x.number === a.number) - rawOrders.findIndex(x => x.number === b.number));

      return json({
        orders: verified,
        direct: true,
        source: snapshot.source,
        refreshedFromSite: true,
        scanned: snapshot.scanned,
        candidates: rawOrders.length,
        verified: verified.length
      });
    } catch (error) {
      return json(
        { error: error?.message || String(error), refreshedFromSite: true },
        error?.code === "AUTH" ? 401 : 502
      );
    }
  }

  async function apiOrder(order) {
    if (!/^\d{5,12}$/.test(order)) {
      return json({ error: "Некорректный номер заказа." }, 400);
    }
    try {
      const parsed = await getOrder(order);
      if (!Array.isArray(parsed.orderItems) || !parsed.orderItems.length) {
        return json({ error: "В заказе не найдены позиции." }, 404);
      }
      parsed.templateCount = Array.isArray(parsed.items) ? parsed.items.length : 0;
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
      if (!parsed.items.some(item => String(item.pdfItemId || item.itemId) === String(itemId))) {
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