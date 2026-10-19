# Макетная: выбор VectorCraft / TraceDraw — проверенная интеграция 19.10.2026

## Итог
Под существующей кнопкой «Редактор логотипа» теперь открывается компактное меню: **VectorCraft** (старый, без изменений) и **TraceDraw** (настоящий самохостинговый Rust/WebAssembly TraceDraw 0.9.4 из проекта `igtoth/tracedraw`). Внешний демосайт не используется, клиентские логотипы не отправляются стороннему сервису.

До изменений зафиксировано:
- `backup-before-tracedraw-editor-integration-20261019-source` — `00cc426279c584116db5214a03de3e5b734f676a`;
- `backup-before-tracedraw-editor-integration-20261019-production` — `58907913d1f71484c5b3a77f82f4070b6e09b1e2`.

Проверенные контрольные точки после изменений:
- SOURCE: `checkpoint-maketnaya-tracedraw-two-editors-20261019-source` — `73e7d178a632a95c368b9ab1b72d3ab84e1d5cfe`;
- PRODUCTION: `checkpoint-maketnaya-tracedraw-two-editors-20261019-production` — `eafb2c85d563b619165c79f858426b97256126ca`.
Обе зафиксированы и не должны перемещаться. Позднейшие изменения документации не входят в функциональную source checkpoint.

## Исходный код
- `assets/logo-editor-choice.js`: доступное с клавиатуры выпадающее меню двух редакторов под `#editorOpenLogoEditor`.
- `assets/vectorcraft-integration.js`: старый захват клика удалён, API `gwbVectorcraftHost.open()` и вся реальная логика его сессии/геометрии оставлены.
- `assets/tracedraw-integration.js`: отдельное полноэкранное окно TraceDraw в `iframe` **под тем же доменом GitHub Pages**, без передачи логотипа на сторонний сайт. Проверка `event.origin`, `event.source`, индивидуального токена; отправка текущего файла и размеров поля; проверка экспортированного SVG и `logoBoundsMm`; вызов старого безопасного `gwbApplyEditedLogoToActiveField(file,placement,{artworkBoundsMm,fieldSizeMm})`.
- `assets/vectorcraft-field.js`: используется старый точный физический подготовитель поля без модификации; растр помещается внутрь векторного SVG.
- `tools/tracedraw-embedded.rs`: Rust-WASM bridge через `wasm-bindgen`; разрешает редактирование именно текущего поля в мм; импорт SVG/PDF; экспорт `tracedraw_io::svg::page_to_svg`, рассчитывает bbox по видимым объектам и возвращает cropped SVG без фона рабочей страницы; экспорт вызывается из wasm-bindgen `gwb_tracedraw_request_apply` с репейнтом egui.
- `tools/patch-tracedraw-upstream.py`: детерминированные патчи upstream Web `index.html` и `main.rs`. Кнопка «Перенести на шаблон артикула» находится **внутри iframe TraceDraw в HTML-поверхности** и вызывает фактический Rust/WASM exporter; она **не является встроенной egui-кнопкой**, не заявлять обратное. Upstream UI редактора при этом подлинный.
- `.github/workflows/build-tracedraw-web.yml`: компиляция pinned upstream `igtoth/tracedraw` SHA `0f206489770adcacc6cc130a9e31a5610faad68a`, лицензия MIT OR Apache-2.0, сохранение LICENSE, публикация бинарника в `main/gifts-layout-workbench-mockups/tracedraw/`.
- `.github/workflows/publish-maketnaya-mockups.yml`: копирует статические интеграционные файлы и **сохраняет уже собранные** бинарники `vectorcraft/` и `tracedraw/`, не затирая при обновлении.
- `editor.html`: подключает оба редактора и меню.

## Проверка
- Полный браузерный CI `39231640321` — **success**, включая открытие «Макетной» на gifts.ru, прежний VectorCraft, переключатель, независимый iframe и все существующие сценарии мокапов и PrintCheck.
- Компиляция настоящего TraceDraw WASM `39231601793` — **success**.
- GitHub Pages deployment `39232177088` — **success**.
- Критический настоящий live WASM browser test `39231640175`, **attempt 2 SUCCESS** после публикации бинарника. Вызывается не mock и не fallback, а кнопка HTML внутри реального TraceDraw, запускающая `gwb_tracedraw_request_apply` в Rust. Проверено импортирование исходного SVG, реальный bbox `x≈3,y≈4,w≈16,h≈8 мм` для поля `60×35 мм`, `<rect>` в экспортированном SVG, размеры SVG в мм, отсутствие экспорта всего поля.
- Первая попытка live теста произошла до развёртывания новой версии и не нашла новую HTML-кнопку; успешная вторая попытка закрыла проблему.

## Защита существующих данных
- Source и production `mockup-profiles.json` SHA `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, `method-settings.json` SHA `cbf6c8204e4fb3892d806342d37debefb8d9038e`. Не переписывать.
- PrintCheck, Editor of mockups, библиотека сохранённых PDF, сохранение в IndexedDB/недоступный частный сервер и другие инструменты «Макетной» не изменены.
- Переход SVG проходит только при совпадении токена текущего поля и физических размеров. При закрытии без применения исходное нанесение не меняется.
- Старые резервные ветки доступны для безопасного отката.

## Честные ограничения и следующая работа
- Текущий embedded-режим TraceDraw принимает **SVG и PDF**. Upstream полноценный TraceDraw понимает CDR/CMX и другие форматы, но напрямую принимать их внутри этой сессии активного поля **пока не реализовано**. Не рекламировать CDR handoff как работающий.
- Текущий режим предназначен для одной выбранной области нанесения; создание/открытие других документов при использовании внутренних меню upstream может потребовать отдельной блокировки в будущем.
- Протестирована форма/геометрия реального Rust, не полная функциональность всех инструментов TraceDraw.
- Для финального полного QA полезно дополнить тесты редактированием конкретных фигур по щелчкам и размером поля для разных исходных форматов.
