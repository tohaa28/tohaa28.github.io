# МАКЕТНАЯ — СТАРТ РАЗРАБОТКИ В НОВОМ ЧАТЕ (19 октября 2026)

**Канонический актуальный handoff.** Эта запись отражает проверенный код и состояние репозитория на 19.10.2026. Не заменять её более старыми файлами октября.

## Репозиторий и публичный релиз
- GitHub: https://github.com/tohaa28/tohaa28.github.io
- Исходники и все патчи: branch **gifts-layout-workbench-mockups-source**.
- Публикация: branch **main**, каталог **gifts-layout-workbench-mockups/**.
- Пользовательский сайт: https://tohaa28.github.io/gifts-layout-workbench-mockups/
- VectorCraft WASM: https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html
- TraceDraw WASM: https://tohaa28.github.io/gifts-layout-workbench-mockups/tracedraw/index.html
- **Замороженный источник:** branch **checkpoint-maketnaya-20261019-newchat-final-source**, commit **52743e6b27cd4d644f0465ed07999035af7e1a98**.
- **Замороженная публикация:** branch **checkpoint-maketnaya-20261019-newchat-final-production**, commit **eafb2c85d563b619165c79f858426b97256126ca**.
- Последний функционально проверенный source-релиз: **73e7d178a632a95c368b9ab1b72d3ab84e1d5cfe**. Сравнение с замороженным source показало **6 последующих коммитов и только изменения документации** (не исполняемого кода).
- После создания handoff-архива текущий HEAD рабочей source-ветки может отличаться по документации. **Не путать HEAD, функциональный commit и frozen checkpoint.**

## Что гарантированно реализовано
1. **Макетная**: чтение корзин/заказов gifts.ru, артикулы и коды нанесений, конструкторы и поля, выбор места, загрузка логотипа и PDF, сохранение параметров, PrintCheck, мокапы и цилиндрическая геометрия, пошаговый интерфейс и анимации. Сохранять предыдущую функциональность.
2. **Выбор редактора под «Редактор логотипа»**: два независимых варианта **VectorCraft** и **TraceDraw**; source **assets/logo-editor-choice.js**. Не превращать их в один редактор и не удалять существующий VectorCraft.
3. **VectorCraft**: настоящий Rust/WASM из **storytold/vectorcraft** (pinned **8bc65329286dc1b84aa392997bb205613c3e96cb**). Из выбранного поля приходит оригинальный логотип и **физический размер поля в мм**. Работа с единственным документом, собственные векторные инструменты и CMYK. Из VectorCraft возвращается **только видимая геометрия, обрезанный SVG и logoBoundsMm**, не белый лист, с исходным местом в поле. При переключении или закрытии без применения документ заказа не меняется. Source: assets/vectorcraft-integration.js, assets/vectorcraft-field.js, tools/vectorcraft-bridge.rs, tools/patch-vectorcraft-upstream.py, tools/patch-vectorcraft-single-field.py, tools/patch-vectorcraft-gifts-theme.py. **Тема gifts.ru установлена по умолчанию**; реализация исходной темы и простого редактора сохранена, но соответствующие устаревшие переключатели намеренно скрыты в актуальном иммерсивном интерфейсе. Полноэкранный режим и единственная кнопка «Перенести на шаблон артикула» в самом редакторе сохранены.
4. **TraceDraw**: настоящий отдельный self-hosted Rust/WASM из **igtoth/tracedraw 0.9.4**, pinned **0f206489770adcacc6cc130a9e31a5610faad68a**; исходная сессия выбранного нанесения получает размер и SVG/PDF, возвращает cropped SVG и logoBoundsMm. Source: assets/tracedraw-integration.js, tools/tracedraw-embedded.rs, tools/patch-tracedraw-upstream.py. Кнопка «Перенести на шаблон артикула» внутри iframe — **HTML-кнопка**, но она вызывает **настоящий Rust exporter**, не имитацию. **Прямой CDR/CMX импорт в embedded-сессию пока не реализован**, хотя upstream имеет отдельные импортёры; нельзя считать его готовым.
5. **Личная библиотека PDF**: сохраняет настоящие PDF с макетами и редактируемые исходники, пользователь вручную восстанавливает выбранный вариант, без автоматической подстановки в заказ. Сейчас проверено хранение в браузере **IndexedDB**. Private server adapter реализован, но **не развёрнут и не авторизован на gifts.ru**, нельзя обещать серверное сохранение.
6. **Идентификация**: имя читается из UI авторизованного gifts.ru, но это НЕ серверная проверка личности. Для private storage нужен доверенный серверный идентификатор.

## Проверенные релизы и точные результаты
- CI Publish Maketnaya: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231640321 — **success**; все 3 jobs precheck/publish/browser_verify успешны.
- Build TraceDraw Rust WASM: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231601793 — **success**.
- Live TraceDraw Chromium: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39231640175 — **attempt 2 success**; проверен подлинный Rust, размеры рисунка/смещение и вызов кнопки.
- GitHub Pages: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39232177088 — **success**; все build/deploy jobs успешны.
- В production: **tracedraw/tracedraw_bg.wasm** 32 335 760 байт, SHA blob **2747000b28ba1118874ffcf89198df3a9813310f**; **vectorcraft/vectorcraft-web-4382340da2246adb_bg.wasm** 64 770 986 байт, SHA blob **4bf39a3d31e50bfcce7584b2aaf772d8c500231d**. Оба бинарника включены в production checkpoint.

## Сохранить при любых изменениях / откате
- **mockup-profiles.json**: Git blob **ddb84fdc0d656341770a2399f5a10f0e21f5d72c**, одинаковый source/main.
- **method-settings.json**: Git blob **cbf6c8204e4fb3892d806342d37debefb8d9038e**, одинаковый source/main.
- Свежие записи реестров могут появиться после этого снимка. **Никогда** не перезаписывать их из старой ветки без сравнения и переноса новых данных.
- Папки production **vectorcraft/** и **tracedraw/** сохраняются при любом обычном publish; их бинарники НЕ собираются вместе с каждым UI-коммитом.
- Личные документы/логотипы, токены и ключи пользователей НЕ размещать в публичном репозитории и handoff-файлах.
- Прежде чем менять UI, создавать две новые backup-ветки от свежих source/main HEAD. Править source, а не generated production. Затем CI и browser_verify; при Rust — отдельный build WASM, Pages и **живой** браузерный test.
- Не удалять прежние checkpoints и исторические handoff-файлы. При откате к контрольной точке сохранять актуальные серверные данные.

## Важные файлы для следующей работы
- **HANDOFF_FOR_NEXT_CHAT.md** — исторический общий обзор.
- **handoff/START_HERE_2026-10-19.md** — полная архитектура двух редакторов.
- **handoff/PROJECT_STATE_2026-10-19.json** — предыдущий машинный паспорт.
- **handoff/NEXT_STEPS_2026-10-19.md** — список будущих инженерных задач.
- **handoff/MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md** — проверенная новая интеграция.
- **handoff/MAKETNAYA_VECTORCRAFT_GIFTS_THEME_2026-10-17.md**, **handoff/MAKETNAYA_VECTORCRAFT_IMMERSIVE_2026-10-17.md** — оформление и последний UX.
- **handoff/MAKETNAYA_PDF_LIBRARY_SEPARATE_2026-10-18.md** — библиотека и ограничения хранения.
- **handoff/DEVELOPMENT_HISTORY_2026-10-17.md** и весь **handoff/** — хронология деталей.
- **handoff/SAFE_RECOVERY_2026-10-19_FINAL.md** — безопасные способы доработки и отката.
- **handoff/PROJECT_STATE_2026-10-19_FINAL.json** — машиночитаемый паспорт текущей замороженной точки.
- **handoff/NEW_CHAT_PROMPT_2026-10-19_FINAL.md** — готовое первое сообщение.

**Текущая задача пользователя только зафиксировать проект, не реализовывать новые функции.** В новом чате сначала прочитать это, затем получать следующее задание; не путать его с отдельным проектом VectorForge/CorelDRAW clone.
