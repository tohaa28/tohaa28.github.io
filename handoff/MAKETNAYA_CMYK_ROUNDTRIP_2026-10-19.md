# Макетная — сохранение CMYK при возврате логотипа (19 октября 2026)

## Проблема и техническая причина

Рабочий документ в VectorCraft и TraceDraw переключался в CMYK, но возвращался в Макетную как SVG. Стандартные операции экспорта SVG и последующая конвертация в PDF через jsPDF/svg2pdf превращали печатные цвета в экранные RGB. Метка CMYK на документе не гарантирует CMYK каждой заливки.

## Реализация

1. `tools/vectorcraft-bridge.rs`: кроме SVG для контроля границ и просмотра, нативный Rust-движок экспортирует реальный одностраничный PDF с `useArtboards:false` (физические габариты рисунка). Строгая проверка ColorMode::Cmyk; при ошибке экспорта PDF SVG отдельно не применяется.
2. `tools/tracedraw-embedded.rs`: экспортирует PDF через `tracedraw_io::pdf::document_to_pdf(app.doc())`, наряду с SVG/viewBox фактического рисунка. Документ должен оставаться CMYK.
3. `assets/cmyk-roundtrip.js`: проверяет PDF в pdf-lib: ровно одна страница, физический размер, подлинные `k/K` процессные CMYK-операторы или CMYK изображения, запрет `rg/RG` RGB. Неуверенные/ICC-неразобранные цветовые пространства не объявляются автоматически корректными. Для TraceDraw `cropFieldPdf` меняет `MediaBox` и `CropBox` по реальным mm габаритам, не меняя PDF content streams и палитру.
4. `assets/vectorcraft-integration.js`, `assets/tracedraw-integration.js`: используют SVG только для сверки геометрии, но отправляют в Макетную PDF (не SVG). Строго проверяют признак `nativePdf`, `colorSpace:'CMYK'` и реальный PDF; никаких неявных fallback в RGB.
5. `tools/patch-logo-editor-bridge.mjs`: принимает PDF только при `nativePdfCmyk:true`, сверяет физический размер PDF со значениями `artworkBoundsMm`, сохраняет оригинальные PDF байты в `y.placements`. При создании итогового PDF существующий движок `hn` встраивает исходную страницу через `pdf-lib.embedPage` (без svg2pdf), сохраняя цветовые операторы.
6. `editor.html` подключает проверку до обоих редакторов; обработчики запуска и возврата для выбранного поля/артикула не изменены. Личная PDF-библиотека, PrintCheck, Mockup Lab, Undo/Redo и обработка заказов не модифицированы.

## Проверки и ограничения

- Выполнен реальный тест с библиотекой `vendor/pdf-lib.min.js`: C/M/Y/K = 0.75/0.2/0.1/0.4 сохранились после crop PDF; RGB PDF с `rg` отклонён.
- `tests/cmyk-roundtrip-browser.mjs` добавляет Chromium-проверку подлинных операторов и crop.
- Обновлены `tests/vectorcraft-handoff-browser.mjs`, `tests/tracedraw-integration-browser.mjs`, `tests/tracedraw-runtime-browser.mjs`, release workflow и version stamper.
- Компиляция обоих WASM подтверждена новыми коммитами в `main`: TraceDraw `0da054c67399a8ae115eb61962d5427443df0c85`, VectorCraft `39d8be69f57b33b038a0904045203b5528cdf9db`.
- Обычные интерфейсные модули, мост компилированной Макетной и оба bookmarklet launcher опубликованы в `main` (проверяйте HEAD).
- Живой браузерный тест сайта через gifts.ru в этой сессии недоступен; не утверждать, что он прошёл.
- **Важно:** CMYK working-space НЕ преобразует автоматически RGB-заливки исходного рисунка в CMYK. Если реальный PDF содержит RGB, перенос останавливается с явным сообщением. Нельзя объявлять их цветоделениями CMYK или конвертировать без решения пользователя. ICC/DeviceN/spot требует отдельного углублённого цветового аудита для безусловного подтверждения.

## Контроль и откат

- **До изменений** source `51db65aee6ea4b4eadb03d75a2f53026dc2c1908`, production `469f1c851268a2f9f108d34ea8345387773f16f7`.
- Резервные ветки `backup-before-cmyk-roundtrip-20261019-source`, `backup-before-cmyk-roundtrip-20261019-production`.
- Версия production HTML `Макетная rba8a5812` (возможно будет перезаписана авто-stamper при публикации из source).
- Исходные профили не изменены: `mockup-profiles.json` blob `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, `method-settings.json` blob `cbf6c8204e4fb3892d806342d37debefb8d9038e`.

## Дальнейшие испытания

На реальном заказе проверить PDF после редактирования VectorCraft и TraceDraw: инспектор PDF должен показывать DeviceCMYK/истинные spot, а не DeviceRGB, сравнить значения каждой краски с исходными заливками и проверить несколько мест нанесения. Для ICC/DeviceN/Spot реализовать профиль-зависимую сверку, а не маркировку по экранным RGB. 
