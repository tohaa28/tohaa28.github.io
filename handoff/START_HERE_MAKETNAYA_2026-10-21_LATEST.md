# МАКЕТНАЯ — ГЛАВНЫЙ HANDOFF В НОВЫЙ ЧАТ (обновлён 22.10.2026)

> **Самая новая проверенная точка: 22.10.2026, исправление растра CMYK внутри Rust-движка TraceDraw.** Функциональный source `8dbcb1213b4a7ebbf0beeb3f02b446c2ec19eedf`; production `fc250443923f4fae660913c53a3bb16a60dcd601`. Макетная **r024116c7**, TraceDraw web **0.9.4-gifts-raster-cmyk1**, PrintCheck **v25 re1f43fb8**. Ядро исправлено в `a666448d`, WASM собран из `20f841c5`: команда режима и Convert to Bitmap теперь записывают реальные 4 канала CMYK в PDF, сохраняя alpha, размеры и исходный PNG. Не маскировать реальные RGB-объекты: конвертируются только выбранные растры. Native build **39679316542**, публикация **39682223950** (все три jobs), реальное меню WASM **39682223824**, Pages **39682408171**: SUCCESS. Проверены RGB ↔ CMYK, alpha, позиция, Undo/Redo и смешанный растр/вектор. Контрольные ветки `checkpoint-tracedraw-raster-cmyk-20261022-source` и `checkpoint-tracedraw-raster-cmyk-20261022-production`. Прочитать [MAKETNAYA_TRACEDRAW_RASTER_CMYK_2026-10-22.md](MAKETNAYA_TRACEDRAW_RASTER_CMYK_2026-10-22.md): там архитектура, ограничения и прежний Windows-сбой шрифтового теста. Документационные коммиты могут сдвинуть HEAD после указанного функционального source. Все следующие точки восстановления в этом файле исторические; продолжать от этой новой точки и актуального HEAD, сохраняя registry-данные.

> **Обновление после нового проверенного релиза 21.10.2026.** Более новая функциональная точка: source `cd66260b568f84111ad21b659c99c41b7b632622`, production `2a98bc69fcc547f11db2ef6621d75314f32bf84f`. PrintCheck **v25 re1f43fb8**, Макетная **r7fa6f062**. Четыре новые PDF-регрессии исправлены: состояние цветов между потоками, q/Q, наследование и повторные вызовы Form, ложные Do из комментариев/строк. Проверены повторные возвраты RGB → CMYK → RGB с сохранением байтов и завершением нового сканирования. 204 unit tests; CI **39670411186** (все три jobs SUCCESS), Pages **39670609827 SUCCESS**. Контрольные ветки: `checkpoint-colors-20261021-source`, `checkpoint-colors-20261021-production`. История и границы проверки: [MAKETNAYA_PDF_COLOR_STATE_2026-10-21.md](MAKETNAYA_PDF_COLOR_STATE_2026-10-21.md), [PROJECT_HISTORY_MAKETNAYA.md](../PROJECT_HISTORY_MAKETNAYA.md). Сведения о точке восстановления ниже описывают предыдущий релиз; для продолжения использовать эту новую точку и актуальный HEAD исходной ветки. Конкретный пользовательский логотип и живая авторизованная сессия по-прежнему не проверены.


> **Начинайте отсюда.** Этот документ отменяет только устаревшие указания о текущем релизе в handoff от 17–20 октября; всю предыдущую историю НЕ удалять. Продолжать разработку от реально проверенной версии, без стирания пользовательских данных.

## 1. Точная точка восстановления

