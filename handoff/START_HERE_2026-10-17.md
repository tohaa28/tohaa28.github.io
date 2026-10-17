> **АКТУАЛИЗАЦИЯ после этого базового handoff, 17 октября:** UI VectorCraft получил скрытые переключатели old/native, fullscreen (Esc для выхода), настоящий Apply в egui и скрытие родительского «Закрыть Макетную». **Новая каноническая точка для продолжения:** [MAKETNAYA_VECTORCRAFT_IMMERSIVE_2026-10-17.md](MAKETNAYA_VECTORCRAFT_IMMERSIVE_2026-10-17.md), source checkpoint `checkpoint-maketnaya-vectorcraft-immersive-20261017-source`, production checkpoint `checkpoint-maketnaya-vectorcraft-immersive-20261017-production`. Сохраняйте описанные ниже более старые контрольные точки; не считайте их последней версией.

# АКТУАЛЬНЫЙ HANDOFF — Макетная / VectorCraft / PrintCheck / Редактор мокапов

**Срез:** 17 октября 2026 г. **ЭТО ГЛАВНЫЙ ДОКУМЕНТ ДЛЯ ПРОДОЛЖЕНИЯ В НОВОМ ЧАТЕ.** Он важнее старых `PROJECT_HANDOFF.md` и `CURRENT_HANDOFF_MAKETNAYA_PRINTCHECK.md` в части состояния 17 октября. Для архивных деталей продолжайте читать старые документы; НЕ стирайте их.

## 1. Что пользователь уже утвердил и что фактически работает

Веб-приложение «Макетная» на gifts.ru использует выбранные заказы, точные артикулы, принт-технологии, места нанесения и исходные конструкторы; позволяет добавлять/размещать логотипы, проверять макеты через PrintCheck, передавать составленные макеты редактору мокапов. Отдельный редактор «Редактор логотипа» интегрирован с настоящим VectorCraft Rust/WebAssembly в iframe.

**Последняя просьба пользователя была установить gifts.ru-оформление VectorCraft ПО УМОЛЧАНИЮ. Это УЖЕ СДЕЛАНО И ОПУБЛИКОВАНО.** Каждый новый запуск встроенного VectorCraft начинается с темы gifts.ru; справа от ссылки «Открыть прежний редактор» есть отдельный переключатель `Стиль gifts.ru ✓`. Его отключение возвращает исходный VectorCraft-вид. Оба режима содержат те же инструменты редактирования, переключение не создаёт новый документ, не стирает logo и Undo. Не предлагать повторно разрабатывать этот переключатель без нового запроса.

Встроенный VectorCraft работает строго с одним документом выбранного поля: New/Open/Recent/Close, Home, переключение/закрытие вкладок, Ctrl+N/Ctrl+O и повторный импорт документа заблокированы; File → Place разрешён для добавления графики к текущему рисунку. Вне Макетной обычный VectorCraft не ограничен.

Перед открытием редактора «Макетная» предоставляет реальный размер поля в **миллиметрах** и положение логотипа в поле. В VectorCraft можно редактировать исходный файл (где поддерживается импорт); после `Применить в Макетной` передаются ТОЛЬКО отрисованные объекты как SVG по визуальным границам (art bounds), **не** пустой рабочий лист. Отдельно возвращаются `logoBoundsMm:{x,y,w,h}` относительно поля. Исходный выбранный placement проверяется по токену; остальные поля не должны меняться. Повторное открытие ставит возвращённый логотип в прежнюю точку.

Всё это подтверждалось автотестами и опубликовано. Важно: не выдавать поддержку всех возможных AI/PDF/CDR/EPS за полную и без потерь; зависит от реального движка VectorCraft. WASM ~64,8 MB.

## 2. Канонические адреса и принцип разработки

