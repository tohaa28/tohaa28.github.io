export type OrderApplication = {
  id: string;
  orderItemId?: string;
  method: string;
  place: string;
  placeSource: "order-dom" | "control" | "labeled-field" | "fallback";
  templates: { name: string; url: string }[];
};

export type OrderItem = {
  id: string;
  orderItemId?: string;
  article: string;
  name: string;
  quantity: number | null;
  color?: string;
  imageUrl?: string;
  applications: OrderApplication[];
};

export type ParsedOrder = {
  number: string;
  title: string;
  items: OrderItem[];
  diagnostics: string[];
};

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();
const absolute = (href: string) => new URL(href, "https://gifts.ru").toString();
const articleRe = /(?:арт(?:икул)?\.?\s*)?([0-9]{4,6}(?:\.[0-9]{1,3})?)/i;
const methodRe = /(?:DTF|DTG|шелк|тампо|грав|УФ|UV|сублим|вышив|тиснен|деколь|лазер|флекс|трансфер|наклей|сборк|креплен|печать)/i;
const placeWordRe = /(?:лицо|оборот|спереди|сзади|слева|справа|сторон[аы]|клапан|крышк|дно|ручк|карман|рукав|груд|спин|капюшон|чехол|шов|клин|купол|горловин|этикет|бирк|упаковк|бок|периметр|основан)/i;
const badPlaceRe = /(?:скачать|шаблон|конструктор|pdf|cdr|макет|тираж|артикул|файл)/i;

function extractOrderItemId(root: Element) {
  let node: Element | null = root;
  for (let i = 0; node && i < 8; i++, node = node.parentElement) {
    for (const attr of ["data-orderitemid","data-order-item-id","data-orderitem-id","data-itemid","data-item-id"]) {
      const v = clean(node.getAttribute(attr));
      if (/^\d+$/.test(v)) return v;
    }
    for (const a of Array.from(node.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/[?&](?:orderitemid|order_item_id|itemid|id)=(\d+)/i);
      if (m) return m[1];
    }
  }
  return undefined;
}

function nearestItemContainer(el: Element) {
  let node: Element | null = el;
  let fallback = el.parentElement || el;
  for (let i = 0; node && i < 10; i++, node = node.parentElement) {
    const txt = clean(node.textContent);
    if (txt.length > 30 && txt.length < 7000 && articleRe.test(txt)) {
      fallback = node;
      if (/тираж|\bшт\.?\b|нанес|orderitem/i.test(txt + " " + String(node.className))) return node;
    }
  }
  return fallback;
}

function getArticleInfo(el: Element) {
  const root = nearestItemContainer(el);
  const txt = clean(root.textContent);
  const article = txt.match(/арт\.?\s*([0-9]{4,6}(?:\.[0-9]{1,3})?)/i)?.[1] || txt.match(articleRe)?.[1];
  if (!article) return null;
  const qty = Number((txt.match(/(\d[\d\s]*)\s*шт\.?/i)?.[1] || "").replace(/\D/g, "")) || null;
  const productLink = Array.from(root.querySelectorAll('a[href*="/id/"]')).map(a => clean(a.textContent)).find(x => x && !/^\d+$/.test(x) && x.length < 220);
  const heading = clean(root.querySelector("[class*='name'],[class*='title'],h2,h3,h4")?.textContent);
  const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  const img = imgs.find(x => (x.getAttribute("src") || x.getAttribute("data-src") || "").includes(article.split(".")[0])) || imgs[0];
  return {
    root,
    article,
    quantity: qty,
    name: productLink || heading || "Артикул " + article,
    orderItemId: extractOrderItemId(root),
    imageUrl: img ? absolute(img.getAttribute("src") || img.getAttribute("data-src") || "") : undefined,
  };
}