- Репозиторий: https://github.com/tohaa28/tohaa28.github.io
- Каноническая ветка исходников: **gifts-layout-workbench-mockups-source**.
- Последний проверенный **функциональный** source commit: **8ef0ade6161fa8bfc21c2398532a84de824a7263**. После него была только документация о цветах: **6eff90fe5b687a2b64cf30efe02ffd92306528d3**.
- Контрольная ветка ДО этого нового пакета: **checkpoint-maketnaya-newchat-20261021-prehandoff-source** → **6eff90fe5b687a2b64cf30efe02ffd92306528d3**.
- Опубликованный production, ветка **main**, каталог **gifts-layout-workbench-mockups/**: **6010440328ed7c4ebcacc65f237bdc163e5f2f21**.
- Контрольная ветка production: **checkpoint-maketnaya-newchat-20261021-production** → **6010440328ed7c4ebcacc65f237bdc163e5f2f21**.
- Версия сайта: **Макетная r7fa6f062**; PrintCheck **v25 rb14f6d50**.
- Production: https://tohaa28.github.io/gifts-layout-workbench-mockups/ — запускать рабочий редактор **в авторизованной вкладке gifts.ru через закладку**.
- Нативные WASM страницы: /vectorcraft/index.html и /tracedraw/index.html в production-каталоге.
- Исходные upstream-ссылки: VectorCraft **8bc65329286dc1b84aa392997bb205613c3e96cb**, TraceDraw **0f206489770adcacc6cc130a9e31a5610faad68a** (взято из опубликованных UPSTREAM_COMMIT).
- GitHub Actions **39607112412**: precheck **SUCCESS**, publish **SUCCESS**, browser_verify **SUCCESS**.
- Настоящий VectorCraft WASM браузерный тест **39606367485 SUCCESS**; сборка Rust VectorCraft **39604822142 SUCCESS**; TraceDraw реальный WASM тест **39598798699 SUCCESS**, его сборка с guard **39598763127 SUCCESS**.
- После добавления данного пакета HEAD исходной ветки сдвинется на документационные коммиты. Не путать это с функциональным source commit; production НЕ менять ради handoff.

## 2. Самое важное про текущую RGB/CMYK задачу

Последний пользовательский отчёт: «В редакторе перевожу CMYK в RGB и возвращаю в Макетную, а PrintCheck всё равно находит RGB. Видимо есть какая-то трансформация цвета. Найди и исправь».

**Смысловая неоднозначность:** CMYK → RGB означает, что RGB должен остаться, и тогда PrintCheck корректно его обнаруживает. Возможно, подразумевалось **RGB → CMYK** с ожиданием исчезновения предупреждения. НЕЛЬЗЯ автоматически маскировать RGB, подменять анализ метаданными документа или объявлять отсутствие RGB только из-за названия режима.

**Уже реализовано, CI проверил в новом релизе r7fa6f062:**
1. VectorCraft Rust bridge (tools/vectorcraft-bridge.rs) ранее устанавливал поле color_mode=Cmyk, не конвертируя цвета. Теперь вызывает штатную нативную команду VectorCraft file.documentColorMode с параметрами mode=cmyk, convert=true. Это преобразование CMS, а не смена надписи режима.
2. Экспорт VectorCraft передаёт настоящую модель документа CMYK/RGB, а не всегда CMYK; RGB и смешанные PDF возвращаются с исходными операторами.
3. PrintCheck (assets/logo-preflight.mjs) ранее считал любые RGB установки цвета в PDF, даже если они не были использованы для рисования, и неиспользованные XObject-ресурсы. Теперь pdfAppliedPaintOperators и inspectPdfColors учитывают реально рисуемые операции, стек q/Q и фактически вызываемые XObject через Do. Неиспользуемые RGB ресурсы не дают ложное предупреждение; реальные используемые RGB не скрываются.
4. Принимающий мост (tools/patch-logo-editor-bridge.mjs) записывает модели, найденные в **новом PDF**, в gwbPrintCheckLastEditorReturn.originalColorModels и немедленно перезапускает PrintCheck; исправлена область видимости, вызывавшая ReferenceError next is not defined.
5. Исчерпывающая техдокументация: [MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md](MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md).

**НЕ ПРОВЕРЕНО в браузере пользователя:** реальный конкретный макет и реальный выбранный переход RGB ↔ CMYK. Первое действие после нового чата — уточнить **направление конверсии** и провести тест оригинальных PDF-операторов до/после на том файле, если проблема повторится. Автоматические тесты и live WASM уже зелёные, повторно выполнять такую же работу с нуля без воспроизведения не нужно.

## 3. Архитектура и канонические файлы

**Приложение:** пользователь в gifts.ru → bookmarklet из launcher.js, созданного tools/build-launcher.mjs → iframe с editor.html и встроенным direct-mode.js (Same Origin) → заказы, артикулы, место с точным кодом, соответствующий конструктор → поле шаблона, логотип и редакторы → PrintCheck → PDF → сохранение в заказ.

- editor.html: авторский HTML интерфейса.
- direct-mode.js: адаптер авторизованного gifts.ru, чтение корзины и макетов, проверенные API для PDF. Не обращаться к «согласованию макетов».
- assets/index-BpU9kvz8.js: базовый скомпилированный PDF.js/UI движок. **Не править вручную**: защищённая сборка последовательно накладывает инструменты патчей и проверяет hash исходного кода.
- tools/build-launcher.mjs: единая точка сборки. Порядок: applyLogoPreflight → applyLogoEditorBridge → applyPlacementHistory → applyLogoDrop → applyUploadedMaketsBridge → applyMaketnayaProvenance → stampComponentVersions.
- tools/patch-artwork-preflight.mjs: защищённый patch с исходной hash-стражей; assets/logo-preflight.mjs, assets/logo-color.mjs, assets/logo-detail-check.mjs, assets/logo-detail-engine.mjs и worker — PrintCheck.
- tools/patch-logo-editor-bridge.mjs: единый gwbGetActiveLogoForEditor() и gwbApplyEditedLogoToActiveField() с проверкой токена заказа/артикула/поля, размера и PDF, повторной проверкой PrintCheck.
- assets/vectorcraft-integration.js, assets/vectorcraft-field.js, tools/vectorcraft-bridge.rs: VectorCraft WASM; документ привязан к выбранному полю в миллиметрах, только artwork без шаблона, возврат вектор/растр и реальных цветов PDF.
- assets/tracedraw-integration.js, assets/tracedraw-raster-bridge.js, tools/tracedraw-embedded.rs: TraceDraw Rust/WASM; до импорта SVG растры JPEG/WebP преобразуются в PNG (движок ждёт PNG), native PDF экспорт + защита от потери bitmap.
- assets/cmyk-roundtrip.js: проверяет цветовые операторы печатного PDF, RGB/CMYK/Mixed, не перекрашивает и не заменяет оригинальные байты.
- assets/order-uploaded-makets.js, tools/patch-order-uploaded-makets.mjs: доступ к PDF в «Загрузка макетов», идентификаторы вложений, редактирование только выбранного поля, «Сохранить макет в заказ на gifts.ru» и «Сохранить как.. макет в заказ на gifts.ru».
- assets/maketnaya-pdf-provenance.js: скрытый переносимый служебный блок внутри PDF (сжатый GZIP, не шифрование!), отдельные исходники логотипов и SHA-256; узнаваемый значок «М», совместимость со старыми файлами.
- assets/editor-return-progress.js: проценты подтверждённых стадий и блокировка взаимодействий до завершения переноса из редакторов.
- assets/template-selection-tool-lock.js: отключение инструментов логотипа при выборе шаблона; разрешение после выбора поля.
- mockup.html, assets/mockup-cylinder.mjs, assets/editor-mockup-transition.*: мокапы, изображения изделий, цилиндрические поверхности/развёртки, перспектива.
- server/personal-layouts/index.mjs: прототип персональной PDF-библиотеки; нельзя объявлять реальную серверную авторизацию gifts.ru подключённой без проверки доверенного серверного proxy.
- tests/: модульные и браузерные регрессии. Основной CI: .github/workflows/publish-maketnaya-mockups.yml; самостоятельные Rust/WASM сборки .github/workflows/build-vectorcraft-web.yml и build-tracedraw-web.yml.

## 4. Действующие требования

- Чтение заказов только из сайта gifts.ru и «Макеты для заказа»; не открывать «Согласование макетов». Не создавать вымышленных полей. Использовать точные коды и имена нанесений, выбранные заказчиком.
- Заказ → артикул → место нанесения → конструктор/поле → один или несколько логотипов. При одном артикуле показывать сначала полный шаблон, потом выбор поля.
- Поля получаются из цветных полей PDF, запасной метод ≈98%-opacity и реальные формы, не только bounding box. Зеленый служебный блок и таблица должны исключаться.
- PrintCheck: размер поля и защитное поле, мин. позитивные элементы/перемычки, выворотка, растр/вектор, разрешение, шрифты, эффекты, градиенты, прозрачность, цветовость по виду нанесения, фактические краски в заказе. Часть «мелких элементов» остаётся предметом пользовательских QA кейсов.
- Если в заказе конкретно перечислены цвета печати, для ряда способов нужен вектор; если нет, растр сам по себе не считать дефектом без других оснований.
- При возврате из VectorCraft или TraceDraw — только отдельный логотип, НЕ шаблон/фон; геометрия и размеры в мм, исходные краски и растр сохраняются, PrintCheck повторяется; действия заблокированы на время передачи.
- PDF из Макетной должен быть распознаваем в другом экземпляре; старые PDF без бинарного блока нельзя автоматически считать происхождением Макетной.
- «Сохранить» — безопасная замена выбранного старого PDF после проверки нового; «Сохранить как…» — новый файл. В API нет подтверждённого атомарного overwrite: загрузить новый ID → проверить → удалить лишь старый разрешённый ID. Если удаление упало, сохранить обе версии, не заявлять успех.
- Пользовательская персональная библиотека PDF и маппинг мокапов не должны попасть в публичный репозиторий; GitHub хранит только разрешённые общие данные настроек.
- Современный интерфейс gifts.ru, анимация дверей при запуске и «Визуализируй это» для мокапов, точный русский текст кнопок. Версия должна обновляться при каждом функциональном релизе.

## 5. Безопасность данных и проверенная консистентность

- mockup-profiles.json: SHA **750a78701bbba0ea82ec59fd95f78b01dfd37026** в source и production.
- method-settings.json: SHA **cbf6c8204e4fb3892d806342d37debefb8d9038e** в source и production.
- Никогда не делать безусловный git reset/rebase на main или source с заменой пользовательских JSON.
- Не публиковать личные PDF, токены, cookies или HTML приватных заказов. Не выполнять реальное удаление вложений заказов в тестах.
- Для функциональной задачи создать новые backup branches от **текущих** SHA обеих веток, а затем source и production checkpoints после CI.
- Убедиться в успешности **всех трёх** jobs precheck / publish / browser_verify, а при изменении Rust — отдельной сборки и живого WASM-теста.
- Историю предыдущих версий не стирать: все старые файлы handoff остаются в этом source ZIP.

## 6. Читаем сначала эти документы

1. Этот START_HERE.
2. [MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md](MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md) — последний актуальный функциональный релиз.
3. [MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md](MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md) — подробная хронология и ссылки на исходные решения.
4. [MAKETNAYA_NEXT_STEPS_2026-10-21.md](MAKETNAYA_NEXT_STEPS_2026-10-21.md) — проверка RGB и оставшиеся риски.
5. [MAKETNAYA_STATE_2026-10-21.json](MAKETNAYA_STATE_2026-10-21.json) — машинный манифест SHA, CI, путей и контрольных веток.
6. [NEW_CHAT_PROMPT_2026-10-21.md](NEW_CHAT_PROMPT_2026-10-21.md) — текст первого сообщения для следующего чата.

## 7. Сначала сделать в новом чате

1. Прочитать все шесть актуальных файлов и последнюю PDF/Color запись; **не** работать по старому handoff как по latest.
2. Сверить текущие GitHub HEAD с frozen checkpoints и прислать актуальные SHA.
3. Точно выяснить, нужна ли конверсия **RGB → CMYK** или **CMYK → RGB**, и проверить на конкретном логотипе; RGB не скрывать.
4. Если воспроизведён новый дефект, сделать test-first регрессию реальных PDF paint commands, Raster XObject и ICC; затем только точечное исправление с backup.
5. Сохранить работоспособность PrintCheck, мокапов, заказа, pdf-provenance, двух редакторов, библиотеки и CI. Пользовательских PDF не удалять.
