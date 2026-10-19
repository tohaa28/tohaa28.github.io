# Навигация по документации Макетной

## Актуальный пакет для нового чата — 19 октября 2026 года
1. **[START_HERE_2026-10-19.md](START_HERE_2026-10-19.md)** — главный самодостаточный handoff: состояние двух редакторов, SHA, CI, связи с GIFTS, правила защиты.
2. **[PROJECT_STATE_2026-10-19.json](PROJECT_STATE_2026-10-19.json)** — машинный снимок SHA, путей и статусов всех модулей.
3. **[NEXT_STEPS_2026-10-19.md](NEXT_STEPS_2026-10-19.md)** — незавершённые задачи, развитие TraceDraw, регрессии, сборка, публикация.
4. [MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md](MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md) — детальный отчёт последнего действительного релиза с Live WASM.
5. [MAKETNAYA_PDF_LIBRARY_SEPARATE_2026-10-18.md](MAKETNAYA_PDF_LIBRARY_SEPARATE_2026-10-18.md) — PDF-библиотека макетов и серверные ограничения.
6. [../NEXT_CHAT_START_HERE.md](../NEXT_CHAT_START_HERE.md) — короткая точка входа в корне репозитория; [../HANDOFF_FOR_NEXT_CHAT.md](../HANDOFF_FOR_NEXT_CHAT.md) — накопленная история.

**Версия 17 октября ниже — историческая, не основная.** Текущий проверенный интерфейс имеет меню VectorCraft / TraceDraw; прямой CDR handoff не реализован, серверное хранение личных PDF ещё не подключено. Не использовать прежние чекпоинты вместо последнего работающего кода без прямого запроса на откат.

## Архив документации 17 октября и ранее


**Для нового чата начинайте с версии на 17 октября 2026 г.:**

1. [START_HERE_2026-10-17.md](START_HERE_2026-10-17.md) — канонический технический handoff, статус, исходники/публикация, принципы безопасной разработки.
2. [MAKETNAYA_STATE_2026-10-17.json](MAKETNAYA_STATE_2026-10-17.json) — machine-readable refs, SHA, CI, критические данные и key APIs.
3. [DEVELOPMENT_HISTORY_2026-10-17.md](DEVELOPMENT_HISTORY_2026-10-17.md) — хронология решений от Макетной и PrintCheck до Rust/VectorCraft.
4. [NEW_CHAT_PROMPT_2026-10-17.md](NEW_CHAT_PROMPT_2026-10-17.md) — готовый текст для нового чата.

**Последняя работающая версия:** VectorCraft полностью интегрирован в «Макетную», gifts.ru тема включена по умолчанию и может быть отключена отдельной кнопкой рядом с «Открыть прежний редактор». Работа ограничена текущим полем, рабочая область в мм, обратно возвращается только art-bounds SVG. Исходная/production контрольная точка: `checkpoint-maketnaya-gifts-theme-default-20261017-source` и `checkpoint-maketnaya-gifts-theme-default-20261017-production`.

**Исторические документы сохранены:** `MAKETNAYA_VECTORCRAFT_GIFTS_THEME_2026-10-17.md`, `MAKETNAYA_VECTORCRAFT_SINGLE_FIELD_2026-10-16.md`, `MAKETNAYA_VECTORCRAFT_ART_BOUNDS_2026-10-16.md`, `MAKETNAYA_VECTORCRAFT_FIELD_MM_2026-10-16.md`, `MAKETNAYA_VECTORCRAFT_WASM_2026-10-16.md`, `MOCKUP_CYLINDER_DEVELOPMENT_2026-10-14.md`, `MAKETNAYA_PRINCIPLES_2026-10-13.md`, а также PrintCheck в корневых HANDOFF-файлах. Читать их для устройства конкретной подсистемы, но не принимать старые хэши за текущие.

**Данные:** при откатах никогда не терять свежие `mockup-profiles.json` и `method-settings.json` (прочесть новые SHA перед операцией).

Рабочий репозиторий: https://github.com/tohaa28/tohaa28.github.io ; сайт: https://tohaa28.github.io/gifts-layout-workbench-mockups/.