- Репозиторий: https://github.com/tohaa28/tohaa28.github.io
- **ИСТОЧНИК КОДА**: ветка `gifts-layout-workbench-mockups-source`, каталог в её корне.
- **ПРОДАКШН**: ветка `main`, сайт в `gifts-layout-workbench-mockups/`.
- **Рабочий сайт**: https://tohaa28.github.io/gifts-layout-workbench-mockups/
- **VectorCraft iframe**: https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html
- **Upstream VectorCraft**: `storytold/vectorcraft`, pinned commit `8bc65329286dc1b84aa392997bb205613c3e96cb` (самостоятельная Rust/egui/Trunk сборка). Сохранять LICENSE-MIT, LICENSE-APACHE, NOTICE.
- Ветки `gifts-layout-workbench-source` и каталог `gifts-layout-workbench/` принадлежат более старому/другому режиму редактора. Не путать с текущим независимым `gifts-layout-workbench-mockups-source`.
- Источник данных заказа — **свежая** страница gifts.ru, а источник правильного сопоставления article ↔ constructor — «Макеты для заказа», вкладки «Загрузка макетов» / «Шаблоны макетов». Не использовать «согласование макетов» и не подменять реальное поле synthetic.

## 3. Замороженная новая контрольная точка перед передачей чата

Созданы ДВЕ НЕЗАВИСИМЫЕ ветки и проверены:

| Состав | Ветка GitHub | Зафиксированный commit |
|---|---|---|
| Исходный рабочий код | `checkpoint-maketnaya-gifts-theme-default-20261017-source` | `56e4d0815fe806f2a8669f06fa37110b1d688174` |
| Опубликованный сайт и готовый WASM | `checkpoint-maketnaya-gifts-theme-default-20261017-production` | `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01` |

**Правило:** docs-only commits для создания этого handoff продвинут source HEAD дальше `56e4d...`; этот SHA по-прежнему остаётся проверенной функциональной базой. Для новой работы обязательно перечитать текущий HEAD каждой ветки, не захардкодить прежний SHA. При откате UI НЕЛЬЗЯ вернуть старые `mockup-profiles.json`/`method-settings.json`, не сохранив свежие данные.

Предыдущая пользовательская контрольная точка для art-only VectorCraft: `checkpoint-maketnaya-vectorcraft-art-only-20261016-source` и `checkpoint-maketnaya-vectorcraft-art-only-20261016-production`. Старые backups и feature branches сохраняются.

## 4. Фактическая публикация и проверенные состояния

- Functional source HEAD на момент первичной сверки: `56e4d0815fe806f2a8669f06fa37110b1d688174` (исправление теста native-style toggle после установки gifts по умолчанию).
- Production main HEAD на момент первичной сверки: `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01`.
- Публикация `39050357382`: **success** на precheck / publish / browser_verify; Github Pages `39050426031`: **success**.
- Предыдущий `39050214178`: упал на Chromium-проверке цилиндрических мокапов; в последующем `39050357382` весь конвейер прошёл. Не выдавать старый упавший прогон за текущий статус.
- Настоящий VectorCraft Rust/WASM gifts/native: build `39021081065` **success**; живой browser test `39021992518` **success** (меняются пиксели настоящего egui, а не только внешний CSS, сохраняются SVG и один документ); общий CI `39021992566` **success**.
- Последняя установленная wasm-библиотека в production: `gifts-layout-workbench-mockups/vectorcraft/vectorcraft-web-387ea92584a5506a_bg.wasm`, Git blob `14cd24ee18a3be5d62bde0083dfbdfa41e720556`, файл ~64,8 MB. При релизе новой WASM обновится хэш имени.
- **Проверять заново** при каждом следующем изменении: git HEAD, jobs/logs, новый Pages deploy, data-registry SHA и экспорт в браузере. Состояние этого документа — не обещание о будущих релизах.

## 5. Неприкосновенные серверные данные

| Сущность | Канонический source path | Копия на сайте | SHA одинаков в source/main на 17.10 |
|---|---|---|---|
| Привязки фотографий/полей | `mockup-profiles.json` | `gifts-layout-workbench-mockups/mockup-profiles.json` | `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` |
| Настройки видов нанесения | `method-settings.json` | `gifts-layout-workbench-mockups/method-settings.json` | `cbf6c8204e4fb3892d806342d37debefb8d9038e` |

