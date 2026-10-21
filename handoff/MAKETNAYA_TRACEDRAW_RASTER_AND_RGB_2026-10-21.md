# Макетная — TraceDraw: передача растра и возврат RGB

**Дата:** 21 октября 2026  
**Исходный релиз:** `c88ccf7c30a6098c9497c9dfb0db8f1c72f1d560` (ветка `gifts-layout-workbench-mockups-source`)  
**Макетная:** `r72ed5a64` (опубликована)  
**GitHub Actions:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598798765 — `precheck`, `publish`, `browser_verify` успешны.  
**Живой тест TraceDraw WASM:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598798699 — успешно, реальный PDF содержит /Subtype /Image + SVG path и image.  
**Отдельная сборка защитного Rust guard:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598763127 — при создании документа находилась в процессе сборки; перед завершением работы проверить её статус и итоговый SHA `main`.

## Запрос

«Почему-то сейчас в tracedraw передается только вектор, а растр не передается. Нужно исправить. В vectorcraft всё передается правильно. И еще, если в редакторе в макете есть RGB — все равно возвращать их в макетную».

## Диагностика

Фиксированный исходник TraceDraw: `igtoth/tracedraw@0f206489770adcacc6cc130a9e31a5610faad68a`.

1. `assets/vectorcraft-field.js` раньше помещал JPG/WebP в SVG как `data:image/jpeg` или `data:image/webp`. Однако pinned `crates/io/src/svg_import.rs` обрабатывает `usvg::ImageKind::PNG`, а для прочих кодеков возвращает `None` — изображение молча терялось.
2. `assets/cmyk-roundtrip.js` отклонял PDF при любом `rg` / `RG` и `DeviceRGB` XObject. Смешанные изображения, RGB-объекты и RGB-растр не могли вернуться из TraceDraw (и иногда VectorCraft), хотя PDF реально содержал их.
3. `tools/tracedraw-embedded.rs` запрещал возврат, если метаданные рабочей модели документа `PrimaryColorMode` не были CMYK, несмотря на то, что стандартный PDF TraceDraw сохраняет RGB.
4. Живой тест на старой 1×1 LA PNG фиксировал, что SVG возвращает `<image>`, но PDF не содержит `/Subtype /Image`. Исправлен тест на обычный **8-битный RGBA PNG**, соответствующий результату Canvas, и добавлена защита от потери растровых объектов на уровне Rust экспорта.

## Решение

- `assets/tracedraw-raster-bridge.js` (новый): перед открытием в TraceDraw разбирает подготовленный SVG, преобразует встроенные JPEG/JPG, WebP, GIF, BMP в `data:image/png;base64` через декодер браузера и Canvas в **полном исходном разрешении**. Вектор, `viewBox`, размеры, размещение, матрицы поворота, альфа и последовательность объектов сохраняются. PNG и исходные PDF остаются без изменений. Внешние источники изображений не допускаются, повреждённые и чрезмерно большие файлы отклоняются с ошибкой вместо молчаливого пропуска. Важно: декодирование Canvas может применить управление цветом к JPEG с ICC; гарантируется отсутствие принудительного перевода в CMYK, но не двоичное сохранение исходного JPEG.
- `editor.html` загружает этот модуль до `assets/tracedraw-integration.js`.
- `assets/tracedraw-integration.js` применяет `normalize(prepared)` при открытии; принимает `CMYK` **или** `RGB` как модель документа; передаёт оригинальный печатный PDF, а не SVG, через `gwbApplyEditedLogoToActiveField(...,{nativePdfColors:true,colorSpace:d.colorSpace})`.
- `assets/vectorcraft-integration.js` тоже больше не отклоняет RGB; передаёт PDF с `nativePdfColors:true`; имя не вводит в заблуждение суффиксом `-cmyk.pdf`.
- `assets/cmyk-roundtrip.js` проверяет корректную структуру, габариты и страницу PDF, учитывает PDF `rg/RG`, `k/K`, `DeviceRGB`, `DeviceCMYK`, `ICCBased` и плашечные краски. Возвращает `model: RGB/CMYK/Mixed/Gray`; `cropFieldPdf` **меняет только MediaBox/CropBox**, не конвертирует растр/цвета/вектор.
- `tools/patch-logo-editor-bridge.mjs`: новый параметр `nativePdfColors:true`; обратная совместимость с прежним `nativePdfCmyk:true`, но без принудительного требования CMYK; проверки выбранного артикула, поля, physical bounds, размера и оригинального PDF сохранены.
- `tools/tracedraw-embedded.rs` передаёт реальную рабочую модель `RGB` или `CMYK`; убрано запрещение экспортировать документ RGB; добавлена проверка: когда SVG содержит `<image `, результирующий PDF **обязан** содержать `/Subtype /Image`, иначе TraceDraw отправляет ошибку и Макетная не заменяет лого.

