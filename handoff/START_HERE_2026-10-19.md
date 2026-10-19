# ПРОДОЛЖЕНИЕ РАЗРАБОТКИ «МАКЕТНОЙ» — СТАРТ В НОВОМ ЧАТЕ
Дата фиксации: **19 октября 2026 года**. Прочитать первым; далее — `HANDOFF_FOR_NEXT_CHAT.md` и профильный handoff ниже.

## 1. Текущее задание и статус
Последний запрос пользователя: добавить **выбор двух редакторов** под существующей кнопкой «Редактор логотипа»: (1) доработанный VectorCraft и (2) TraceDraw — аналог CorelDRAW. **Перед изменениями исходники и production были заморожены. Интеграция двух редакторов реализована, опубликована и прошла проверки настоящего TraceDraw WASM.** Следующий пользовательский запрос — подготовить ВСЕ необходимые файлы истории и продолжения для нового чата; он выполняется данным пакетом. Не продолжать незаказанную разработку и не приписывать готовность будущим функциям.

- Репозиторий GitHub: `tohaa28/tohaa28.github.io`
- Рабочая исходная ветка: `gifts-layout-workbench-mockups-source`; опубликованная ветка: `main`.
- Открыть приложение: https://tohaa28.github.io/gifts-layout-workbench-mockups/
- VectorCraft WASM: https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html
- TraceDraw WASM: https://tohaa28.github.io/gifts-layout-workbench-mockups/tracedraw/index.html
- Главный документ проверенной интеграции: `handoff/MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md`.
- Предыдущее состояние личной PDF-библиотеки: `handoff/MAKETNAYA_PDF_LIBRARY_SEPARATE_2026-10-18.md`.
- Полная хронология в `HANDOFF_FOR_NEXT_CHAT.md`, `handoff/DEVELOPMENT_HISTORY_2026-10-17.md` и множестве датированных файлов в каталоге `handoff/`. **Не удалять их**.

## 2. НЕПЕРЕМЕЩАЕМЫЕ КОНТРОЛЬНЫЕ ВЕТКИ
Предпроектные снимки перед TraceDraw:
- Исходники: `backup-before-tracedraw-editor-integration-20261019-source` = `00cc426279c584116db5214a03de3e5b734f676a`.
- Продакшн: `backup-before-tracedraw-editor-integration-20261019-production` = `58907913d1f71484c5b3a77f82f4070b6e09b1e2`.

**ПРОВЕРЕННЫЙ ФУНКЦИОНАЛЬНЫЙ РЕЛИЗ**:
- Source: `checkpoint-maketnaya-tracedraw-two-editors-20261019-source` = `73e7d178a632a95c368b9ab1b72d3ab84e1d5cfe`.
- Production: `checkpoint-maketnaya-tracedraw-two-editors-20261019-production` = `eafb2c85d563b619165c79f858426b97256126ca`.

**СНИМОК НЕПОСРЕДСТВЕННО ПЕРЕД СОЗДАНИЕМ ЭТОГО HANDOFF**:
- Source: `checkpoint-maketnaya-next-chat-20261019-source` = `af6f756ad347feadf349fb28f91908928717339d` (включает документацию предыдущего релиза).
- Production: `checkpoint-maketnaya-next-chat-20261019-production` = `eafb2c85d563b619165c79f858426b97256126ca`.
- Текущая source HEAD меняется из-за добавления документации; перечисленные checkpoint-ветки сохраняются неизменными.
- Эти снимки НЕ означают, что приложение не может позже измениться; перед новыми кодовыми правками снова создать backup и провести CI.

