# Встроенный редактор логотипа — передача контекста (16 октября 2026)

## Реализовано
В Макетной рядом с `#editorAddLogo` расположен `#editorOpenLogoEditor`; добавлен `assets/logo-editor.js` (отдельный DOM/SVG редактор), подключение через `editor.html`, а `tools/build-launcher.mjs` автоматически переписывает URL ассета в `launcher.js` для запуска на gifts.ru в srcdoc. Исходная логика размещения, PrintCheck и мокапов не изменялась.

Функции: создавать SVG и редактировать базовые примитивы (rect, ellipse, line, pen/polyline, freehand/path), выбирать, перемещать, масштабировать, вращать, перекрашивать, устанавливать обводку, прозрачность, дублировать, удалять, упорядочивать объекты, разгруппировывать, отменять и повторять изменения. Добавлять/менять текст. Импорт SVG с сохранением векторной геометрии и viewBox, PNG/JPG/WEBP как растровые изображения внутри SVG. Экспорт SVG. «Применить в шаблоне» создаёт File(image/svg+xml), присваивает существующему `#artwork` через DataTransfer, вызывает input/change и штатный загрузчик/PrintCheck. Отмена не переписывает загруженный файл.

## История
Исходный rollback commit: `ec315c89f24a60022133b58b361d948537005235`. Созданы защитные ветки:
- `backup-before-integrated-logo-editor-20261016` (source);
- `backup-published-before-integrated-logo-editor-20261016` (main);
- `feature-integrated-logo-editor-20261016` (рабочая ветка).
Функциональный head 16 октября: `5e0352a733de9d928ceacb2d049ef28e2e0c2f19`, опубликован workflow `publish-maketnaya-mockups.yml`.
Все изменения только в `editor.html`, `assets/logo-editor.js`, `tests/logo-editor-browser.mjs`, CI-workflow. `mockup-profiles.json` SHA `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` и `method-settings.json` SHA `cbf6c8204e4fb3892d806342d37debefb8d9038e` неизменны (source=published).
CI содержит `node tests/logo-editor-browser.mjs` после проверки mockup-cylinder. Первый CI упал на асинхронной ошибке теста; исправлен expect с waitFor. Второй CI `38883110470` успешно прошел precheck, publish, browser_verify; последняя версия `5e0352a...` запуск `38883566926` — уточнить перед новым изменением.

## Важное поведение загрузчика
Существующий minified bundle `assets/index-BpU9kvz8.js`: `v("artwork").onchange=c=>Ai(c,"art")` и в конце `finally{c.target.value=""}`. Новый редактор подписывается на file input в capture phase и кэширует File **только в RAM текущей вкладки**, по подписи field/order (до 25 файлов); это позволяет редактировать повторно уже размещённый логотип. Не сохраняйте файлы клиентов в Git/localStorage и не заменяйте штатный onchange. При недоступности исходника сообщить пользователю, а не молча заменять пустым SVG.

## Безопасность / ограничения
- SVG импорт санитизирует опасные скрипты, handlers, внешние ссылки и стили; browser test покрывает import.
- Растровые изображения даже внутри SVG остаются растром; PrintCheck `assets/logo-preflight.mjs` классифицирует его как mixed, проверка числа красок и vector-only действуют.
- Встроенное редактирование PDF/CDR/AI/EPS пока не реализовано. Не объявлять их полностью поддерживаемыми. Редактируемый текст остаётся SVG text, а не кривыми. Для производства нужен будущий инструмент перевода текста в кривые/шрифтов.
- В будущем: точное редактирование узлов/Bezier, выравнивание, группирование, raster crop/cleanup, фигуры/булевы операции, работа с типографскими цветами, восстановление PDF/CDR через конверсию, стабильный per-field source accessor из внутреннего editor state.
- Следовать `gifts-layout-workbench/PRINCIPLES.md` в main: перед любыми rollback/публикацией сохранить свежие mockup-profiles и исходное дерево, проверить CI и GitHub Pages, не делать force push вслепую.
