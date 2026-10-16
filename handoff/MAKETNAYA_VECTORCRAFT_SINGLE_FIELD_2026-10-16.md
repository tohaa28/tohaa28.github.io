# Макетная × VectorCraft — работа строго с одним документом / полем нанесения
Дата: 16.10.2026

## Запрос
При входе в VectorCraft из выбранного поля «Макетной» разрешить только правки текущего размещённого логотипа. Отключить создание/открытие новых документов и переключение между ними. Не ухудшать инструменты редактирования SVG, работу с объектами и возврат логотипа по фактическому визуальному габариту.

## Независимые точки безопасного отката
- Источники до правки: `backup-before-vectorcraft-one-document-20261016`, SHA `cfad0363459df603fa3ad03e182f3d0ccc56860c`.
- Опубликованная «Макетная» / WASM до правки: `backup-published-before-vectorcraft-one-document-20261016`, SHA `55b4674ed444ec8eb5e43f4c96e55fd269f2d81e`.
- Отдельная feature-ветка разработки: `feature-vectorcraft-one-document-20261016`.
- Не трогать server registries `mockup-profiles.json` и `method-settings.json` при откатах: всегда сравнивать с актуальным `main`.

## Техническая реализация
1. `tools/patch-vectorcraft-single-field.py`: применяет SHA-проверяемые уникальные контекстные патчи к зафиксированному upstream `storytold/vectorcraft`. В `VectorcraftApp` введён `single_field_mode`, он `false` по умолчанию и включён исключительно для встроенного iframe с URL-хэшем `#gwb=...`. Так самостоятельный VectorCraft остаётся свободным редактором.
2. В `VectorcraftApp::run` из единой точки диспетчеризации **отклоняются** команды `file.new`, `file.newDialog`, `file.newFromTemplate`, `file.open`, `document.open`, `document.new`, `file.openRecent*`, `file.close`, `file.closeAll`, `app.home`, `app.quit`, даже через клавиатурные комбинации и палитру команд.
3. На уровне UI скрыты кнопка Home, вкладки документов с кнопками закрытия; меню File не показывает New/Open/Recent/Close. `File → Place` и остальные инструменты позволяют добавлять графику **в текущий** логотип.
4. Встроенный WebShell блокирует drag-and-drop файлов с созданием нового документа. `VectorcraftApp::drain_inbox` не открывает дополнительные файлы, если документ уже есть, при этом штатный `place_inbox` продолжает работать для текущего документа.
5. `tools/vectorcraft-bridge.rs`: `bridge_document_received` защищает от повторного `postMessage(gwb-vectorcraft-open)` даже при подделанном имени и правильном токене. Отправка SVG назад разрешена, только если в сессии ровно один документ. Физические размеры и `art_bounds` передаются, как прежде.
6. `tools/patch-vectorcraft-upstream.py` добавляет shared `bridge_document_received` к Host (добавляется после оригинального install bridge). `.github/workflows/build-vectorcraft-web.yml` применяет обе upstream-поправки в порядке: I/O bridge → one-doc mode → Trunk WASM.
7. `tests/vectorcraft-single-field.test.mjs` делает статические проверки ограничений и различия embedded/standalone. `tests/vectorcraft-runtime-browser.mjs` в реальном опубликованном WASM отправляет Ctrl+N / Ctrl+O / Ctrl+Shift+N, повторный postMessage открытия SVG, подтверждает отклонение второго документа и проверяет экспорт первоначального векторного рисунка 40×18 мм на смещении 12×8 мм.

## Тесты и публикация
Контрольный успешный baseline до изменений: `38913278617` (реальный art-bounds VectorCraft) и `38912383028` (Макетная целиком).
После изменений:
- Публикация Макетной `38932824292` — необходимо проверить итог всех jobs.
- Компиляция VectorCraft `38932824347` — **не заявлять успех**, пока Rust/Trunk compiler, browser smoke и push в main не выполнены.
- Live test `38932824277` запустился до выпуска нового WASM и ожидаемо провалил повторный импорт. Он должен быть **повторён после Pages deployment нового WASM**, а успех нового прогона записан сюда.