## 3. Что действительно работает и проверено
- Под `#editorOpenLogoEditor` открывается меню **VectorCraft / TraceDraw**. VectorCraft остаётся проверенным старым вариантом и запускается через `window.gwbVectorcraftHost.open()`. Обработчик прежнего прямого запуска заменён на выбор, само ядро VectorCraft не переписано.
- TraceDraw — не имитация: **самохостинговый Rust/WASM из `igtoth/tracedraw` v0.9.4**, pinned upstream `0f206489770adcacc6cc130a9e31a5610faad68a` (MIT OR Apache-2.0). Сборка хранится в `main/gifts-layout-workbench-mockups/tracedraw/`.
- TraceDraw открывается в отдельном iframe из домена GitHub Pages (не на публичном upstream demo), получает конкретный рисунок с размерами печатного поля в мм, редактирует в исходном TraceDraw, и возвращает только нарисованную SVG-геометрию с проверенными `logoBoundsMm`. Конструктор артикула остаётся в Макетной, белый фон рабочей страницы не экспортируется. Возврат идет через `gwbApplyEditedLogoToActiveField` с токеном исходного выбранного поля и проверкой размеров.
- Кнопка **«Перенести на шаблон артикула»** внутри TraceDraw — HTML-кнопка iframe, которая вызывает **настоящий экспорт Rust WASM** `gwb_tracedraw_request_apply`; НЕ называйте её встроенной кнопкой egui. UI самого редактора TraceDraw — настоящий Rust egui.
- Реальная WASM-проверка в Chromium: входящий SVG на поле 60×35 мм, объект около x=3, y=4, w=16, h=8 мм, выходной cropped SVG и действие кнопки через Rust; без mock движка.
- Предыдущая Макетная: заказы gifts.ru, связанные с артикулами поля конструктора, выбор печати, работа с логотипом, VectorCraft с точными размерами, PrintCheck, мокапы с цилиндрической проекцией, анимации, отдельная библиотека сохранённых PDF с ручным восстановлением и без автоматической отправки в заказ.

## 4. Источники/основные файлы проекта
| Задача | Путь в source |
|---|---|
| UI выбора двух редакторов | `assets/logo-editor-choice.js` |
| VectorCraft: существующий verified editor host | `assets/vectorcraft-integration.js` |
| Подготовка полей/мм в SVG, включая растровый логотип | `assets/vectorcraft-field.js` |
| TraceDraw parent iframe bridge | `assets/tracedraw-integration.js` |
| TraceDraw Rust-WASM импорт, размер, SVG bbox и экспорт | `tools/tracedraw-embedded.rs` |
| Патч pinned TraceDraw upstream | `tools/patch-tracedraw-upstream.py` |
| Компиляция и публикация TraceDraw WASM | `.github/workflows/build-tracedraw-web.yml` |
| Компиляция VectorCraft WASM | `.github/workflows/build-vectorcraft-web.yml` |
| Публикация сайта и основные UI/интеграционные тесты | `.github/workflows/publish-maketnaya-mockups.yml` |
| Проверка РЕАЛЬНОГО TraceDraw WASM в Chromium | `tests/tracedraw-runtime-browser.mjs`, `.github/workflows/verify-tracedraw-live.yml` |
| Тест меню двух движков | `tests/logo-editor-choice-browser.mjs` |
| Тест передачи выбранного поля через iframe | `tests/tracedraw-integration-browser.mjs` |
| Основной интерфейс Макетной | `editor.html`, `direct-mode.js` |
| Индексная страница/закладка | `index.html`, `tools/build-launcher.mjs` |
| Личные PDF-макеты, список, скачивание, восстановление | `assets/personal-layout-library.js` |
| Приватный серверный API, ПОКА не развёрнут | `server/personal-layouts/index.mjs`, `server/personal-layouts/README.md` |
| Настройки методов нанесения | `method-settings.json` |
| Привязки фото мокапов | `mockup-profiles.json` |