Перед rollback/rebase/publish: запросить свежие SHA обоих JSON в source и main. **Сохранить новые записи, даже если пользователь просит откатить UI.** Не хранить на публичном GitHub токены пользователя, пароли, персональные файлы и исходные логотипы клиентов. Не переносить устаревшие данные из snapshot-ветки поверх живых реестров.

## 6. Ключевые файлы и роли

- `editor.html`: основная HTML/JS оболочка Макетной; подключает `logo-path.js`, `logo-pdf-import.js`, `logo-editor.js`, `vectorcraft-field.js`, `vectorcraft-integration.js`. Текущая версия URL для интеграции: `?v=20261017-gifts-default-1`.
- `assets/vectorcraft-integration.js`: единственный встроенный fullscreen host, iframe, session token, origin/source guard, data transfer, кнопки Apply/Cancel/Простой редактор/Стиль gifts.ru; `giftsMode:true` при каждом открытии и `gwb-vectorcraft-theme` после ready.
- `assets/vectorcraft-field.js`: размер поля в mm, позиция рисунка в поле, подготовка SVG/растра для текущей монтажной области, fail-closed нормализация экспортированного art-only SVG.
- `tools/patch-logo-editor-bridge.mjs`: встраивает `gwbGetActiveLogoForEditor`, `gwbGetPdfLogoVectorOps`, `gwbApplyEditedLogoToActiveField` в сборочный bundle. Проверяет токен/размер/активное поле и не заменяет чужой логотип.
- `assets/logo-editor.js` + `assets/logo-path.js` + `assets/logo-pdf-import.js`: сохранённый упрощённый редактор, отдельная опция (не удалять).
- `tools/vectorcraft-bridge.rs`: byte-level Rust bridge для импорта/экспорта через postMessage, выбранный art-only bounding box, single-document guard, команды переключения gifts/native и восстановления тем.
- `tools/patch-vectorcraft-upstream.py`: патч исходников pinned VectorCraft под мост передачи данных и mm.
- `tools/patch-vectorcraft-single-field.py`: блокировка New/Open/Recent/Close/Home в embedded mode, разрешение Place.
- `tools/patch-vectorcraft-gifts-theme.py`: реально перекрашивает Rust egui UI, зелёно-белый gifts-скин. Не копировать стили на canvas HTML: VectorCraft рендерит интерфейс в WASM.
- `tools/build-launcher.mjs`: собирает/переписывает srcdoc/launcher на GitHub Pages, учитывает preflight и bridge. Не редактировать hand-generated main как «исходник».
- `mockup.html` и связанные assets: редактор мокапов, в т.ч. цилиндрическая развёртка; данные профилей отдельны.
- `assets/method-settings-server.mjs` и `method-settings.json`: общие серверные параметры нанесений.
- PrintCheck: интеграция технических проверок, исходные требования в `PRINTCHECK_HANDOFF_2026-10-08-v25.md` и `handoff/MAKETNAYA_PRINCIPLES_2026-10-13.md`.

## 7. Как собирать и публиковать

1. Сверить source/main и JSON blob SHA. Создать ПАРУ backup source/main перед любой крупной правкой.
2. Работать в feature branch либо в source с отдельными checkpoint; никогда не начинать с `main` как исходника.
3. После изменения JavaScript/launcher: запустить полные релевантные unit и browser regression; главная GitHub Actions: `.github/workflows/publish-maketnaya-mockups.yml` → precheck → publish → browser_verify.
4. После изменения Rust, egui или скриптов патчинга VectorCraft: workflow `.github/workflows/build-vectorcraft-web.yml` → pinned upstream checkout → patch bridge → patch single-field → patch gifts-theme → Rust wasm32/Trunk → smoke → publish binary в `main/gifts-layout-workbench-mockups/vectorcraft/`. Затем выполнить **реальный** `.github/workflows/test-vectorcraft-runtime.yml` ПОСЛЕ Pages deployment.
5. Скрипт обычной публикации сохраняет отдельную папку собранного WASM в `main`, но всё равно проверять, что нужный `.wasm` не затёрт старым release.
6. Не считать тест с mock iframe в `tests/vectorcraft-handoff-browser.mjs` доказательством работоспособности Rust-компонента: для Rust нужен реальный `tests/vectorcraft-runtime-browser.mjs` (на опубликованном WASM).
7. Проверять `gifts.ru` запуск, геометрию поля и отредактированного SVG, соседние поля, реестры и взаимодействие с мокапами. Если один тест красный, изучить лог и исправить, не объявлять успех.

