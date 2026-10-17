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
Rust/WASM build `39059627550` — запущен; окончательное состояние подтвердить в GitHub Actions перед следующей работой.
После завершения WASM подтвердить GitHub Pages и выполнить live Chromium VectorCraft regression, а затем сделать отдельные frozen source/production checkpoint.
