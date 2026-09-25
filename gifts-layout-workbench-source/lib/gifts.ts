const ORIGIN = "https://gifts.ru";

function cookieHeader(setCookies: string[]) {
  return setCookies.map(v => v.split(";")[0]).filter(Boolean).join("; ");
}

export async function giftsLogin(login: string, password: string, code = "") {
  const body = new URLSearchParams({
    login,
    password,
    code,
    redirect: "/",
    orderconf: ""
  });

  const res = await fetch(ORIGIN + "/auth", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0",
      "accept": "text/html,application/xhtml+xml"
    },
    body,
    redirect: "manual",
    cache: "no-store"
  });

  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = cookieHeader(setCookies);
  if (!cookie) throw new Error("gifts.ru не вернул сессионные cookie");

  const check = await giftsFetch("/", cookie);
  const html = await check.text();
  if (/data-hash="https:\/\/gifts\.ru\/auth"|>войти<\/span>/i.test(html)) {
    throw new Error("gifts.ru не подтвердил вход. Проверьте логин, пароль и код компании.");
  }
  return cookie;
}

export function giftsFetch(path: string, cookie: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : ORIGIN + path;
  return fetch(url, {
    ...init,
    method: init.method || "GET",
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*",
      ...(init.headers || {}),
      cookie
    },
    redirect: "follow",
    cache: "no-store"
  });
}

export async function readBasket(cookie: string) {
  const candidates = ["/private", "/private/orders", "/cart", "/"];
  const numbers = new Set<string>();
  for (const path of candidates) {
    try {
      const res = await giftsFetch(path, cookie);
      if (!res.ok) continue;
      const html = await res.text();
      for (const m of html.matchAll(/\/private\/order\/(\d{5,12})/g)) numbers.add(m[1]);
      for (const m of html.matchAll(/Заказ\s*№?\s*(\d{5,12})/gi)) numbers.add(m[1]);
      if (numbers.size) break;
    } catch {}
  }
  return [...numbers];
}

export function safeOrderNumber(value: string) {
  return /^\d{5,12}$/.test(value);
}

export function safeItemId(value: string) {
  return /^\d{1,20}$/.test(value);
}
