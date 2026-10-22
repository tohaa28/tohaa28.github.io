# МАКЕТНАЯ — ГЛАВНЫЙ HANDOFF ДЛЯ НОВОГО ЧАТА
Обновлено 22 октября 2026. Этот документ — актуальная точка входа, а не замена историческим handoff-файлам.

## 0. Главное правило
Восстановить контекст из **этой зафиксированной версии GitHub**, прочитать связанные документы, сверить актуальные HEAD перед любым изменением. Не считать последнее пользовательское замечание об RGB/CMYK автоматически решённым по одному успешному CI. Не менять production и пользовательские файлы ради чтения документации.

## 1. Репозиторий и ТОЧНЫЕ контрольные точки на момент handoff
- GitHub: https://github.com/tohaa28/tohaa28.github.io
- **Канонический source**: ветка gifts-layout-workbench-mockups-source, функционально завершённый HEAD **8b2b7729df1f2ce140125275a1a291c6f775e33d**. Новый handoff добавляет только документацию; HEAD может сдвинуться.
- **Production**: ветка main, каталог gifts-layout-workbench-mockups/, SHA **fc250443923f4fae660913c53a3bb16a60dcd601**.
- Сохранены контрольные ветки **checkpoint-maketnaya-nextchat-20261022-source** (SHA 8b2b7729...) и **checkpoint-maketnaya-nextchat-20261022-production** (SHA fc250443...).
- Published https://tohaa28.github.io/gifts-layout-workbench-mockups/ — реальная работа через bookmarklet в авторизованном gifts.ru.
- Production UI: **Макетная r024116c7**, **PrintCheck v25 re1f43fb8**, TraceDraw web **0.9.4-gifts-raster-cmyk1**.
- Upstream pinned: VectorCraft **8bc65329286dc1b84aa392997bb205613c3e96cb**; TraceDraw **0f206489770adcacc6cc130a9e31a5610faad68a**.
- TraceDraw production RASTER_CMYK_REVISION: raster-cmyk-v1, source=20f841c5005097d8905810ed6a519a38223e9f28.
- Рабочие данные должны быть неприкосновенны: mockup-profiles.json (Git blob SHA 750a78701bbba0ea82ec59fd95f78b01dfd37026), method-settings.json (Git blob SHA cbf6c8204e4fb3892d806342d37debefb8d9038e). Перед handoff эти SHA совпадали в source и production.

## 2. Факт проверки CI
1. Publish Maketnaya with Mockups: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682223950 — **precheck SUCCESS**, **publish SUCCESS**, **browser_verify SUCCESS**.
2. Verify live TraceDraw WASM: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682223824 — **SUCCESS**, реальное меню RGB → CMYK → RGB и сохранение четырёхканального DeviceCMYK bitmap в PDF, alpha, размеров, Undo/Redo.
3. Build TraceDraw WebAssembly: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39679316542 — **SUCCESS**, cargo/native/clippy/WASM под закреплённым toolchain.
4. GitHub Pages deployment: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682408171 — **SUCCESS**.
5. Реальный VectorCraft WASM: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39606367485 — **SUCCESS**; Rust WASM build 39604822142 SUCCESS.
6. PDF color state regression: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39670411186 — **SUCCESS**.
Успех CI не доказывает корректность любого неизвестного пользовательского PDF и авторизованных файлов настоящего заказа.

## 3. История продукта и действующие требования
Макетная — веб-приложение для заказа подарочной продукции Gifts: bookmarklet внедряет интерфейс в gifts.ru, читает корзину после авторизации, группирует заказы, автоматически выбирает единственный артикул, открывает конструктор изделия целиком, затем пользователь выбирает поле и загружает логотип. Имеются стандартный и продвинутый режимы, анимации переходов, размеры полей в мм, работа с несколькими полями и многостраничными PDF, обрезка, масштабирование, поворот, drag-and-drop, Undo/Redo и скачивание готового PDF.

