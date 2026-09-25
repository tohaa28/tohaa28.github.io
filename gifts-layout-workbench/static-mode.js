(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    try {
      const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const url = new URL(raw, location.href);
      if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
        const body = url.pathname === "/api/session"
          ? { active: false, staticMode: true }
          : { error: "Статический режим: данные заказа передаются из авторизованной страницы gifts.ru.", staticMode: true };
        return Promise.resolve(new Response(JSON.stringify(body), {
          status: url.pathname === "/api/session" ? 200 : 410,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        }));
      }
    } catch {}
    return nativeFetch(input, init);
  };

  window.addEventListener("DOMContentLoaded", () => {
    const hide = (...ids) => ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });

    hide("accountButton", "giftsLogin", "basketBox", "manualOrderLabel", "loadOrder", "orderLoading", "orderStep");

    const intro = document.getElementById("orderIntro");
    if (intro) {
      intro.textContent = "Войдите на gifts.ru обычным способом, откройте нужный заказ и запустите закладку «Передать в Макетную». Заказ и PDF-шаблоны будут переданы прямо из авторизованной страницы gifts.ru; сервер Макетной не используется.";
    }

    const panel = document.getElementById("staticTransfer");
    if (panel) {
      panel.open = true;
      const summary = panel.querySelector("summary");
      if (summary) summary.textContent = "Передать заказ из gifts.ru";
      const paragraphs = panel.querySelectorAll(".help");
      if (paragraphs[0]) {
        paragraphs[0].textContent = "Перетащите кнопку ниже на панель закладок браузера. Затем откройте заказ на gifts.ru и нажмите эту закладку.";
      }
      if (paragraphs[1]) {
        paragraphs[1].textContent = "Макетная только читает страницу заказа и скачивает PDF-шаблоны. Статусы, переключатели и «Согласования макетов» не изменяются.";
      }
    }

    const transfer = document.getElementById("transferBookmark");
    if (transfer) {
      transfer.textContent = "Передать в Макетную";
      transfer.setAttribute("title", "Перетащите эту кнопку на панель закладок");
    }

    const loginStatus = document.getElementById("loginStatus");
    if (loginStatus) loginStatus.textContent = "";

    document.documentElement.dataset.staticMode = "true";
  });
})();