## Регрессионные тесты

- `tests/tracedraw-raster-browser.mjs`: JPEG и WebP переводятся в PNG, включая физический размер, rotation и целый viewBox; смешанный SVG сохраняет исходный vector path и растровый image; PNG и PDF сами по себе не изменяются; внешние картинки не допускаются.
- `tests/cmyk-roundtrip-browser.mjs`: проверка CMYK вектора, RGB вектора, смешанной страницы CMYK-vector+RGB-image и `cropFieldPdf` со сохранением изображения.
- `tests/tracedraw-integration-browser.mjs`: возвращаемый PDF с CMYK и с RGB, изолированное выбранное поле и блокировка действий при передаче.
- `tests/vectorcraft-handoff-browser.mjs`: обновлённый параметр `nativePdfColors:true`, сохранение исходного PDF.
- `tests/tracedraw-runtime-browser.mjs`: реальный WebAssembly TraceDraw открывает смешанный SVG, сохраняет `<path>` и `<image>`; проверяет наличие RGB-растра в PDF `/Subtype /Image`. Прошёл GitHub Actions run `39598798699`.

## Безопасность и откат

Исходные точки:
- `backup-maketnaya-tracedraw-rgb-raster-20261021-source` → `a7043a6a888ceaf22ce0469ed15ffb4f4314aa67`.
- `backup-maketnaya-tracedraw-rgb-raster-20261021-production` → `d15c45a5a6a952e0016f692f0d8516198615618d`.

Проверенный source:
- `checkpoint-maketnaya-tracedraw-raster-rgb-20261021-source` → `c88ccf7c30a6098c9497c9dfb0db8f1c72f1d560`.

Опубликованный production закрепить **после** завершения отдельной сборки Rust WebAssembly, чтобы не закреплять старый движок TraceDraw.

Реальные пользовательские PDF в gifts.ru **не изменялись**. Результат проверен контролируемыми браузерными PDF и настоящим TraceDraw WebAssembly. Настройки/привязки пользователей не затрагивались.

**Важно:** разрешение возвращать RGB не означает автоматического соответствия техническим требованиям печати. Их проверяет отдельный PrintCheck; редакторы больше не теряют RGB в момент обратной передачи.

---

## Финальная проверка и production (21.10.2026)

- **Сборка нового Rust TraceDraw guard:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598763127 — `compile_tracedraw` SUCCESS, реальный WebAssembly бинарник опубликован в `main/gifts-layout-workbench-mockups/tracedraw/`. Пинованный upstream остался `0f206489770adcacc6cc130a9e31a5610faad68a`.
- **Общая сборка Макетной:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598798765 — `precheck`, `publish`, `browser_verify` SUCCESS.
- **Живой Rust/WASM тест с вектором и растром:** https://github.com/tohaa28/tohaa28.github.io/actions/runs/39598798699 — SUCCESS.
- **Окончательный опубликованный production SHA**: `ebb6d4b1ab2374f5524cc34c852ecd1c05dee89f`; UI: **Макетная r72ed5a64**.
- **Контрольная точка production:** `checkpoint-maketnaya-tracedraw-raster-rgb-20261021-production` → `ebb6d4b1ab2374f5524cc34c852ecd1c05dee89f`.
- **Контрольная точка исходников:** `checkpoint-maketnaya-tracedraw-raster-rgb-20261021-source` → `c88ccf7c30a6098c9497c9dfb0db8f1c72f1d560`.
- В production и source совпадают пользовательские JSON-профили `mockup-profiles.json` и `method-settings.json`; их данные не изменялись.

**Ограничение проверки:** живой WebAssembly-тест проверяет смешанный SVG и растровый Image XObject, но реальные приватные вложения Gifts в авторизованной сессии пользовательского браузера не изменялись и не загружались.