- PrintCheck: проверка технических требований по способу/месту нанесения и данным заказа, vector/raster, цвета и их количество, CMYK/RGB/spot, разрешение, геометрия, безопасные поля, шрифты, прозрачности, мелкие линии/перемычки/выворотка. Изолирован от конструктора и служебных зон. Результат по каждому полю, разметка дефектов и «поиск мелких элементов…». Повторно запускается после реального возврата нового PDF из VectorCraft/TraceDraw; не наследовать старый результат и не объявлять макет правильным без проверки. Серверные настройки нанесений действуют для всех пользователей.
- VectorCraft: отдельный WASM редактор, интерфейс gifts, работает в поле (без нового документа), PDF native-передача туда/обратно, реальные bounds и масштаб, без белого листа, поддержка RGB/CMYK, смешанных вектора и растра. Возврат через «Перенести на шаблон артикула».
- TraceDraw: второй редактор с таким же выбором и передачей; встроенные JPEG/WebP в SVG перед импортом конвертируются в PNG, геометрия сохраняется. Rust-патч поддерживает **реальное** преобразование растровых объектов RGB ↔ CMYK при Bitmap > Mode / Convert to Bitmap и PDF DeviceCMYK на четырёх каналах. RGB других объектов не принудительно изменяется. RGB/CMYK не маскировать, а инспектировать по реальному PDF. Прогресс передачи показывается по этапам; до завершения редакторы и действия блокируются.
- Редактор мокапов: фотографии изделий по артикулу, индивидуальные привязки фото↔поле, несколько мокапов на место, цилиндрические объекты и корректная перспективная проекция. Не добавлять фон при сохранении.
- PDF заказа: новые PDF из Макетной содержат переносимую сжатую бинарную метаинформацию и отдельные PDF исходников логотипа; без открытого JSON в свойствах PDF. Значок «М» у распознанных вложений. При повторном открытии отделять собственно логотип от шаблона. Старые PDF без данных направлять к редактору.
- Кнопки «Сохранить макет в заказ на gifts.ru» и «Сохранить как.. макет в заказ на gifts.ru». Сохранить существующий PDF = безопасно загрузить новый файл, подтвердить новый ID и только затем удалить конкретную старую версию. Это не атомарный update, сбой оставляет обе копии. НИКОГДА не тестировать удаление на реальном заказе без разрешения.
- Персональные сохранённые макеты и серверная библиотека — проверять реальные права хранения и авторизации, не выдавать IndexedDB за полноценное серверное приватное хранилище.

## 4. Последняя цветовая проблема — главный нюанс продолжения
Дословное сообщение пользователя: «в редакторе перевожу cmyk в rgb и нажимаю на кнопку возврата в макетную, а принтчек все равно находит rgb. видимо есть какая-то трансформация цвета. найди и исправь».

**Если оператор действительно преобразовал CMYK → RGB, PrintCheck обязан обнаружить реально нарисованный RGB**, когда правила нанесения его запрещают. Для устранения RGB нужно преобразовать **RGB → CMYK для объектов**, не просто переименовать рабочий режим документа. Направление операции остаётся неоднозначным; нельзя отключать проверку RGB ради зелёного статуса.

После этого сообщения в исходниках уже появились и были проверены:
- VectorCraft: при создании CMYK документа команда CMS file.documentColorMode с convert=true вместо простого изменения metadata; реальная модель экспортируемого PDF, не название интерфейса.
- PrintCheck assets/logo-preflight.mjs: учитывает лишь реально рисующие RGB/CMYK операторы, используемые XObjects; неиспользованные ресурсы и setColor без paint не дают ложных предупреждений. Исправлены Contents arrays, q/Q сквозь потоки, наследование цветов в Form XObject и вызовы через Do, поиск в очищенном PDF-потоке.
- TraceDraw: tools/tracedraw-raster-cmyk.patch преобразует **пиксели** Bitmap CMYK и создаёт DeviceCMYK Image XObject, с сохранением alpha/размеров/Undo/Redo. Не путать это с CMYK-меткой SVG или цветовым режимом страницы.
- Привязка PrintCheck повторно анализирует именно PDF нового логотипа, а не кэш старого или цвет предпросмотра.

**ОТКРЫТО**: конкретный пользовательский логотип, выбранная команда/направление, в каком редакторе и на каком объекте (контур, текст, bitmap), итоговый PDF и реальная сессия gifts.ru не были предоставлены/проверены. Подтвердить фактическую причину только по реальному воспроизводимому файлу и PDF-операторам. Не утверждать, что пользовательский кейс исправлен автоматически.

