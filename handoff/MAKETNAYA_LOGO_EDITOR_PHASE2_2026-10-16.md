# Макетная — Редактор логотипа, этап 2 — 2026-10-16

## Итого
- `assets/logo-editor.js`: SVG редактор научился работать с выбранным логотипом прямо из штатного состояния Макетной; при нажатии «Применить в шаблоне» использует мост `gwbApplyEditedLogoToActiveField(file,token)` вместо повторной глобальной загрузки, сохраняя x/y, width/height, rotation, clipToField.
- `tools/patch-logo-editor-bridge.mjs`: патч, защищённый SHA-256 финального `assets/index-BpU9kvz8.js` (исходное post-preflight значение `99b12826...`). Встраивает только `gwbGetActiveLogoForEditor` и `gwbApplyEditedLogoToActiveField` в существующую замкнутую область minified bundle. `tools/build-launcher.mjs` вызывает этот патч строго после `applyLogoPreflight()` и перед сборкой embed srcdoc.
- Bridge читает `y.placements[y.active].art.bytes`, возвращает File и snapshot token привязанный к active index/fieldIndex/page/name. При сохранении блокирует замену, если поле/логотип изменился. Никаких данных клиента не сохраняется в Git; никакого общего изменения других полей.
- `assets/logo-path.js`: новая нормализация M/L/H/V/C/S/Q/T/Z, при SVG A/a не меняет путь; сглаживание ломаных в кубические кривые.
- UI `editor.html` подключает path script до editor. Добавлены: «Узлы (N)» с перемещением узлов и контрольных точек C/Q, «Сгладить контур», множественное выделение через Shift + «Группировать», «Разгруппировать», растровая обрезка по процентным отступам из изображений внутри SVG.
- SVG импорт сохраняет безопасные атрибуты заливки/обводки, описанные в inline style или class-level style (.st0) из Illustrator/Corel, стили превращаются в SVG presentation attributes, потенциально исполняемые style/script/external references удаляются. Плашечные краски не гарантируются в экспортируемом SVG.

## Тесты
- `tests/logo-editor-browser.mjs`: новая проверка наличия bridge в собранном bundle; реальная работа в тестовой странице: SVG и растр, текст, кривые, перемещение управляющих точек, экспорт, raster crop, санитизация, сохранение SVG CSS class fill, re-open after input reset, изоляция между двумя полями с одинаковыми именами файла.
- `.github/workflows/publish-maketnaya-mockups.yml`: вызывает этот browser тест после теста цилиндрических мокапов.
- Сборка `38891618301` для source `3ae5e955a311...` прошла precheck + publish + browser_verify (success).
- Следующая поправка `e1eebbabfa85890e34f94674fc19a31cbc80c252` усиливает CSS-поддержку, её нужно независимо проверить по новому CI, не предполагать успех только по прежним тестам.

## Резервные точки
- `backup-before-logo-editor-phase2-20261016` = `6013a47844763ca4ea2ab08ea21536070e413528` (источники до 2-го этапа).
- `backup-published-before-logo-editor-phase2-20261016` = `94522a0049caf16c84cf3c6ef59a337c6e6ffeb3` (публикация до этапа 2).
- `backup-logo-editor-phase2-pre-svg-styles-20261016` = `3ae5e955a3112502ef4d0c8759f9a2885f3c62b2` (второй этап до CSS).
- `backup-published-logo-editor-phase2-pre-svg-styles-20261016` = `9df175ba40d08c741922ce1f336df1a395fd2819`.
- Вся dev история сохранена как `feature-logo-editor-phase2-20261016`.
- `mockup-profiles.json` SHA `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` не меняли.
- `method-settings.json` SHA `cbf6c8204e4fb3892d806342d37debefb8d9038e` не меняли.

## Технические ограничения для следующего этапа
- Не нарушать историю и точные привязки order/place/art, цилиндрические мокапы и PrintCheck v25; уже принятый source baseline.
- Не считать SVG с embedded `<image>` чистым вектором — классификация PrintCheck mixed/raster сохраняется.
- PDF/AI/CDR/EPS пока не редактируются как полноценные исходные векторные контуры; пользователю выводится предупреждение, можно создать новый SVG вместо.
- Текст SVG сохраняется как текст — перевод шрифтов в кривые не выполнен, spot-сепарации не гарантированы.
- Unsupported SVG arcs A/a оставляются неизменными, редактирование контрольных точек относится к M/L/C/Q paths. Корректная поддержка эллиптических дуг и boolean-union/subtract/intersect — следующие инженерные задачи.
- Цвета class-based/inline SVG теперь сохраняются в виде SVG-атрибутов в пределах безопасного whitelist; complex CSS selectors по-прежнему не перенесены.
- На любом rollout обязательно проверить source SHA, published Pages, GitHub Actions и свежие mockup profile blob; rollback UI не должен откатывать последние привязки.
