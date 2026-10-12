/* Presentation layer only. Native IDs, file inputs and editor handlers stay intact. */
(() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new WeakMap();
  function enter(node, direction = 1, duration = 320) {
    if (!node || reduced.matches || !node.animate || !node.getClientRects().length) return;
    animations.get(node)?.cancel();
    const animation = node.animate([
      {opacity: 0, transform: `translateY(${direction * 12}px)`},
      {opacity: 1, transform: 'translateY(0)'}
    ], {duration, easing: 'cubic-bezier(.22,1,.36,1)'});
    animations.set(node, animation);
  }
  const windowClosures = new WeakMap(), disclosures = new WeakMap();
  function cancelClose(node) {
    const pending = windowClosures.get(node); if (!pending) return;
    windowClosures.delete(node); pending.animation.cancel(); node.inert = pending.inert;
  }
  function closeWindow(node, finish) {
    if (!node || node.hidden || (node.tagName === 'DIALOG' && !node.open) || reduced.matches || !node.animate) {
      cancelClose(node); finish(); return Promise.resolve();
    }
    const pending = windowClosures.get(node); if (pending) return pending.promise;
    animations.get(node)?.cancel();
    const inert = node.inert; node.inert = true;
    const animation = node.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(8px)'}],
      {duration:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    const record = {animation,inert,promise:null}; windowClosures.set(node,record); animations.set(node,animation);
    record.promise = animation.finished.then(() => {
      if (windowClosures.get(node) !== record) return;
      windowClosures.delete(node); node.inert = inert; finish(); animation.cancel();
    }, () => {});
    return record.promise;
  }
  function restoreDisclosure(node, record) {
    node.style.height = record.height; node.style.overflow = record.overflow;
    for (const [child,inert] of record.children) child.inert = inert;
  }
  function cancelDisclosure(node) {
    const record = disclosures.get(node); if (!record) return;
    disclosures.delete(node); record.animation?.cancel(); restoreDisclosure(node,record);
  }
  function toggleDisclosure(node) {
    const summary = node.querySelector(':scope > summary'); if (!summary) return;
    const pending = disclosures.get(node), desired = !(pending ? pending.desired : node.open);
    const start = node.getBoundingClientRect().height;
    const original = pending || {height:node.style.height,overflow:node.style.overflow,
      children:[...node.children].filter(child=>child!==summary).map(child=>[child,child.inert])};
    cancelDisclosure(node);
    node.dispatchEvent(new CustomEvent('gwb-disclosure-target',{detail:{open:desired}}));
    if (reduced.matches || !node.animate) { node.open = desired; return; }
    node.open = true;
    const style = getComputedStyle(node), summaryStyle = getComputedStyle(summary), number = value => parseFloat(value)||0;
    const closed = summary.getBoundingClientRect().height + number(style.paddingTop) + number(style.paddingBottom) +
      number(style.borderTopWidth) + number(style.borderBottomWidth) + number(summaryStyle.marginTop) + number(summaryStyle.marginBottom);
    const end = desired ? node.getBoundingClientRect().height : closed;
    node.style.overflow = 'hidden';
    const record = {...original,desired,animation:null}; disclosures.set(node,record);
    if (!desired) for (const [child] of record.children) child.inert = true;
    record.animation = node.animate([{height:start+'px'},{height:end+'px'}],
      {duration:260,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    record.animation.finished.then(() => {
      if (disclosures.get(node) !== record) return;
      disclosures.delete(node); node.open = desired; restoreDisclosure(node,record); record.animation.cancel();
    },()=>{});
  }
  const reports = new WeakSet();
  function foldReport(panel) {
    if (panel?.id !== 'logoErrorOverlay' || reports.has(panel)) return;
    reports.add(panel); let open = false;
    const wrap = () => {
      if (panel.querySelector(':scope > .flow-canvas-report')) return;
      const heading = panel.querySelector(':scope > strong'), list = panel.querySelector(':scope > ul');
      if (!heading || !list) return;
      const disclosure = document.createElement('details'); disclosure.className = 'flow-canvas-report'; disclosure.open = open;
      const summary = document.createElement('summary'); summary.append(heading);
      const pending = [...list.children].find(node => node.textContent.includes('поиск мелких элементов'));
      if (pending) { const status = document.createElement('span'); status.className = 'flow-report-status'; status.textContent = pending.textContent; summary.append(status); }
      disclosure.append(summary,list); panel.append(disclosure);
      disclosure.addEventListener('gwb-disclosure-target', event => { open = event.detail.open; });
      disclosure.addEventListener('toggle', () => { open = disclosures.get(disclosure)?.desired ?? disclosure.open; });
    };
    new MutationObserver(wrap).observe(panel,{childList:true}); wrap();
  }
  function installMotion() {
    // Observe only visibility and disclosure changes, never canvas pixels or input values.
    const observer = new MutationObserver(records => {
      const changed = new Set(records.filter(record => (record.oldValue !== null) !== record.target.hasAttribute(record.attributeName)).map(record => record.target));
      for (const node of changed) {
        if (disclosures.has(node)) { if (!node.open) cancelDisclosure(node); else continue; }
        if (node.matches('[hidden],details:not([open])')) continue;
        if (node.matches('details')) {
          for (const child of node.children) if (child.tagName !== 'SUMMARY') enter(child);
        } else enter(node);
      }
    });
    const watch = node => {
      foldReport(node);
      if (node.querySelector) foldReport(node.querySelector('#logoErrorOverlay'));
      if (node.matches('[hidden],details,dialog,#mockupShell,#orderEditor,#orderBrowser'))
        observer.observe(node, {attributes: true, attributeFilter: ['hidden', 'open'], attributeOldValue: true});
      node.querySelectorAll('[hidden],details,dialog,#orderBrowser,#orderEditor,#mockupShell').forEach(child => observer.observe(child, {attributes: true, attributeFilter: ['hidden', 'open'], attributeOldValue: true}));
    };
    watch(document.body);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes)
        if (node.nodeType === 1) watch(node);
    }).observe(document.body, {childList: true, subtree: true});
    window.gwbMotion = {closeWindow,cancelClose,isClosing:node=>windowClosures.has(node)};
    document.addEventListener('click', event => {
      const summary = event.target.closest('summary');
      const disclosure = summary?.parentElement;
      if (!disclosure?.matches('#logoPreflight,#logoDetailCheck,.flow-canvas-report,.metadata,#giftsLogin') ||
          event.target.closest('a,button,input,select')) return;
      event.preventDefault(); toggleDisclosure(disclosure);
    },true);
    // A view transition must not shift the canvas under an active drag.
    document.addEventListener('pointerdown', event => {
      if (event.target.closest('#stage')) animations.get($('stage'))?.cancel();
    },true);
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      if (/^(?:zoomPage|editorFit|editorCenter|fieldZoomFit|view)/.test(button.id)) enter($('stage'), 1, 240);
    });
  }
  function installFlow() {
    const editor = $('orderEditor'), main = document.querySelector('.app>main');
    if (!editor || !main || $('flowNavigation')) return;
    document.body.classList.add('gwb-step-interface');
    const labels = ['Артикул', 'Место', 'Макет', 'Скачать'];
    const descriptions = ['Выберите изделие из заказа', 'Выберите место нанесения', 'Добавьте и разместите логотип', 'Проверьте результат и скачайте'];
    const shell = document.createElement('div'); shell.id = 'flowHeader';
    shell.innerHTML = '<nav id="flowNavigation" aria-label="Шаги создания макета">' + labels.map((label, index) =>
      `<button type="button" data-flow-step="${index + 1}" aria-controls="orderEditor"><span class="flow-number">${index + 1}</span><span>${label}</span></button>`).join('') +
      '</nav><div class="flow-context"><span id="flowContext"></span><button id="flowSettings" type="button" aria-expanded="false" aria-controls="flowSettingsDock">Тонкая настройка</button></div>';
    editor.prepend(shell);
    const title = document.createElement('div'); title.id = 'flowStepTitle';
    title.innerHTML = '<strong id="flowHeading"></strong><span id="flowDescription"></span>';
    shell.after(title);
    const footer = document.createElement('div'); footer.id = 'flowFooter';
    footer.innerHTML = '<button id="flowPrevious" type="button">← Назад</button><button id="flowNext" type="button" class="primary">Продолжить →</button>';
    editor.append(footer);
    const dock = document.createElement('aside'); dock.id = 'flowSettingsDock'; dock.hidden = true;
    dock.setAttribute('aria-label', 'Тонкая настройка макета');
    dock.innerHTML = '<div class="flow-dock-head"><strong>Тонкая настройка</strong><button id="flowCloseSettings" type="button" aria-label="Закрыть тонкую настройку">×</button></div><div id="flowSettingsContent"></div>';
    main.append(dock);
    const mobileLayout = matchMedia('(max-width:780px)');
    const placeNavigation = () => {
      if (mobileLayout.matches) main.closest('.app').insertBefore(shell,main);
      else editor.prepend(shell);
    };
    mobileLayout.addEventListener('change',placeNavigation); placeNavigation();
    const content = $('flowSettingsContent');
    // Move the actual controls; do not clone or create parallel editor state.
    for (const id of ['transformControls', 'fieldsPanel', 'checksPanel']) if ($(id)) content.append($(id));
    const metadata = editor.querySelector('.metadata'); if (metadata) content.append(metadata);
    for (const selector of ['.stage-angle', '#editorRotateLeft', '#editorRotateRight', '.stage-clip', '#editorRemoveLogo'].reverse()) {
      const node = $('fieldLogoTools')?.querySelector(selector); if (node) content.prepend(node);
    }
    const more = document.createElement('button'); more.type = 'button'; more.id = 'flowToolMore'; more.textContent = 'Ещё инструменты';
    more.setAttribute('aria-controls', dock.id); more.setAttribute('aria-expanded', 'false');
    $('fieldLogoTools')?.append(more);
    const article = editor.querySelector('.article-card'); if (article) article.dataset.flowPart = 'article';
    $('artwork')?.closest('label')?.setAttribute('data-flow-part', 'artwork');
    const review = document.createElement('div'); review.id = 'flowReview';
    review.innerHTML = '<div class="flow-review-mark" aria-hidden="true">✓</div><strong>Проверьте готовый макет</strong><button id="flowReviewEdit" type="button">Изменить</button>';
    $('simpleControls').before(review);
    let step = 1, settingsOpen = false, previous = {}, frame = 0, lastSignature = '', lastReadyArticle = '', closingSettings = false, closeTimer = 0;
    const setHidden = (node, hidden) => { if (node && node.hidden !== hidden) node.hidden = hidden; };
    const state = () => {
      let native = {}; try { native = window.gwbGetEditorReadiness?.() || {}; } catch {}
      return {...native, article: $('article')?.value || '', order: $('order')?.value || '', selected: $('orderTemplates')?.value || '',
        articleCount: $('orderTemplateList')?.children.length || 0, field: $('orderFieldChoice')?.value || '', open: !editor.hidden};
    };
    const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
    function available(target, s) {
      if (target === 1) return !($('orderTemplatesBox')?.hidden);
      if (target === 2) return !!s.templateReady;
      if (target === 3) return !!s.templateReady && !!s.hasSelectedField;
      return !!s.templateReady && !!s.logoReady;
    }
    function setSettings(open, focus = false) {
      clearTimeout(closeTimer); closingSettings = false;
      dock.classList.remove('flow-settings-closing');
      settingsOpen = open; dock.inert = !open;
      $('flowSettings').setAttribute('aria-expanded', String(open)); more.setAttribute('aria-expanded', String(open));
      const layout = () => {
        main.classList.toggle('flow-settings-open', settingsOpen || closingSettings);
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
          if (mobileLayout.matches && !closingSettings) {
            const target = settingsOpen ? dock : main.querySelector('.workspace');
            target?.scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'});
          }
        });
      };
      if (!open && !dock.hidden && !reduced.matches) {
        closingSettings = true; dock.classList.add('flow-settings-closing');
        closeTimer = setTimeout(() => {
          closingSettings = false; dock.hidden = true; dock.classList.remove('flow-settings-closing'); layout();
        },180);
      } else { setHidden(dock,!open); layout(); }
      if (focus) (open ? $('flowCloseSettings') : $('flowSettings')).focus({preventScroll: true});
    }
    function go(target, focus = false) {
      const s = state(); if (!available(target, s)) return;
      const direction = target >= step ? 1 : -1; step = target;
      render(s);
      main.querySelector('.rail').scrollTop = 0;
      if (innerWidth <= 780) main.scrollTop = 0;
      enter(title, direction); enter(article?.getClientRects().length ? article : $('orderFieldChoiceBox'), direction);
      if (focus) $('flowNavigation').querySelector(`[data-flow-step="${step}"]`)?.focus({preventScroll:true});
    }
    function render(s = state()) {
      // Backtracking changes the presentation only; no file reload or redraw is required.
      if (editor.dataset.flowStep !== String(step)) editor.dataset.flowStep = String(step);
      setHidden(shell, !s.open); setHidden(dock, !s.open || !(settingsOpen || closingSettings));
      const status = [s.order ? 'Заказ ' + s.order : '', s.article ? 'Арт. ' + s.article : ''].filter(Boolean).join(' · ');
      setText($('flowContext'), status);
      const fieldCaption = $('orderFieldChoiceBox')?.querySelector('.simple-label');
      setText(fieldCaption, step === 2 ? 'Выберите место нанесения' : 'Место нанесения');
      setText($('flowHeading'), labels[step - 1]); setText($('flowDescription'), descriptions[step - 1]);
      for (const button of $('flowNavigation').querySelectorAll('button')) {
        const target = Number(button.dataset.flowStep);
        button.disabled = !available(target, s) || !!s.busy;
        button.setAttribute('aria-current', target === step ? 'step' : 'false');
        button.classList.toggle('flow-complete', target < step && available(target, s));
      }
      const prev = step === 2 && !available(1,s) ? 2 : step - 1;
      $('flowPrevious').disabled = step === 1 || prev === step || !!s.busy;
      setHidden($('flowNext'), step === 4);
      $('flowNext').disabled = !!s.busy || !available(step + 1, s);
      setText($('flowNext'), step === 3 ? 'Проверить и скачать →' : 'Продолжить →');
      setHidden(review, step !== 4);
      const signature = [s.templateReady, s.hasSelectedField, s.logoReady, s.busy, step, s.order, s.article, s.field].join('|');
      if (signature !== lastSignature) {
        lastSignature = signature;
        window.dispatchEvent(new CustomEvent('gwb-flow-step-changed', {detail: {step, settingsOpen}}));
      }
    }
    function sync() {
      frame = 0; const s = state();
      if (s.open && !previous.open) step = available(1,s) && s.articleCount > 1 ? 1 : s.hasSelectedField ? 3 : 2;
      const readyArticle = s.order + '|' + s.article + '|' + s.selected;
      if (s.open && previous.open && lastReadyArticle && readyArticle !== lastReadyArticle && s.templateReady && !s.busy) step = s.hasSelectedField ? 3 : 2;
      if (s.templateReady && !s.busy) lastReadyArticle = readyArticle;
      if (s.open && s.hasSelectedField && !previous.hasSelectedField && step === 2) step = 3;
      if (s.open && !s.hasSelectedField && previous.hasSelectedField && step === 3) step = 2;
      if (s.open && !s.logoReady && step === 4) step = s.hasSelectedField ? 3 : 2;
      // Keep PrintCheck's detailed disclosure local to the current step.
      const detail = $('detailPanel'); if (detail && detail.parentElement === main.querySelector('.rail')) {
        detail.classList.add('flow-check-details'); editor.insertBefore(detail,footer);
      }
      if (!s.open && previous.open) { clearTimeout(closeTimer); closingSettings = false; settingsOpen = false; dock.inert = true; main.classList.remove('flow-settings-open'); }
      if (s.open && previous.open && (s.field !== previous.field || s.hasSelectedField !== previous.hasSelectedField || s.article !== previous.article)) enter($('stage'),1,320);
      previous = s; render(s);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    $('flowNavigation').addEventListener('click', event => {
      const button = event.target.closest('[data-flow-step]'); if (button) go(Number(button.dataset.flowStep));
    });
    $('flowPrevious').onclick = () => go(step - 1);
    $('flowNext').onclick = () => go(step + 1);
    $('flowReviewEdit').onclick = () => go(3);
    $('flowSettings').onclick = () => setSettings(!settingsOpen,true);
    more.onclick = () => setSettings(!settingsOpen,true);
    $('flowCloseSettings').onclick = () => setSettings(false, true);
    dock.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); setSettings(false,true); } });
    for (const id of ['orderFieldChoice', 'fields']) $(id)?.addEventListener('change', schedule);
    const observer = new MutationObserver(schedule);
    for (const id of ['orderEditor','orderTemplates','orderTemplatesBox','orderFieldChoice','placementCount','templateName','article','step4Box','editorStep3']) {
      const node = $(id); if (node) observer.observe(node, {attributes:true, attributeFilter:['hidden'], childList:true, subtree:true, characterData:true});
    }
    window.addEventListener('gwb-editor-readiness-changed', schedule);
    // Public UI navigation used by the browser regression suite; never changes editor data.
    window.gwbFlow = {go, setSettings, getState: () => ({step, settingsOpen})};
    setInterval(schedule, 350); sync();
  }
  function init() { installMotion(); installFlow(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
