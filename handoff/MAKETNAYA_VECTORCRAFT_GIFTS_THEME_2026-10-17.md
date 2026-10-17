# Макетная × VectorCraft: переключаемый gifts.ru-стиль

Дата реализации: 17 октября 2026.

## Требование
Предоставить альтернативное оформление полноценного VectorCraft в стилистике сайта gifts.ru, оставив ВСЕ оригинальные инструменты, меню, геометрию и логику редактора. Разместить переключатель непосредственно рядом с кнопкой «Открыть прежний редактор», исходное оформление VectorCraft — по умолчанию.

## Зафиксированные контрольные версии
- Независимый резерв исходников: `backup-before-vectorcraft-gifts-skin-20261017`, SHA `ec8604ad8d38e2f7f9f3689452b6a8f7aa67c828`.
- Независимый резерв опубликованной версии и WASM: `backup-published-before-vectorcraft-gifts-skin-20261017`, SHA `21c4b5bb44f2c9a5663c90bc2d7de425ea053ae2`.
- Рабочая feature: `feature-vectorcraft-gifts-skin-20261017`.
- Предыдущая пользовательская контрольная точка `checkpoint-maketnaya-vectorcraft-art-only-20261016-source` и `checkpoint-maketnaya-vectorcraft-art-only-20261016-production` не изменяются.
- Не перетирать JSON серверных профилей / нанесений и сохранённых привязок при откате.

## Принцип реализации
У VectorCraft внутренний редактор отрисовывается WebAssembly/egui, поэтому CSS на стороне Макетной не перекрасит меню и инструменты. Используется настоящий egui skin внутри pinned `storytold/vectorcraft`.

1. `tools/patch-vectorcraft-gifts-theme.py`: в `crates/ui-egui/src/theme.rs` встроена отдельная `apply_gifts(ctx)`. Палитра: зелёный `#78aa1e`, светлые панели `#ffffff`, рабочая область `#e9efe6`, тёмный текст `#243126`, увеличенное скругление, более мягкие отступы и наведение. Видимые выделения узлов сохраняют собственный контрастный цвет. *Вся логика и данные VectorCraft остаются оригинальными*.
2. `Host` содержит флаги `bridge_gifts_style`, `bridge_gifts_pending` и снимок исходного `egui::Style` + `theme::Tokens`. В `WebShell::logic` применяются или восстанавливаются исходные значения после `app.logic(ctx)`, без пересоздания `VectorcraftApp` и документов.
3. `tools/vectorcraft-bridge.rs`: ограниченные по origin, source и сеансовому token команды `gwb-vectorcraft-theme` c `mode=gifts/native`; подтверждение `gwb-vectorcraft-theme-applied`. Изменение интерфейса не запускает импорт, экспорт, сброс Undo, переустановку размеров и т.п.
4. `assets/vectorcraft-integration.js`: дополнительная кнопка `Стиль gifts.ru`, размещённая после `Открыть прежний редактор` в нижней панели. Установлены `aria-pressed` и состояния ожидания подтверждения. Перекрашивается также внешняя шапка/подвал. При повторном щелчке восстанавливаются *оригинальные* параметры egui-темы. Исходный VectorCraft — default.
5. `editor.html`: версия скрипта `vectorcraft-integration.js?v=20261017-gifts-1` — обход старого кэша встраиваемого редактора.
6. `.github/workflows/build-vectorcraft-web.yml`: запускает новый source patch после legacy bridge и single-document lock и до Trunk/WebAssembly. Только встроенный VectorCraft допускает выбор этого оформления. Внешняя самостоятельная версия не изменяется.

## Контрольные проверки
- `tests/vectorcraft-gifts-theme.test.mjs` — статическая проверка этапов интеграции и неизменности экспорта.
- `tests/vectorcraft-handoff-browser.mjs` — переключатель вблизи простого редактора, включение, обратное переключение, отсутствие повторного открытия/изменения файла, последующий возврат SVG, сохранение соседнего поля.
- `tests/vectorcraft-runtime-browser.mjs` — настоящий опубликованный Chromium/WebAssembly, обе команды темы и их ответные подтверждения в одном документе, отдельная проверка native single-document lock и корректности исходных bounds.
- **Окончательное принятие**: после публикации Rust WASM убедиться в зелёном запуске реального Chromium test, а не только mocked handoff. Записать номера workflow и commit сюда.

## Откат
Рекомендуемый откат стиля не требует Git: просто выключить кнопку «Стиль gifts.ru» — все исходные егui-параметры восстановятся из снимка без перезагрузки. Для отката кода использовать резервные ветки, затем синхронизировать с актуальными server JSON, не восстанавливая их из старой копии без сравнения.

## Итоговая публикация и подтверждение — успешно
- Компиляция подлинного Rust/WebAssembly VectorCraft: [`39021081065`](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39021081065) — **success**, обновлённый `vectorcraft-web-387ea92584a5506a_bg.wasm` размером 64,756,916 байт. Ранний `39020725401` упал из-за устаревшего egui API `ctx.style/set_style`; исправлено на поддерживаемые egui 0.36 `ctx.global_style/set_global_style`.
- GitHub Pages production WebAssembly deployment [`39021573521`](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39021573521) — **success**.
- Реальный Chromium/WebAssembly тест [`39021992518`](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39021992518) — **success**. Проверены `gwb-vectorcraft-theme-applied: gifts`, `native`, изменение настоящих пикселей egui-панели после включения gifts-режима (не только внешний CSS), отсутствие повторного открытия, сохранение защиты от второго документа и экспорт того же SVG 40×18 мм с координатами 12,8 мм. `browserErrors: []`.
- Общий CI `39021992566` — **success**, precheck, publish, browser_verify / browser-test. Включает имитационные UI-тесты, сравнение цветов контейнера при переключении gifts/native, сохранение позиции печати и соседнего поля, тесты PrintCheck/цилиндрических мокапов, запуск gifts.ru.
- Развёртывание GitHub Pages `39022054385` — **success**.
- На исходной и опубликованной ветках одинаковые SHA данных: `mockup-profiles.json` — `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` — `cbf6c8204e4fb3892d806342d37debefb8d9038e`. Настройки PrintCheck и мокапов не изменены.
- Существующие пользовательские точки восстановления и новые backup branches сохранены. Никакие правки логотипов не отправляются на сервер при переключении стиля: используется только работа с egui Context.