Диагностика нового чата: проверить макет в VectorCraft и TraceDraw отдельно; цвет BEFORE и AFTER по реально нарисованным объектам и Embedded XObject; File→Export native PDF; проследить tools/vectorcraft-bridge.rs или tools/tracedraw-raster-cmyk.patch → assets/*-integration.js → assets/cmyk-roundtrip.js → tools/patch-logo-editor-bridge.mjs → Qe(file,"art") → assets/logo-preflight.mjs → assets/logo-detail-check.mjs. Обращать внимание на профиль ICC, цвет bitmap и vector независимо, ограничения конкретного метода печати. На каждом этапе сохранять модель и число красок без тайных преобразований. Сначала воспроизвести регрессию на тестовом файле, потом исправлять.

## 5. Структура и ключевые файлы
- editor.html — окно Макетной, стили, скрипты и версия UI.
- direct-mode.js — адаптер gifts.ru, маршруты заказов/PDF/загрузки и авторизация; не путать с production backend.
- tools/build-launcher.mjs — канонический сборщик. Не править assets/index-BpU9kvz8.js руками: это скомпилированный PDF.js/UI bundle, к которому инструменты patch-*.mjs применяют точные защищённые изменения.
- tools/patch-artwork-preflight.mjs + assets/logo-preflight.mjs + assets/logo-color.mjs — цвет, текст, PDF графические операции и проверки; assets/logo-detail-engine.mjs, assets/logo-detail-check.mjs, assets/logo-detail-worker.mjs — геометрия мелких элементов/растр/Worker.
- tools/patch-logo-editor-bridge.mjs — защищённый возврат текущего поля, проверка токена, размеры и последующий PrintCheck.
- tools/vectorcraft-bridge.rs и tools/patch-vectorcraft-upstream.py, tools/patch-vectorcraft-gifts-theme.py, tools/patch-vectorcraft-single-field.py — нативный VectorCraft и WASM.
- tools/tracedraw-embedded.rs, tools/tracedraw-raster-cmyk.patch, tools/patch-tracedraw-upstream.py, assets/tracedraw-raster-bridge.js — нативный TraceDraw и растровая цветность.
- assets/vectorcraft-integration.js, assets/tracedraw-integration.js, assets/vectorcraft-field.js, assets/cmyk-roundtrip.js, assets/editor-return-progress.js, assets/logo-editor-choice.js — интерфейсы редакторов.
- assets/order-uploaded-makets.js, assets/maketnaya-pdf-provenance.js, assets/personal-layout-library.js — файлы заказов и признаки Макетной.
- mockup.html, assets/mockup-cylinder.mjs, mockup-profiles.json — мокапы.
- method-settings.json, assets/method-settings-server.mjs, assets/print-requirements.mjs — серверные требования нанесений.
- tests/logo-preflight-browser.mjs, tests/logo-preflight.test.mjs, tests/cmyk-roundtrip-browser.mjs, tests/tracedraw-raster-cmyk-runtime.mjs, tests/vectorcraft-runtime-browser.mjs, tests/tracedraw-runtime-browser.mjs, tests/order-uploaded-makets-browser.mjs.
- .github/workflows/publish-maketnaya-mockups.yml — precheck → publish → browser_verify; build-vectorcraft-web.yml и build-tracedraw-web.yml — независимые WASM релизы, verify-tracedraw-live.yml — реальный wasm browser QA.

## 6. Публикация, история, безопасность
Новая разработка: (1) fetch exact current source/main SHA; (2) сделать backup branches source/main; (3) читать рабочий код и задействованные handoff; (4) минимальный патч и необходимые тесты, включая реальный WASM при изменениях Rust; (5) publish Actions и убедиться, что ВСЕ jobs success, а не только начало; (6) проверить production-файлы и SHA user registries; (7) создать checkpoint source/main и внести историю. Чужие заказы не удалять. Сохранять открытые и закрытые задачи, исправления, границы тестирования. Не переписывать состояние проекта на основании памяти.

История и предыдущие документы (в source ветке GitHub):
- handoff/MAKETNAYA_TRACEDRAW_RASTER_CMYK_2026-10-22.md — **самый новый** живой Rust WASM фикс, PDF DeviceCMYK raster, известные ограничения.
- handoff/MAKETNAYA_PDF_COLOR_STATE_2026-10-21.md — Color PDF parser q/Q/Contents/XObjects регрессии.
- handoff/MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md — CMS convert=true, PrintCheck paints-only.
- handoff/MAKETNAYA_PRINTCHECK_EDITOR_RETURN_2026-10-21.md — повторная проверка при возврате.
- handoff/MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md — полная хронология, вместе с handoff/DEVELOPMENT_HISTORY_2026-10-17.md, handoff/MAKETNAYA_HANDOFF_2026-10-13_COMPLETE.md.
- handoff/START_HERE_MAKETNAYA_2026-10-21_LATEST.md и handoff/ALL_HANDOFF_FILES_2026-10-21.md — прежний индекс, содержащий более старые версии; использовать как исторический контекст.
- handoff/MAKETNAYA_NEXT_STEPS_2026-10-21.md — темы QA, серверное хранение, будущие сценарии.
- handoff/MAKETNAYA_BINARY_ORIGIN_AND_TEMPLATE_TOOL_LOCK_2026-10-21.md, handoff/MAKETNAYA_ORDER_PDF_SAVE_REPLACE_SAVE_AS_2026-10-21.md, handoff/MAKETNAYA_TRACEDRAW_RASTER_AND_RGB_2026-10-21.md — точные архитектурные решения.

## 7. Известные ограничения
Не заявлять, что полная личная библиотека PDF надёжно хранится на доверенном backend, пока это не подтверждено. Не считать неподтверждённые CDR-файлы полностью импортируемыми. Большие PDF могут давать долгий анализ, а оценки тонких объектов требуют QA на реальных положительных и отрицательных образцах. Rust workspace на локальной Windows ранее имел **один известный upstream тестовый сбой в tracedraw-text** (1233 passed, 1 failed) — см. TraceDraw raster CMYK handoff; не утверждать, что весь cargo workspace на той машине зелёный. Проверенные специализированные CI/native/WASM тесты прошли.

## 8. Правильное начало нового чата
Прочитать этот документ и последнюю TraceDraw CMYK запись; проверить исходную ветку и production SHA/версии; перечислить фактически восстановленную архитектуру и зелёные тесты; затем продолжать по конкретному следующему запросу. Для пользовательского RGB/CMYK вопроса отличать ожидаемое появление RGB после CMYK→RGB от реального дефекта RGB→CMYK. Если всё ещё воспроизводится, запросить обезличенный исходный и возвращённый PDF и зафиксировать операцию редактора. Не терять предыдущую историю.
