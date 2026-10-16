# Макетная — прямое редактирование импортированных векторов, 16 октября 2026

## Задача пользователя
Встроенный «Редактор логотипа» обязан изменять существующий вектор из выбранного поля, а не работать с импортированным объектом как с одной картинкой. Рассмотрен https://github.com/storytold/vectorcraft: dual MIT/Apache-2.0, готовый браузерный WASM UI написан на Rust, не является вставляемым JS-виджетом. **Код VectorCraft не копировался и не использовался как embedded runtime**; его подход (SVG/PDF как редактируемые фигуры) выбран как архитектурный ориентир. Не утверждать, что VectorCraft уже встроен. Для полноценного VectorCraft WASM нужен отдельный build/deploy и протокол передачи в исходное поле.

## Изменения
1. `assets/logo-editor.js`: выделение/редактирование вложенных SVG `g > svg > g > path` без предварительного разбора оболочки. `owner()` возвращает внутренний графический элемент; `select()` поддерживает descendants. Дерево слоёв рекурсивно показывает пути и вложенные группы, в том числе импортированные из Illustrator/Corel SVG. Движение выбранного пути считает координаты относительно родительской матрицы. Режим при новом открытии — «Выбор». Изменение заливки, обводки, текста, узлов, дублирование, удаление, порядок, undo/redo и Apply используют штатный SVG DOM.
2. `assets/logo-pdf-import.js`: новый изолированный fail-closed конвертер `gwbImportPdfVector.convert({ops,width,height,transform})`. Преобразует PDF.js v5 `constructPath` (`DrawOPS` M/L/C/Q/Z) в SVG path с исходной matrix, простым RGB-цветом, stroke-width, dash, fill-rule. Не растрирует, не делает вид, что обработал изображения и неподдерживаемые PDF-операторы.
3. `tools/patch-logo-editor-bridge.mjs`: SHA-guarded bridge `gwbGetPdfLogoVectorOps(token)` читает **активное** `y.placements[y.active].art.pdfPage.getOperatorList()`, проверяет token order/field/page/logo name и переводит числовые PDF.js OPS через исходный `xt` в читаемые названия. Предыдущий `gwbGetActiveLogoForEditor()` и `gwbApplyEditedLogoToActiveField(file,token)` не заменены и продолжают сохранять geometry и clipToField.
4. `editor.html` подключает `./assets/logo-pdf-import.js?v=20261016-vector-1` до `logo-editor.js`.
5. `tests/logo-editor-browser.mjs`: проверяет SVG deep selection, перекрашивание импортированного path, PDF simulated original opList->SVG path, редактируемые узлы и возврат в выбранное поле, и fail-closed сохранение original PDF если файл содержит изображение. Проверяет наличие bridge в собранном compiled bundle.

## Ограничения
- Работают векторные SVG и **простые PDF / PDF-совместимые AI**, которые содержат геометрические пути без иных сложных PDF-операций.
- SVG arc-команды A/a, сложные CSS/effects/clip symbols и вложенная композиция могут требовать дополнительной поддержки при редактировании; не объявлять полное соответствие Illustrator.
- PDF с текстом, растром, CMYK/spot, клиппингом или непрозрачностями отвергается вместо потерь. Это сознательная fail-closed защита, не полная совместимость PDF. CDR/EPS и обычный AI без PDF-compatible содержимого не редактируются.
- Конвертация простых PDF в SVG сохраняет геометрию и исходный placement, но исходный формат для «Применить» меняется на SVG. Для CDR/EPS и полного AI/PDF парсинга в следующем этапе рассмотреть VectorCraft WASM (Rust/Trunk), со сверкой лицензии, assets и необходимым импорт/экспорт мостом.
- `mockup-profiles.json` и `method-settings.json` не менять, всегда сверять актуальные blob SHA с main при публикации и rollback.

## Backup
- `backup-before-vector-import-20261016` source = `3fd453c194e60f385528414e3fba2ed016b3f34e`
- `backup-published-before-vector-import-20261016` main = `325f79a2054dc3ce82b6a561d3e0f3b04aaf45a3`
- `feature-real-vector-import-20261016` feature branch, verified source functional commit `42429eceea7af29031cd75e77ec92b9a82b2b877`
- build workflow `38895008786` — check precheck / publish / browser_verify completion, not assume success without result.
