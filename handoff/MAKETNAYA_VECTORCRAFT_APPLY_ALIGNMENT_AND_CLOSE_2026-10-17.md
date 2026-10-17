# Контрольная точка: выравнивание Apply + скрытие «Закрыть Макетную»
Дата: 2026-10-17. Текущая проверенная функциональная база после native-toolbar-apply.

## Задача и результат
1. Родная зелёная кнопка `Применить в Макетной` в настоящем Rust/egui VectorCraft поднята на 3 px внутри `chrome.rs`. Для сохранения горизонтальной сетки штатной строки используются `ui.allocate_exact_size(vec2(176,WIDGET_H),Sense::hover())` и `ui.put(slot.translate(vec2(0,-3)),button)`. Команда по-прежнему идёт через `gwb_native_toolbar_apply` → `gwb-vectorcraft-apply-request` → существующий JS `s.apply.click()` с сохранением проверок текущего поля, размеров и SVG.
2. Внешний крестик `Закрыть Макетную` на gifts.ru полностью скрывается при открытии VectorCraft, возвращается после закрытия. Исправлена причина: вложенная Макетная запускается в `iframe.srcdoc`, для которого `location.origin` может оказаться `null`. `assets/vectorcraft-integration.js` берёт проверяемый targetOrigin непосредственно из `window.parent.location.origin`, синхронизирует родительскую кнопку `gifts-layout-workbench-host .gwb-close` через same-origin DOM (hide/disabled/display) и дополнительно отправляет origin-targeted postMessage в исходный обработчик в launcher.
3. Скрытие распространяется и на сохранённый простой редактор логотипа: `assets/logo-editor.js` сообщает об открытии, отмене/закрытии и успешном применении через `window.gwbReportLogoEditorVisibility`. Внешний крестик вновь появляется, если оба редактора закрыты.
4. Обновлены cache busting версии в `editor.html`, без изменения загрузки заказов, мокапов, PrintCheck, экспортной геометрии, данных или хранилищ.

## Резервные копии (созданы до правок)
- `backup-before-vectorcraft-button-centering-20261017-source` = `e0b14f4149c2a5db2f0b75ca88836cd5a499950f`.
- `backup-before-vectorcraft-button-centering-20261017-production` = `58160d9be0c69b8d1407d05216d9ed8eff031474`.

## Последняя ЗАМОРОЖЕННАЯ точка (не сдвигать docs-only commits)
- Source branch: `checkpoint-vectorcraft-apply-aligned-close-hidden-20261017-source` = `2e68977886a45845c2e00b880d39a290a6e1f325`.
- Production + compiled WASM branch: `checkpoint-vectorcraft-apply-aligned-close-hidden-20261017-production` = `eec24b5221f3a8926b2baf9655e9f2cc4e910848`.
- URL: https://tohaa28.github.io/gifts-layout-workbench-mockups/

## Проверки
- `39058337789`: GitHub Actions Publish Maketnaya with Mockups — **success** все стадии precheck / publish / browser_verify.
- `39057896809`: Build VectorCraft WebAssembly (Rust/egui) — **success**.
- `39058693564`: GitHub Pages — **success** (после публикации нового WASM).
- `39056115362`, attempt **3**, `browser_roundtrip`: настоящий опубликованный Chromium / WASM — **success**.
- Новый `tests/vectorcraft-parent-close-browser.mjs` проверяет реальный браузерный gifts.ru srcdoc-топологический случай: крестик скрыт при открытии VectorCraft, восстановлен после отмены, аналогично при открытии/закрытии прежнего редактора. Запускается из `.github/workflows/publish-maketnaya-mockups.yml` вместе с исходными регрессиями.
- Ранние прогоны precheck в ходе разработки падали только из-за тестовой геометрии / ожидания тестового iframe и заменены новым успешным полным прогоном. Нельзя выдавать их за дефекты итогового кода.

## Сохранность данных
`mockup-profiles.json` Git blob SHA: `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`.
`method-settings.json` Git blob SHA: `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
На момент финальной проверки source/main копии совпадают. Не переписывать серверные реестры при UI rollback.

## Файлы изменений
- `tools/patch-vectorcraft-gifts-theme.py`
- `assets/vectorcraft-integration.js`
- `assets/logo-editor.js`
- `editor.html`
- `tests/vectorcraft-gifts-theme.test.mjs`
- `tests/vectorcraft-parent-close-browser.mjs` (новый)
- `.github/workflows/publish-maketnaya-mockups.yml`

Правило: исходником считать `gifts-layout-workbench-mockups-source`, production — `main/gifts-layout-workbench-mockups/`. Все старые контрольные ветки сохранять. При следующем изменении свежие HEAD и server data SHA проверить заново.