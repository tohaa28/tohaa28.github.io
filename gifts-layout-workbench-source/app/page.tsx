"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { parseOrderHtml, OrderItem } from "../lib/orderParser";

type BasketOrder = { number: string };

export default function Page() {
  const [active, setActive] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [orders, setOrders] = useState<BasketOrder[]>([]);
  const [orderNo, setOrderNo] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedArticle, setSelectedArticle] = useState("");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [mode, setMode] = useState<"simple"|"advanced">("simple");
  const [status, setStatus] = useState("Подключите gifts.ru и выберите заказ.");
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [artwork, setArtwork] = useState<{name:string,url:string,type:string}|null>(null);

  const item = useMemo(() => items.find(i => i.article === selectedArticle) || items[0], [items, selectedArticle]);
  const app = useMemo(() => item?.applications.find(a => a.id === selectedAppId) || item?.applications[0], [item, selectedAppId]);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setActive(!!d.active); if (d.active) refreshBasket(); })
      .catch(() => {});
  }, []);

  async function refreshBasket() {
    setStatus("Обновляю корзину…");
    const r = await fetch("/api/basket", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) { setStatus(d.error || "Не удалось прочитать корзину."); return; }
    setOrders(d.orders || []);
    setStatus((d.orders?.length || 0) ? "Корзина обновлена." : "Заказы в корзине не найдены.");
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("Подключаюсь к gifts.ru…");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password, code })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Вход не выполнен.");
      setPassword("");
      setActive(true);
      setLoginOpen(false);
      await refreshBasket();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    setActive(false);
    setOrders([]);
    setItems([]);
    setStatus("Сеанс завершён.");
  }

  async function loadOrder(number = orderNo) {
    const n = String(number).trim();
    if (!/^\d{5,12}$/.test(n)) { setStatus("Введите корректный номер заказа."); return; }
    setBusy(true);
    setStatus("Читаю заказ №" + n + "…");
    try {
      const r = await fetch("/api/orders/" + n, { cache: "no-store" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Не удалось получить заказ.");
      }
      const html = await r.text();
      const parsed = parseOrderHtml(html, n);
      if (!parsed.items.length) throw new Error("На странице заказа не найдены позиции с нанесениями.");
      setOrderNo(n);
      setItems(parsed.items);
      setSelectedArticle(parsed.items[0].article);
      setSelectedAppId(parsed.items[0].applications[0]?.id || "");
      setDiagnostics(parsed.diagnostics);
      setStatus("Заказ №" + n + " загружен.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  function selectArticle(article: string) {
    setSelectedArticle(article);
    const next = items.find(i => i.article === article);
    setSelectedAppId(next?.applications[0]?.id || "");
  }

  function onArtwork(file?: File) {
    if (!file) return;
    if (artwork?.url) URL.revokeObjectURL(artwork.url);
    setArtwork({ name: file.name, url: URL.createObjectURL(file), type: file.type });
  }

  const pdfUrl = item?.orderItemId && orderNo
    ? `/api/orders/${orderNo}/items/${item.orderItemId}.pdf`
    : null;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand"><b>▣ Макетная</b><span>gifts.ru · GitHub source</span></div>
        <div className="topActions">
          <button className="ghost" onClick={() => setMode(mode === "simple" ? "advanced" : "simple")}>
            {mode === "simple" ? "Продвинутый режим" : "Простой режим"}
          </button>
          {active
            ? <button onClick={logout}>Выйти</button>
            : <button onClick={() => setLoginOpen(true)}>Войти</button>}
        </div>
      </header>

      {loginOpen && (
        <div className="modalBackdrop" onMouseDown={() => setLoginOpen(false)}>
          <form className="loginCard" onSubmit={submitLogin} onMouseDown={e => e.stopPropagation()}>
            <h2>Вход в gifts.ru</h2>
            <label>Логин<input value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" /></label>
            <label>Пароль<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <label>Код компании<input value={code} onChange={e => setCode(e.target.value)} /></label>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setLoginOpen(false)}>Отмена</button>
              <button disabled={busy}>Войти</button>
            </div>
          </form>
        </div>
      )}

      <section className="body">
        <aside className="rail">
          <section className="panel">
            <div className="panelTitle">Заказ</div>
            <div className="orderEntry">
              <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="Номер заказа" />
              <button disabled={busy || !active} onClick={() => loadOrder()}>Открыть</button>
            </div>
            <div className="status">{status}</div>
            {active && <button className="full ghost" onClick={refreshBasket}>Обновить корзину</button>}
          </section>

          {orders.length > 0 && (
            <section className="panel">
              <div className="panelTitle">Корзина</div>
              <div className="orders">
                {orders.map(o => <button key={o.number} className="orderBtn" onClick={() => loadOrder(o.number)}>Заказ №{o.number}</button>)}
              </div>
            </section>
          )}

          {items.length > 0 && (
            <>
              <section className="panel">
                <div className="panelTitle">Артикул</div>
                <select value={item?.article} onChange={e => selectArticle(e.target.value)}>
                  {items.map(i => <option key={i.article} value={i.article}>{i.article} · {i.name} · {i.quantity || "—"} шт.</option>)}
                </select>
                {item && (
                  <div className="itemCard">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="thumbFallback">{item.article}</div>}
                    <div>
                      <b>{item.article}</b>
                      <div>{item.name}</div>
                      <small>{item.quantity || "—"} шт.</small>
                    </div>
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panelTitle">Место нанесения</div>
                <select value={app?.id || ""} onChange={e => setSelectedAppId(e.target.value)}>
                  {(item?.applications || []).map(a => <option key={a.id} value={a.id}>{a.place}</option>)}
                </select>
                {app && (
                  <div className="facts">
                    <div><span>Место</span><b>{app.place}</b></div>
                    <div><span>Метод</span><b>{app.method}</b></div>
                    {mode === "advanced" && <div><span>Источник</span><b>{app.placeSource}</b></div>}
                    {mode === "advanced" && item?.orderItemId && <div><span>itemId</span><b>{item.orderItemId}</b></div>}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panelTitle">Нанесение</div>
                <label className="upload">Выбрать файл<input type="file" accept=".pdf,.svg,.png,.jpg,.jpeg" onChange={e => onArtwork(e.target.files?.[0])} /></label>
                {artwork && <div className="fileName">{artwork.name}</div>}
              </section>

              {mode === "advanced" && (
                <section className="panel">
                  <div className="panelTitle">Диагностика</div>
                  <div className="diag">{diagnostics.map((d,i) => <div key={i}>{d}</div>)}</div>
                </section>
              )}
            </>
          )}
        </aside>

        <section className="workspace">
          <div className="workspaceHead">
            <div><b>{item ? item.article + " · " + (app?.place || "место") : "Редактор"}</b><small>{app?.method || ""}</small></div>
            <div className="workspaceHint">Рабочая область подстраивается под окно</div>
          </div>

          <div className="stageScroll">
            <div className="stage">
              {pdfUrl
                ? <iframe src={pdfUrl + "#toolbar=0&navpanes=0"} title="Шаблон PDF" className="pdfFrame" />
                : <div className="empty">Выберите заказ и позицию</div>}
              {artwork && !artwork.name.toLowerCase().endsWith(".pdf") && (
                <img className="artwork" src={artwork.url} alt="Нанесение" draggable={false} />
              )}
            </div>
          </div>

          <footer className="bottomBar">
            <span>{item ? item.article : "—"} → {app?.place || "поле не выбрано"}</span>
            <button disabled={!item}>Сохранить макет</button>
          </footer>
        </section>
      </section>
    </main>
  );
}
