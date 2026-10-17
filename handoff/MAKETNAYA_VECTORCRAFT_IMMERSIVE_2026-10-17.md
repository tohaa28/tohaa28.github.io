# Макетная × VectorCraft — полноэкранный режим и действия, 17.10.2026

## Пользовательский запрос
- Скрыть в пользовательском интерфейсе переключение на старый редактор и стандартную тему VectorCraft; **не удалять сами реализации**.
- Добавить полноэкранный режим, чтобы оболочка Макетной не мешала правке.
- Разместить «Применить в Макетной» прямо внутри VectorCraft, оставив исходную кнопку сверху.
- Скрывать внешнюю «Закрыть Макетную» на всё время работы VectorCraft; восстанавливать при закрытии.

## База и резервирование
Рабочая ветка: `gifts-layout-workbench-mockups-source`, из исходного HEAD
`08f20bc56fb4b84affef873aac396ce21817bc97`.
Production база `main`: `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01`.
Созданы независимые backup refs:
- `backup-before-vectorcraft-immersive-ui-20261017-source` — `08f20bc56fb4b84affef873aac396ce21817bc97`.
- `backup-before-vectorcraft-immersive-ui-20261017-production` — `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01`.
Ранее замороженные checkpoint на art-only (16.10) и gifts-default (17.10) не изменены.

## Реализация
1. `assets/vectorcraft-integration.js`: старый/стандартный переключатели остаются с существующими callbacks, но `hidden=true` + `display:none`; по умолчанию gifts. Добавлена внешняя верхняя кнопка `На весь экран`, вызывающая Fullscreen API по пользовательскому нажатию. В полноэкранном режиме скрыты обе панели оболочки (верхняя и нижняя), сам редактор заполняет экран. Выход стандартной клавишей Esc. После возврата панели восстанавливаются через `fullscreenchange`. При закрытии происходит cleanup.
2. В том же файле принято новое доверенное сообщение `gwb-vectorcraft-apply-request` от выбранного iframe: проверяются window-origin-session и вызывается `s.apply.click()` — **общая** экспортная логика, без обхода защиты исходного поля.
3. `tools/patch-vectorcraft-gifts-theme.py`: после `app.logic(ctx)` в настоящем egui VectorCraft в embedded mode выводится `egui::Area` с зелёной кнопкой `Применить в Макетной`; она отправляет событие хосту. Исключение для standalone VectorCraft сохранено. Этот патч требует отдельной сборки Rust/WASM.
4. `tools/build-launcher.mjs`: внешний родительский gifts.ru-лаунчер разрешает fullscreen для внутреннего iframe. Слушает `gwb-maketnaya-vectorcraft-visibility` только из **своего** дочернего frame с тем же origin; во время редактора `gwb-close` скрывается и блокируется. После выхода снова видим.
5. `editor.html`: новый cache-buster `vectorcraft-integration.js?v=20261017-immersive-1`.
6. `tests/vectorcraft-handoff-browser.mjs`: тесты default gifts, скрытых переключателей, входа/выхода fullscreen, in-engine Apply relay, прежней верхней кнопки, возврата геометрии, соседнего поля, native PDF. `tests/vectorcraft-gifts-theme.test.mjs` добавлены source-контракты.

## Статус проверок на момент создания записи
- `39053513602`: precheck **success**; publish **success**; browser_verify **success**.
- Rust/WASM сборка `39053257592` была запущена из `f58384afc0cc2851b702536d9428d86b7ef1342d`; для подтверждения необходимо проверить её конечный статус и новую публикацию binary в production, а затем выполнить подлинный live WASM browser test.
- Серверные реестры `mockup-profiles.json` и `method-settings.json`: blob SHA после публикации остаются `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` и `cbf6c8204e4fb3892d806342d37debefb8d9038e` одновременно в source/main.

## Инварианты и возобновление
Не менять верный art-only SVG export, `logoBoundsMm`, field mm и guard выбранного поля; не менять PrintCheck, mockup cylinder, заказ/constructor mapping и реестры при UI rollback. Скрытые переключатели НЕ удалены — их можно вернуть по будущему требованию. Восстанавливать UI из backup SOURCE и runtime из backup PRODUCTION с учётом актуальных JSON (не затирать новые записи).

## Окончательное подтверждение и заморозка
- Rust/WASM build `39053257592` — **success**, новая скомпилированная версия `vectorcraft-web-cecc7b2ddbc94ebb_bg.wasm` опубликована в `main`.
- Pages `39053939083` — **success** после WASM; окончательный Pages `39054084859` — **success**.
- Реальный Chromium + новый WASM `39054009562` — **success**. Тест **нажал настоящий egui Apply** через canvas, получил `gwb-vectorcraft-apply-request`, вернул SVG по видимой геометрии и сохранил x/y/w/h. Это не mocked JS.
- Финальный обычный CI `39054009557` — **success** (precheck / publish / browser_verify).
- Зафиксированная **функциональная source версия** `b58a7a024bc5c45ce586494d279b33cf34d97e48`, опубликованная `main` **`7a54ade50995414ef41c04e450cd13a0509ab182`**.
- **Замороженная checkpoint source**: `checkpoint-maketnaya-vectorcraft-immersive-20261017-source`, SHA `b58a7a024bc5c45ce586494d279b33cf34d97e48`.
- **Замороженная checkpoint production**: `checkpoint-maketnaya-vectorcraft-immersive-20261017-production`, SHA `7a54ade50995414ef41c04e450cd13a0509ab182`.
- Json SHA unchanged, source/main identical: mockup profiles `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, method settings `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
Документационные коммиты после контрольной точки не заменяют вышеуказанный проверенный рабочий код.
