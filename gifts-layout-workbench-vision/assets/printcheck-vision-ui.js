/* PrintCheck Vision UI / isolated Maketnaya copy v0.1.
 * Purely client-side presentation of existing status and actual rendered artwork.
 * No new AI inference is claimed, no order writes, no training or upload.
 * All IDs are namespaced to avoid changing existing PrintCheck, editors and exports.
 */
(function () {
  'use strict';
  if (window.gwbPrintcheckVisionUiInstalled) return;
  window.gwbPrintcheckVisionUiInstalled = true;
  const byId = id => document.getElementById(id);
  let previousFocus = null;
  let currentPage = 'summary';
  let zoom = 1, focusX = .5, focusY = .5;
  let renderScheduled = false;
  let unwatch = [];
  const textOf = id => (byId(id)?.textContent || '').trim();
  const valueOf = id => (byId(id)?.value || '').toString().trim();
  const labelOf = id => {
    const input = byId(id);
    const selected = input?.selectedOptions?.[0];
    return (selected && selected.value ? selected.textContent : input?.value || '').trim();
  };
  const put = (id, value) => { const el = byId(id); if (el) el.textContent = value || '—'; };
  const isPlaceholder = s => !s || /^(выбрать файл|загрузите|ожидание|логотип не|файл не)/i.test(s);

  function snapshot() {
    const input = byId('artwork');
    const assetLabel = textOf('artworkName');
    const artwork = input?.files?.[0]?.name || (isPlaceholder(assetLabel) ? '' : assetLabel);
    const template = byId('template')?.files?.[0]?.name || textOf('templateName');
    const placementCount = textOf('placementCount');
    let oldChecks = textOf('checks');
    const simple = textOf('simpleChecks');
    if (oldChecks && simple && !oldChecks.includes(simple)) oldChecks += '\n' + simple;
    else if (!oldChecks) oldChecks = simple;
    return {
      order: valueOf('order') || textOf('orderNumber'),
      article: valueOf('article'),
      method: valueOf('method'),
      field: labelOf('orderFieldChoice') || labelOf('fields'),
      width: valueOf('width'),
      height: valueOf('height'),
      fieldSize: textOf('fieldSize'),
      artwork, template: isPlaceholder(template) ? '' : template,
      placementCount,
      legacyChecks: oldChecks,
      templateReady: textOf('templateLoadText'),
      logoReady: textOf('logoLoadText'),
      currentStatus: textOf('status'),
      visionState: 'not_implemented'
    };
  }

  function build() {
    const topbar = document.querySelector('.site-header .topbar');
    if (!topbar || !document.body || byId('gwbVisionPanel')) return false;
    const toggle = document.createElement('button');
    toggle.id = 'gwbVisionToggle';
    toggle.type = 'button';
    toggle.title = 'PrintCheck Vision — отдельная исследовательская копия';
    toggle.setAttribute('aria-controls', 'gwbVisionPanel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span class="gwbv-beacon" aria-hidden="true"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="3.2"/></svg><span>PrintCheck Vision</span>';
    const account = byId('accountButton');
    if (account?.parentElement === topbar) topbar.insertBefore(toggle, account);
    else topbar.append(toggle);

    const backdrop = document.createElement('button');
    backdrop.id = 'gwbVisionBackdrop';
    backdrop.type = 'button';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-label', 'Закрыть PrintCheck Vision');
    const panel = document.createElement('aside');
    panel.id = 'gwbVisionPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gwbVisionTitle');
    panel.tabIndex = -1;
    panel.innerHTML = [
      '<header class="gwbv-header">',
        '<div class="gwbv-hdline">',
          '<div class="gwbv-brand"><span class="gwbv-mark" aria-hidden="true">V</span><div>',
            '<div class="gwbv-overline">VISION INSPECTION · PREVIEW</div>',
            '<h2 id="gwbVisionTitle">PrintCheck Vision</h2>',
          '</div></div>',
          '<button class="gwbv-close" type="button" id="gwbVisionClose" aria-label="Закрыть">×</button>',
        '</div>',
        '<p class="gwbv-subtitle">Обзор макета, технический контекст и будущая многоуровневая проверка.</p>',
        '<nav class="gwbv-tabs" role="tablist" aria-label="Разделы Vision">',
          '<button type="button" role="tab" class="gwbv-tab" data-gwbv-tab="summary" id="gwbvTabSummary" aria-controls="gwbvPageSummary" aria-selected="true">Сводка</button>',
          '<button type="button" role="tab" class="gwbv-tab" data-gwbv-tab="visual" id="gwbvTabVisual" aria-controls="gwbvPageVisual" aria-selected="false">Изображение</button>',
          '<button type="button" role="tab" class="gwbv-tab" data-gwbv-tab="protocol" id="gwbvTabProtocol" aria-controls="gwbvPageProtocol" aria-selected="false">Протокол</button>',
        '</nav>',
      '</header>',
      '<div class="gwbv-body">',
        '<section class="gwbv-page" role="tabpanel" id="gwbvPageSummary" aria-labelledby="gwbvTabSummary">',
          '<div class="gwbv-status" role="status"><span class="gwbv-status-icon" aria-hidden="true">!</span><div>',
            '<strong>Нейросетевая проверка ещё не подключена</strong>',
            '<small>Это интерфейс опытной копии «Макетной». Ниже отображаются только фактические данные проекта и существующие проверки, а не выдуманные заключения ИИ.</small>',
          '</div></div>',
          '<h3 class="gwbv-title">Контекст текущего макета</h3>',
          '<div class="gwbv-panel"><div class="gwbv-kvs">',
            '<div><span class="gwbv-kv-label">Заказ</span><span class="gwbv-kv-value" id="gwbvOrder">—</span></div>',
            '<div><span class="gwbv-kv-label">Артикул</span><span class="gwbv-kv-value" id="gwbvArticle">—</span></div>',
            '<div class="gwbv-full"><span class="gwbv-kv-label">Метод нанесения</span><span class="gwbv-kv-value" id="gwbvMethod">—</span></div>',
            '<div class="gwbv-full"><span class="gwbv-kv-label">Поле нанесения</span><span class="gwbv-kv-value" id="gwbvField">—</span></div>',
            '<div class="gwbv-full"><span class="gwbv-kv-label">Логотип</span><span class="gwbv-kv-value" id="gwbvArtwork">Не выбран</span></div>',
            '<div><span class="gwbv-kv-label">Ширина логотипа</span><span class="gwbv-kv-value" id="gwbvWidth">—</span></div>',
            '<div><span class="gwbv-kv-label">Высота логотипа</span><span class="gwbv-kv-value" id="gwbvHeight">—</span></div>',
          '</div></div>',
          '<h3 class="gwbv-title">Этапы многоуровневого зрения</h3>',
          '<div class="gwbv-panel"><div class="gwbv-steps">',
            '<div class="gwbv-step"><b>01</b><span><strong>Обзор</strong> — композиция и печатные слои</span></div>',
            '<div class="gwbv-step"><b>02</b><span><strong>Объекты</strong> — векторные контуры и геометрия</span></div>',
            '<div class="gwbv-step"><b>03</b><span><strong>Микрозрение</strong> — локальные фрагменты в масштабе</span></div>',
            '<div class="gwbv-step"><b>04</b><span><strong>Экспертиза</strong> — нормативы, дефекты, отчёт</span></div>',
          '</div><p class="gwbv-muted">Этапы 01–04 описывают планируемый конвейер; запуск нейросетевых моделей в этой версии отсутствует.</p></div>',
          '<div class="gwbv-actions">',
            '<button type="button" class="gwbv-primary" id="gwbvRefresh">Обновить сводку</button>',
            '<button type="button" class="gwbv-secondary" id="gwbvSave">Скачать текстовую сводку</button>',
          '</div>',
        '</section>',
        '<section class="gwbv-page" role="tabpanel" id="gwbvPageVisual" aria-labelledby="gwbvTabVisual" hidden>',
          '<h3 class="gwbv-title">Рабочее изображение</h3>',
          '<div class="gwbv-panel">',
            '<div class="gwbv-preview-wrap"><canvas id="gwbVisionCanvas" width="800" height="500" aria-label="Увеличиваемый снимок рабочего поля"></canvas></div>',
            '<div class="gwbv-zoom"><label for="gwbvZoom">Увеличение</label><input id="gwbvZoom" type="range" min="1" max="8" step="1" value="1"><output id="gwbvZoomLabel" for="gwbvZoom">1×</output></div>',
            '<p id="gwbvPreviewStatus" class="gwbv-muted" role="status">Для просмотра откройте шаблон в Макетной.</p>',
            '<div class="gwbv-actions"><button type="button" id="gwbvCenter" class="gwbv-secondary">По центру</button><button type="button" id="gwbvSnapshot" class="gwbv-secondary">Обновить изображение</button></div>',
          '</div>',
          '<div class="gwbv-status"><span class="gwbv-status-icon" aria-hidden="true">i</span><div>',
            '<strong>Изображение — не результат сегментации ИИ</strong><small>Это локальный предпросмотр уже отрисованного рабочего поля. Нажмите на изображение, чтобы приблизить выбранный участок. Ни один файл не отправляется на сервер.</small>',
          '</div></div>',
        '</section>',
        '<section class="gwbv-page" role="tabpanel" id="gwbvPageProtocol" aria-labelledby="gwbvTabProtocol" hidden>',
          '<h3 class="gwbv-title">Результаты действующего проверяющего модуля</h3>',
          '<div class="gwbv-panel"><div id="gwbvLegacyChecks" class="gwbv-legacy">Пока нет данных.</div></div>',
          '<h3 class="gwbv-title">Ограничения экспериментальной версии</h3>',
          '<div class="gwbv-panel"><ul class="gwbv-list">',
            '<li>Не производит самостоятельную AI-сегментацию макета.</li>',
            '<li>Не определяет минимальные размеры линий и пробелов в миллиметрах.</li>',
            '<li>Не обучает модель на пользовательских файлах.</li>',
            '<li>Не изменяет сохранение, экспорт PDF или данные заказов.</li>',
            '<li>Специалистская разметка и утверждение моделей появятся в отдельной защищённой студии.</li>',
          '</ul></div>',
          '<p class="gwbv-muted">Текущий PrintCheck по-прежнему работает в основном интерфейсе. Этот экран только показывает его существующие сообщения.</p>',
        '</section>',
      '</div>',
      '<footer class="gwbv-foot"><span>Локально · без выгрузки макетов</span><span class="gwbv-new">UI prototype v0.1</span></footer>'
    ].join('');
    document.body.append(backdrop, panel);
    toggle.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    byId('gwbVisionClose').addEventListener('click', close);
    byId('gwbvRefresh').addEventListener('click', refresh);
    byId('gwbvSave').addEventListener('click', saveSummary);
    byId('gwbvSnapshot').addEventListener('click', drawPreview);
    byId('gwbvCenter').addEventListener('click', () => { focusX = .5; focusY = .5; drawPreview(); });
    byId('gwbvZoom').addEventListener('input', event => {
      zoom = Math.max(1, Math.min(8, Number(event.target.value) || 1));
      put('gwbvZoomLabel', zoom + '×');
      drawPreview();
    });
    byId('gwbVisionCanvas').addEventListener('click', event => {
      const rect = event.currentTarget.getBoundingClientRect();
      focusX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      focusY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      drawPreview();
    });
    panel.querySelectorAll('[data-gwbv-tab]').forEach(btn => {
      btn.addEventListener('click', () => setPage(btn.dataset.gwbvTab));
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const focusable = Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')).filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
      }
    });
    return true;
  }

  function setPage(page) {
    currentPage = ['summary', 'visual', 'protocol'].includes(page) ? page : 'summary';
    const mapping = {summary:'Summary',visual:'Visual',protocol:'Protocol'};
    for (const [key, name] of Object.entries(mapping)) {
      byId('gwbvPage' + name).hidden = key !== currentPage;
      const tab = byId('gwbvTab' + name);
      tab.setAttribute('aria-selected', key === currentPage ? 'true' : 'false');
      tab.tabIndex = key === currentPage ? 0 : -1;
    }
    if (currentPage === 'visual') drawPreview();
    if (currentPage === 'protocol') refresh();
  }

  function open() {
    if (!byId('gwbVisionPanel') && !build()) return;
    previousFocus = document.activeElement;
    byId('gwbVisionPanel').hidden = false;
    byId('gwbVisionBackdrop').hidden = false;
    byId('gwbVisionToggle').setAttribute('aria-expanded', 'true');
    setPage(currentPage);
    refresh();
    attachWatchers();
    byId('gwbVisionClose').focus();
  }

  function close() {
    if (!byId('gwbVisionPanel')) return;
    byId('gwbVisionPanel').hidden = true;
    byId('gwbVisionBackdrop').hidden = true;
    byId('gwbVisionToggle')?.setAttribute('aria-expanded', 'false');
    unwatch.forEach(clean => clean());
    unwatch = [];
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  function refresh() {
    if (!byId('gwbVisionPanel')) return;
    const s = snapshot();
    put('gwbvOrder', s.order || 'Не выбран');
    put('gwbvArticle', s.article || 'Не выбран');
    put('gwbvMethod', s.method || 'Не указан');
    put('gwbvField', s.field || 'Не выбрано');
    put('gwbvArtwork', s.artwork || 'Не загружен');
    put('gwbvWidth', s.width ? s.width + ' мм' : '—');
    put('gwbvHeight', s.height ? s.height + ' мм' : '—');
    put('gwbvLegacyChecks', s.legacyChecks || 'Проверка ещё не выполнялась либо результат недоступен.');
  }

  function drawPreview() {
    const target = byId('gwbVisionCanvas');
    if (!target || byId('gwbVisionPanel')?.hidden) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    const base = byId('templateCanvas'), overlay = byId('overlay');
    const active = (base && base.width > 0 && base.height > 0) ? base :
      (overlay && overlay.width > 0 && overlay.height > 0 ? overlay : null);
    if (!active) {
      put('gwbvPreviewStatus', 'Рабочее поле ещё не отрисовано. Откройте макет в основной части приложения.');
      return;
    }
    const border = 18;
    const scale = Math.min((target.width - border * 2) / active.width, (target.height - border * 2) / active.height) * zoom;
    ctx.save();
    ctx.translate(target.width / 2, target.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-focusX * active.width, -focusY * active.height);
    try {
      if (base && base.width && base.height) ctx.drawImage(base, 0, 0, active.width, active.height);
      if (overlay && overlay.width && overlay.height) ctx.drawImage(overlay, 0, 0, active.width, active.height);
      put('gwbvPreviewStatus', 'Снимок активного холста; масштаб ' + zoom + '×. Нажмите, чтобы сменить центр.');
    } catch (error) {
      ctx.clearRect(-target.width / 2, -target.height / 2, target.width, target.height);
      put('gwbvPreviewStatus', 'Не удалось отрисовать содержимое: ' + (error?.message || 'ошибка холста'));
    } finally {
      ctx.restore();
    }
    if (zoom > 1) {
      ctx.strokeStyle = '#bbe991'; ctx.lineWidth = 1;
      const x = target.width / 2, y = target.height / 2;
      ctx.beginPath(); ctx.moveTo(x-11,y);ctx.lineTo(x+11,y);ctx.moveTo(x,y-11);ctx.lineTo(x,y+11);ctx.stroke();
    }
  }

  function scheduleRefresh() {
    if (renderScheduled || byId('gwbVisionPanel')?.hidden) return;
    renderScheduled = true;
    requestAnimationFrame(() => { renderScheduled = false; refresh(); });
  }

  function attachWatchers() {
    if (unwatch.length) return;
    ['order','article','method','fields','orderFieldChoice','width','height','artwork','template'].forEach(id => {
      const node = byId(id); if (!node) return;
      node.addEventListener('change', scheduleRefresh);
      node.addEventListener('input', scheduleRefresh);
      unwatch.push(() => { node.removeEventListener('change', scheduleRefresh); node.removeEventListener('input', scheduleRefresh); });
    });
    ['checks','simpleChecks','artworkName','templateName','fieldSize','placementCount','orderEditor'].forEach(id => {
      const node = byId(id); if (!node) return;
      const observer = new MutationObserver(scheduleRefresh);
      observer.observe(node, {subtree:true,childList:true,characterData:true});
      unwatch.push(() => observer.disconnect());
    });
  }

  function reportText(s) {
    const lines = [
      'PrintCheck Vision · пользовательская сводка (прототип интерфейса)',
      'ИИ-ПРОВЕРКА: НЕ ВЫПОЛНЯЛАСЬ. Модель не подключена.',
      '',
      'Заказ: ' + (s.order || 'не выбран'),
      'Артикул: ' + (s.article || 'не указан'),
      'Нанесение: ' + (s.method || 'не указано'),
      'Поле: ' + (s.field || 'не выбрано'),
      'Логотип: ' + (s.artwork || 'не загружен'),
      'Размер: ' + (s.width || '—') + ' × ' + (s.height || '—') + ' мм',
      'Текущий статус: ' + (s.currentStatus || 'нет данных'),
      '',
      'СООБЩЕНИЯ ДЕЙСТВУЮЩЕЙ ПРОВЕРКИ (НЕ ИИ):',
      s.legacyChecks || 'Нет данных.',
      '',
      'Документ информационный; не подтверждает технологическую пригодность макета.'
    ];
    return lines.join('\r\n');
  }

  function saveSummary() {
    const s = snapshot();
    const filename = 'printcheck-vision-summary-' + String(s.order || 'draft').replace(/[^\w-]/g,'_') + '.txt';
    const blob = new Blob(['\uFEFF' + reportText(s)], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function init() {
    if (build()) window.gwbPrintcheckVisionUi = Object.freeze({open,close,refresh,snapshot,reportText});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
