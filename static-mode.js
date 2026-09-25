(() => {
  const nativeFetch = window.fetch.bind(window);
  const pending = new Map();
  let bridgeAvailable = false;
  let seq = 0;
  let authPoll = null;

  function bridgeRequest(request, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const id = "gwb-" + Date.now() + "-" + (++seq);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Расширение «Макетная gifts.ru Bridge» не отвечает."));
      }, timeout);
      pending.set(id, {
        resolve(value) { clearTimeout(timer); resolve(value); },
        reject(error) { clearTimeout(timer); reject(error); }
      });
      window.postMessage({
        channel: "gifts-workbench-page",
        id,
        request
      }, location.origin);
    });
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg) return;

    if (msg.channel === "gifts-workbench-extension-ready") {
      bridgeAvailable = true;
      document.documentElement.dataset.bridge = "ready";
      return;
    }

    if (msg.channel !== "gifts-workbench-extension" || !msg.id) return;
    bridgeAvailable = true;
    document.documentElement.dataset.bridge = "ready";
    const task = pending.get(msg.id);
    if (!task) return;
    pending.delete(msg.id);

    if (msg.response?.ok) task.resolve(msg.response.data);
    else task.reject(new Error(msg.response?.error || "Ошибка локального моста."));
  });

  function jsonResponse(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  function bytesFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function localApi(url, init = {}) {
    const path = url.pathname;
    const method = String(init.method || "GET").toUpperCase();

    try {
      if (path === "/api/session" && method === "GET") {
        return jsonResponse(await bridgeRequest({ type: "SESSION" }, 12000));
      }

      if (path === "/api/basket" && method === "GET") {
        return jsonResponse(await bridgeRequest({ type: "BASKET" }, 90000));
      }

      if (path === "/api/login" && method === "DELETE") {
        return jsonResponse({ ok: true, localBridge: true });
      }

      if (path === "/api/login" && method === "POST") {
        await bridgeRequest({ type: "OPEN_LOGIN" }, 12000);
        return jsonResponse({
          error: "Открыта настоящая страница входа gifts.ru. Выполните вход там; Макетная определит авторизацию автоматически."
        }, 409);
      }

      let m = path.match(/^\/api\/orders\/(\d{5,12})\/items\/(\d{1,20})\.pdf$/);
      if (m && method === "GET") {
        const result = await bridgeRequest({ type: "PDF", order: m[1], itemId: m[2] }, 120000);
        const bytes = bytesFromBase64(result.base64);
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": result.contentType || "application/pdf",
            "cache-control": "no-store"
          }
        });
      }

      m = path.match(/^\/api\/orders\/(\d{5,12})\/items\/(\d{1,20})\/preview$/);
      if (m && method === "GET") {
        const result = await bridgeRequest({ type: "PREVIEW", order: m[1], itemId: m[2] }, 120000);
        const bytes = bytesFromBase64(result.base64);
        return new Response(bytes, {
          status: 200,
          headers: {
            "content-type": result.contentType || "image/jpeg",
            "cache-control": "private, max-age=300"
          }
        });
      }

      m = path.match(/^\/api\/orders\/(\d{5,12})$/);
      if (m && method === "GET") {
        return jsonResponse(await bridgeRequest({ type: "ORDER", order: m[1] }, 90000));
      }

      return jsonResponse({ error: "Неизвестный локальный API-запрос." }, 404);
    } catch (error) {
      return jsonResponse({
        error: error?.message || String(error),
        bridgeMissing: !bridgeAvailable
      }, bridgeAvailable ? 502 : 503);
    }
  }

  window.fetch = (input, init = {}) => {
    try {
      const raw = typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      const url = new URL(raw, location.href);
      if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
        return localApi(url, init);
      }
    } catch {}
    return nativeFetch(input, init);
  };

  async function detectBridge() {
    try {
      await bridgeRequest({ type: "PING" }, 1200);
      bridgeAvailable = true;
      document.documentElement.dataset.bridge = "ready";
      return true;
    } catch {
      bridgeAvailable = false;
      document.documentElement.dataset.bridge = "missing";
      return false;
    }
  }

  function setAuthUi(active) {
    const account = document.getElementById("accountButton");
    const loginDetails = document.getElementById("giftsLogin");
    const loginForm = document.getElementById("loginForm");
    const logout = document.getElementById("logoutButton");
    const status = document.getElementById("loginStatus");

    if (account) account.textContent = active ? "gifts.ru ✓" : "Войти";
    if (loginDetails) loginDetails.hidden = true;
    if (loginForm) loginForm.hidden = true;
    if (logout) logout.hidden = true;
    if (status) status.textContent = active ? "Авторизация gifts.ru обнаружена локальным мостом." : "";
  }

  async function refreshSessionAndBasket() {
    try {
      const session = await bridgeRequest({ type: "SESSION" }, 12000);
      setAuthUi(!!session.active);
      if (session.active) {
        const refresh = document.getElementById("refreshBasket");
        if (refresh) refresh.click();
      }
      return !!session.active;
    } catch {
      setAuthUi(false);
      return false;
    }
  }

  function startAuthPolling() {
    if (authPoll) clearInterval(authPoll);
    let tries = 0;
    authPoll = setInterval(async () => {
      tries++;
      const active = await refreshSessionAndBasket();
      if (active || tries >= 80) {
        clearInterval(authPoll);
        authPoll = null;
      }
    }, 1500);
  }

  function addBridgeNotice(installed) {
    let box = document.getElementById("bridgeSetup");
    if (!box) {
      box = document.createElement("div");
      box.id = "bridgeSetup";
      box.className = "bridge-setup";
      const panel = document.getElementById("orderBrowser");
      const intro = document.getElementById("orderIntro");
      if (panel) panel.insertBefore(box, intro?.nextSibling || panel.firstChild);
    }

    if (installed) {
      box.innerHTML = '<b>Локальный мост подключён.</b><span>Авторизация и корзина читаются непосредственно из вашего браузера.</span>';
      box.classList.add("ok");
    } else {
      box.innerHTML =
        '<b>Нужно установить локальный мост.</b>' +
        '<span>Он даёт этой странице доступ к вашей авторизованной сессии gifts.ru без backend.</span>' +
        '<a href="./extension/install.html" target="_blank" rel="noopener">Установить локальный мост</a>';
      box.classList.remove("ok");
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    document.documentElement.dataset.staticMode = "bridge";

    const intro = document.getElementById("orderIntro");
    if (intro) {
      intro.textContent = "Войдите в gifts.ru через кнопку «Войти». Макетная использует локальное расширение браузера: сессия, корзина, заказ и PDF читаются напрямую с gifts.ru без собственного сервера.";
    }

    const fallback = document.getElementById("staticTransfer");
    if (fallback) {
      fallback.open = false;
      const summary = fallback.querySelector("summary");
      if (summary) summary.textContent = "Резервный ручной способ";
    }

    const account = document.getElementById("accountButton");
    if (account) {
      account.hidden = false;
      account.addEventListener("click", async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (!(await detectBridge())) {
          addBridgeNotice(false);
          return;
        }

        const session = await bridgeRequest({ type: "SESSION" }, 12000).catch(() => ({ active: false }));
        if (session.active) {
          await bridgeRequest({ type: "OPEN_LOGIN" }, 12000);
          return;
        }

        account.textContent = "Открываю gifts.ru…";
        await bridgeRequest({ type: "OPEN_LOGIN" }, 12000);
        setAuthUi(false);
        startAuthPolling();
      }, true);
    }

    const installed = await detectBridge();
    addBridgeNotice(installed);
    if (installed) await refreshSessionAndBasket();
    else setAuthUi(false);
  });
})();