function exactPlaceNear(link: Element) {
  let node: Element | null = link.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    for (const select of Array.from(node.querySelectorAll("select"))) {
      const attrs = [select.getAttribute("name"), select.id, String(select.className)].join(" ");
      const ctx = clean(select.parentElement?.textContent);
      if (!/место|сторон|поле|поверхност|place|position|side|field|location/i.test(ctx + " " + attrs)) continue;
      const opt = Array.from((select as HTMLSelectElement).options).find(o => o.selected) || (select as HTMLSelectElement).options[(select as HTMLSelectElement).selectedIndex];
      const value = clean(opt?.textContent || opt?.value);
      if (value && !badPlaceRe.test(value)) return { value, source: "control" as const };
    }

    const parts = Array.from(node.querySelectorAll("div.size--sm.flex.flex-center.flex-column > div"))
      .map(x => clean(x.textContent))
      .filter(x => x && x.length < 160 && !badPlaceRe.test(x));
    const explicit = parts.find(x => placeWordRe.test(x) && !methodRe.test(x));
    if (explicit) return { value: explicit, source: "order-dom" as const };

    const labeled = Array.from(node.querySelectorAll("[data-label],label,dt,th"))
      .find(x => /место\s*нанесения|поле\s*нанесения|сторона|поверхность/i.test(clean(x.textContent)));
    if (labeled) {
      const value = clean(labeled.nextElementSibling?.textContent || "");
      if (value && !badPlaceRe.test(value)) return { value, source: "labeled-field" as const };
    }
  }
  return { value: null, source: "fallback" as const };
}

function methodNear(link: Element) {
  let node: Element | null = link.parentElement;
  for (let depth = 0; node && depth < 9; depth++, node = node.parentElement) {
    const texts = Array.from(node.querySelectorAll("g-drop,.size--sm,[class*='method'],[class*='print']"))
      .map(x => clean(x.textContent)).filter(Boolean);
    const hit = texts.find(x => methodRe.test(x) && x.length < 180);
    if (hit) return hit;
  }
  const text = clean(nearestItemContainer(link).textContent);
  const m = text.match(/((?:DTF|DTG|УФ|UV|лазер|тампо|грав|печать)[^|;]{0,90})/i);
  return clean(m?.[1]) || "Нанесение";
}

export function parseOrderHtml(html: string, number: string): ParsedOrder {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const byArticle = new Map<string, OrderItem>();
  const diagnostics: string[] = [];

  const seeds = Array.from(doc.querySelectorAll('a[href*="/id/"],[data-orderitemid],[data-itemid]'));
  for (const seed of seeds) {
    const info = getArticleInfo(seed);
    if (!info || byArticle.has(info.article)) continue;
    byArticle.set(info.article, {
      id: info.orderItemId || info.article,
      orderItemId: info.orderItemId,
      article: info.article,
      name: info.name,
      quantity: info.quantity,
      imageUrl: info.imageUrl,
      applications: []
    });
  }
  diagnostics.push("Позиций, найденных в заказе: " + byArticle.size);

  const links = Array.from(doc.querySelectorAll(
    'a[href*="/private/order/act/amda/"],a[href*="action=getOrderItemPdf"],a[href*="/reviewer/constructor/"],a[href*="/cart/act/mda"]'
  ));
  diagnostics.push("Ссылок макетов/шаблонов: " + links.length);

  links.forEach((link, index) => {
    const info = getArticleInfo(link);
    const rootText = clean(nearestItemContainer(link).textContent);
    const article = info?.article || rootText.match(articleRe)?.[1];
    if (!article) return;
    let item = byArticle.get(article);
    if (!item) {
      item = { id: info?.orderItemId || article, orderItemId: info?.orderItemId, article, name: info?.name || "Артикул " + article, quantity: info?.quantity || null, imageUrl: info?.imageUrl, applications: [] };
      byArticle.set(article, item);
    }
    const placeResult = exactPlaceNear(link);
    const method = methodNear(link);
    const place = placeResult.value || "место не определено";
    let app = item.applications.find(a => a.place === place && (a.method === method || a.method === "Нанесение"));
    if (!app) {
      app = {
        id: (item.orderItemId || item.article) + "::" + method + "::" + place + "::" + index,
        orderItemId: item.orderItemId,
        method,
        place,
        placeSource: placeResult.value ? placeResult.source : "fallback",
        templates: []
      };
      item.applications.push(app);
    }
    const href = link.getAttribute("href") || "";
    const template = { name: clean(link.textContent) || href.split("/").pop() || "Файл", url: absolute(href) };
    if (!app.templates.some(t => t.url === template.url)) app.templates.push(template);
  });

  const items = [...byArticle.values()].filter(i => i.applications.length || i.orderItemId);
  const exact = items.flatMap(i => i.applications).filter(a => a.placeSource !== "fallback").length;
  diagnostics.push("Мест с точной подписью заказа: " + exact);
  diagnostics.push("Мест без точной подписи: " + (items.flatMap(i => i.applications).length - exact));
  const title = clean(doc.querySelector("h1,[class*='order-title']")?.textContent) || "Заказ " + number;
  return { number, title, items, diagnostics };
}
