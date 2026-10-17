# Макетная × VectorCraft — одна кнопка переноса, 17.10.2026

## Запрос
Оставить кнопку переноса только внутри настоящего VectorCraft (Rust/egui), переименовав её в **«Перенести на шаблон артикула»**. Убрать «Применить в Макетной» из верхней панели оболочки, не менять алгоритм размещения/экспорта.

## База и резервирование
Предыдущие подтверждённые: source `aab6401347ff45e49e6f173d931c0ed09a5bc6f0`, production `eec24b5221f3a8926b2baf9655e9f2cc4e910848`.
Сохранены независимые ветки:
- `backup-before-vectorcraft-transfer-only-20261017-source`
- `backup-before-vectorcraft-transfer-only-20261017-production`

## Изменения
- `tools/patch-vectorcraft-gifts-theme.py`: штатная кнопка в верхней панели egui теперь подписана «Перенести на шаблон артикула». Для длинного русского текста слот расширен с 176 до 242 условных единиц egui; вертикальное смещение -3 сохранено. Событие `gwb_native_toolbar_apply` -> `gwb-vectorcraft-apply-request` не менялось.
- `assets/vectorcraft-integration.js`: убрано включение второй кнопки в `bar.append(...)`. Оставлен **только внутренний detached trigger**, не присоединённый к DOM, для сохранения прежнего доверенного маршрута экспорта `s.apply.click()` после проверки token/origin/source/active field. Не менялись возвращаемые SVG, координаты, размеры, подтверждения и действия ошибок.
- `editor.html`: новая метка cache busting для host script.
- `tests/vectorcraft-handoff-browser.mjs`: отсутствие второй кнопки как в нормальном, так и в fullscreen; передача SVG и native PDF по сообщению из проверенного iframe в том же pipeline.
- `tests/vectorcraft-gifts-theme.test.mjs`: точное новое название, отсутствие старого caption, слот 242 и отсутствие top-bar duplicate.

## Инварианты
- Настоящий документ VectorCraft один, при возврате только нарисованная геометрия.
- Положение и размер логотипа, поле нанесения и ограничения PrintCheck без изменений.
- Настройки `method-settings.json` и реестры `mockup-profiles.json` **не редактировать**.
- Сохранять право отката по frozen веткам; не изменять production бинарник до успешной компиляции.
- Условие показа штатной кнопки по прежнему embedded/single-field и открытому документу.

## Проверки и релиз
CI основной Макетной `39059696864` — success (precheck/publish/browser_verify).
Rust/WASM build `39059627550` — **SUCCESS**.
GitHub Pages `39060384484` — **SUCCESS**.
Основной финальный CI `39060040566` — **SUCCESS** (precheck / publish / browser_verify).
Реальный опубликованный VectorCraft/WASM в Chromium: workflow `39056115362`, attempt **4** — **SUCCESS**, нажатие внутри штатной панели и возврат SVG.
Зафиксированы **замороженные checkpoint**, не перезаписывать:
- SOURCE: `checkpoint-vectorcraft-transfer-only-20261017-source` = `4cebf8079719222d4d5b32bdb85f3f3561f01c4c`.
- PRODUCTION: `checkpoint-vectorcraft-transfer-only-20261017-production` = `6a185282fc6221995b9853fe8db61e618256a3a7`.
Подтверждены идентичные source/main Git blob SHA: `mockup-profiles.json` `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
Для обхода кэша при смене движка `assets/vectorcraft-integration.js` содержит `index.html?v=20261017-transfer-only-1` — URL-параметр не влияет на token в hash.