## 8. Инварианты, которые нельзя сломать

- Не подменять артикулы/места нанесения общими именами; точный article ↔ constructor и `[print1]`, `[print2]` по исходному шаблону.
- Поле находится только в конструкторе; исключены таблица, служебный зелёный блок, синтетические bounding fields.
- Логотип возвращается как **art-only SVG** с фактическими `logoBoundsMm`, а не SVG размером в поле. Поле задаёт только рабочую область VectorCraft.
- Блокировка нового документа относится ТОЛЬКО к embedded VectorCraft. Исходный VectorCraft вне Макетной и возможность File → Place сохраняются.
- Gifts-стиль по умолчанию; отдельный переключатель на исходный стиль рядом с «Открыть прежний редактор». При смене темы нельзя пересоздавать документ или терять Undo.
- Сохранять поворот/clip/масштаб без второй трансформации после возврата; не заменять рисунок другого поля при смене выделения.
- Все изменения PrintCheck изолировать от мокапов и интерфейса заказов; тонкие линии/пробелы проверяются в реальных mm и на растровых/векторных логотипах.
- Для цилиндрических мокапов учитывать развёртку, перспективу/обратную проекцию, отсекаемую невидимую часть и нормальные пропорции; не восстанавливать старую ошибку с растяжением и смещением логотипа.

## 9. Что НЕ следует считать завершённым без новых тестов

- Полная безошибочная правка любого PDF, AI, EPS или CDR не подтверждена. Специфичные форматы, шрифты, spot/Pantone, клиппинг, растровые части требуют отдельных регрессий и реальных файлов.
- Полная точность PrintCheck для всех сложных логотипов не подтверждена; прошлые сообщения отмечали ложные срабатывания и пропуски тонких позитивных/негативных элементов.
- Не гарантировать, что новое действие пользователя автоматически тестируется реальными клиентскими заказами; CI fixture проверки не заменяют профессиональную приёмку на настоящем PDF и сайте gifts.ru.

## 10. История и куда обращаться

Сначала читать ЭТОТ файл, затем `MAKETNAYA_STATE_2026-10-17.json`, `DEVELOPMENT_HISTORY_2026-10-17.md` и `NEW_CHAT_PROMPT_2026-10-17.md` в этом каталоге.

Исторические детали: `handoff/MAKETNAYA_VECTORCRAFT_GIFTS_THEME_2026-10-17.md` (ВАЖНО: первоначальный раздел описывает native-default ДО новейшей правки; теперь **gifts-default**), `handoff/MAKETNAYA_VECTORCRAFT_SINGLE_FIELD_2026-10-16.md`, `handoff/MAKETNAYA_VECTORCRAFT_ART_BOUNDS_2026-10-16.md`, `handoff/MAKETNAYA_VECTORCRAFT_FIELD_MM_2026-10-16.md`, `handoff/MAKETNAYA_VECTORCRAFT_WASM_2026-10-16.md`, `handoff/MAKETNAYA_SHARED_SERVER_METHOD_SETTINGS_2026-10-15.md`, `handoff/MOCKUP_CYLINDER_DEVELOPMENT_2026-10-14.md`, `handoff/MAKETNAYA_PRINCIPLES_2026-10-13.md`, `PRINTCHECK_HANDOFF_2026-10-08-v25.md`.

**Старт новой переписки:** вставить содержание `NEW_CHAT_PROMPT_2026-10-17.md` или дать ссылку на этот HANDOFF. Сначала проверить GitHub SHA, затем выполнять новое задание пользователя сразу с резервированием/тестами/публикацией.
