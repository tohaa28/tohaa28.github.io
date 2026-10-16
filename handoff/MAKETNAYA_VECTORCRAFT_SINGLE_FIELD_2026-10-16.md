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

## Выполнено: новая версия на сервере и реальная проверка
- WASM compile `38932824347` — **success**, опубликован `vectorcraft-web-8aa77405a779ea3a_bg.wasm`, Git blob `647fae7a79c22a40fe2ae49092507e4fa013a994`, 64,749,215 байт.
- GitHub Pages deploy `38934228229` — **success**.
- Повторный Chrome/real WASM `38934948061` — **success**: успешное `gwb-vectorcraft-opened` исходного 120×80 мм рабочего листа, попытки Ctrl+N / Ctrl+O / Ctrl+Shift+N, заведомо второй `gwb-vectorcraft-open` отклонён движком (проверено полученное сообщение об ошибке), в исходном документе оставался только прямоугольник 40×18 мм при смещении 12×8 мм, SVG экспортирован правильно, `browserErrors: []`.
- Ранние проверки `38932824277`, `38934480216`, `38934672027` были запущены до/во время выкладки или включали ошибку классификации ожидаемого отказа второго документа тестом. Окончательный зелёный прогон `38934948061` проверяет актуальный опубликованный WASM и точную семантику отказа.
- Публикация полной Макетной `38932824292` — success с browser_verify. После обновления тестового скрипта повторная публикация `38934948122`: проверить окончательный browser_verify conclusion.
- Сверка реестров в `source` и `main`: `mockup-profiles.json` = `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, `method-settings.json` = `cbf6c8204e4fb3892d806342d37debefb8d9038e`, оба неизменны.
- Контрольная точка пользователя до новой функции (двойная копия): `checkpoint-maketnaya-vectorcraft-art-only-20261016-source` и `checkpoint-maketnaya-vectorcraft-art-only-20261016-production`; дополнительно специальные предизменённые backups текущей правки сохранены.