## 5. Подтверждённые Actions
- Основная «Макетная» с браузером: **SUCCESS** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231640321
- Rust/WASM build TraceDraw: **SUCCESS** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231601793
- Live test Rust/WASM TraceDraw: **SUCCESS**, успешная вторая попытка после размещения нового бинарника https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231640175
- GitHub Pages: **SUCCESS** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39232177088
- Важно: тесты mock-iframe и настоящий WASM тест НЕ заменяют друг друга; для новых изменений Rust обязательны ОБА.

## 6. Честные ограничения / НЕ ГОТОВО
- Embedded TraceDraw при передаче логотипа принимает **SVG и PDF**; растровые картинки встраиваются в SVG через существующую подготовку. Хотя upstream TraceDraw умеет CDR, прямая передача CDR в текущей embedded-сессии НЕ реализована. Описание «SVG/CDR» в подписи выбора пока опережает реальную интеграцию — скорректировать при следующем UI-улучшении.
- Внутренние команды создания нового документа upstream TraceDraw **не заблокированы полностью**. При расширении режима ограничить сессию выбранным полем (не заменять другие файлы/заказы).
- Не проверена абсолютно вся функциональность TraceDraw как CorelDRAW. Нужны регрессии: сложные SVG, импортные PDF, ротация и клипы, редактирование кривых, видимые/невидимые объекты, экспорт после конкретных операций.
- `assets/personal-layout-library.js` сохраняет PDF и редактируемые исходники в браузере (IndexedDB), а приватный Node API только подготовлен. Реальный защищённый серверный шлюз с проверкой gifts.ru сессии **НЕ подключён**. Без него нельзя обещать хранение на сервере; нельзя записывать персональные логотипы в публичный репозиторий.
- В Макетной имя отображаемого пользователя читается из UI авторизации gifts.ru; это НЕ криптографическое подтверждение личности на сервере. Для серверного доступа нужен подписанный сервером неизменяемый ID.

## 7. ОБЯЗАТЕЛЬНЫЕ ПРЕДОСТОРОЖНОСТИ
- Не перезаписывать `mockup-profiles.json` и `method-settings.json` из старых веток/резервных копий, поскольку это действующие пользовательские реестры. Зафиксированные SHA для обоих branches на 19.10.2026: `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` и `cbf6c8204e4fb3892d806342d37debefb8d9038e` соответственно.
- GitHub Pages `main` содержит не только опубликованные исходники, но и СКОМПИЛИРОВАННЫЕ движки `vectorcraft/` и `tracedraw/`. При публикации обычных файлов ОБЯЗАТЕЛЬНО сохранить обе папки WASM; соответствующие меры уже встроены в CI.
- Для отката сохранять пользовательские JSON и бинарники из актуального production, откатывать только необходимые файлы к frozen source и пересобрать/протестировать.
- Не загружать личные данные, токены GitHub, artwork покупателей, ключи авторизации в публичный handoff.
- **Не заявлять успешную сборку или publication без реально успешного GitHub Action и live-браузерного теста.**

## 8. Как продолжать
1. Прочитать этот документ, `handoff/MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md`, `handoff/NEXT_STEPS_2026-10-19.md` и `handoff/PROJECT_STATE_2026-10-19.json`.
2. Работать в branch `gifts-layout-workbench-mockups-source`. Перед новой функцией создать `backup-before-<feature>-source` и `backup-before-<feature>-production` с ТЕКУЩИМИ SHA.
3. При изменении TraceDraw `tools/tracedraw-embedded.rs` или патча upstream перезапустится специальная Rust/WASM workflow; дождаться публикации нового бинарника в `main` и только затем live WASM тест.
4. При изменении JS/UI прогнать основной workflow и браузерные тесты для двух редакторов, возвращения логотипа, открытия/закрытия «Макетной», PrintCheck, библиотеки PDF и мокапов. После публикации проверить истинный production.
5. Новая работа выбирается по следующему сообщению пользователя; при «продолжай» приоритет — изоляция текущего поля в TraceDraw, direct CDR по согласованным требованиям, QA векторов/печати (подробно — NEXT_STEPS).
