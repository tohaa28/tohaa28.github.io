# Контрольная точка — заметная кнопка «Применить в Макетной» в штатной панели VectorCraft
Дата: 17 октября 2026 года.

## Причина изменения
Пользователь не находил кнопку «Применить в Макетной», ранее добавленную как плавающий egui::Area поверх холста, с привязкой RIGHT_TOP (-18,62). Такой элемент не был частью штатного верхнего меню и мог визуально теряться за панелями.

## Реализация
- `tools/patch-vectorcraft-gifts-theme.py` теперь внедряет кнопку `Применить в Макетной` в `crates/ui-egui/src/chrome.rs`, внутрь **родной верхней панели VectorCraft**, в правую группу рядом с поиском и выбором рабочего пространства. Кнопка зелёная, текст белый, собственная подсказка. Показ только при `single_field_mode` и открытом документе.
- При клике `egui::Context` получает `gwb_native_toolbar_apply`. Хост WASM извлекает событие и отправляет `gwb-vectorcraft-apply-request`.
- `assets/vectorcraft-integration.js` без изменений: origin/source/session проверка, тот же обработчик `s.apply.click()`, тот же art-only SVG, mm и placement-token guard; верхняя кнопка в оболочке Макетной остается.
- Плавающая кнопка `egui::Area` удалена; остальные настройки/инструменты и возможность полноэкранного режима сохранены.
- `tests/vectorcraft-gifts-theme.test.mjs` и `tests/vectorcraft-runtime-browser.mjs` обновлены: проверяется click по верхней полосе настоящего WASM (x=canvas.width-255,y=16), не по плавающему элементу.

## GitHub и проверки
- Резервные source/production: `backup-before-vectorcraft-apply-toolbar-20261017-source` (`3f063bc37eb3f898fd5b6bc9be651c1da1b8599c`) и `backup-before-vectorcraft-apply-toolbar-20261017-production` (`7a54ade50995414ef41c04e450cd13a0509ab182`).
- Новый замороженный source checkpoint: `checkpoint-vectorcraft-native-toolbar-apply-20261017-source` — `f94e450a9bfa84c70f01837769095e5439a26656`.
- Новый замороженный production checkpoint: `checkpoint-vectorcraft-native-toolbar-apply-20261017-production` — `58160d9be0c69b8d1407d05216d9ed8eff031474`.
- Реальный Rust/WASM build `39056063282` — **success**.
- Pages `39056837167` — **success**.
- Настоящий Chromium+WASM тест `39056115362`, **attempt 2 success**, с нажатием новой native toolbar кнопки и проверкой art-only SVG. Attempt 1 запустился до публикации нового WASM и тестировал прежний бинарник, поэтому не принят.
- Общая `Макетная` `39056115442` — **success** (precheck/publish/browser_verify).
- Данные source/main идентичны, blob SHA: `mockup-profiles.json` = `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` = `cbf6c8204e4fb3892d806342d37debefb8d9038e`.

## Правила продолжения
Не заменять текущие JSON данными из checkpoint; не менять printcheck, mockup cylinder, article↔constructor, field mm, logoBoundsMm и art-only SVG. Прежние скрытые переключатели не удалять из реализации. Перед новыми правками сравнивать HEAD source/main, делать snapshots/CI/live-WASM, сохранять новые реестры. Встроенная кнопка появляется только после загрузки документа; native standalone VectorCraft не меняется.
