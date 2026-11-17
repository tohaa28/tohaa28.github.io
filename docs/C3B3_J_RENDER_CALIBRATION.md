# PrintCheck Vision — C3B.3.J: проверяемая цепочка PDF/SVG → PNG → мм

Дата: 2026-11-17. Статус: исследовательская проверка целостности и аффинных преобразований. Производственная «Макетная» не изменена. Рабочая ветка feature/printcheck-vision-copy-v01, PR #4 DRAFT.

## Исправленная проблема

C3B.3.I проверял PNG по точным байтам и пересчитывал визуальные отпечатки, но не связывал их с оригинальным SVG/PDF и размещением на физическом поле заказа. C3B.3.J вводит отдельный **доверенным ключом подписанный отчёт renderer/calibration**: он связывает SHA-256 оригинального PDF/SVG, PNG и доказательного файла заказа с двумя матрицами и контрольными точками.

Важно: цифровая подпись подтверждает, что данные согласуются с утверждением владельца ключа. Она не доказывает, что PNG визуально идентичен содержимому исходного PDF, а сведения о поле действительно пришли от Gifts.ru.

## Реализованные модули

1. vision/dataset/render-calibration-attestation.mjs — проверка подписанного Ed25519 receipt с заранее независимо закреплённым SHA-256 DER SPKI ключа, точных байтов исходника/PNG/order evidence, размеров и аффинной калибровки.
2. vision/dataset/locked-pilot-gate.mjs — renderCalibrationInput теперь обязателен. Подписанный receipt должен ссылаться на **те же** оригинал, PNG и документ заказа, что и в pilotInput. Если нет, evaluation_allowed=false и MANUAL. Это исследовательское разрешение, не производственный OK.
3. vision/dataset/verify-render-files.mjs — локальный CLI, который читает 6 файлов с ограничениями размера, отказывает по symlink, проверяет подпись и не выводит закрытые имена файлов/хеши.
4. tests/printcheck-vision-render-calibration.test.mjs и tests/printcheck-vision-render-files.test.mjs — синтетические положительные, отрицательные и интеграционные проверки.

## Математика

Отчёт имеет контракт printcheck.vision.render-calibration.v1 и включает source_sha256, preview_sha256, order_evidence_sha256, source_format, source_page_box, pdf_user_unit, page_rotation_degrees, source_document_size_mm, preview_pixel_dimensions, field_size_mm, две матрицы и anchors.

Координаты источника и расположения задаются двумя матрицами [a,b,c,d,e,f]:
- source_to_preview_px — координаты документа в пиксели PNG;
- source_to_field_mm — координаты документа в физические миллиметры поля.

Для SVG независимо проверяются начальный XML-корень, физические width/height (mm/cm/in/pt), viewBox, xmlns и отсутствие опасных/внешних конструкций в узком поддерживаемом подмножестве. Ожидаемая матрица source→PNG пересчитывается из viewBox и размеров PNG. Это **не полный SVG-парсер или renderer**.

Для PDF проверяются header/trailer как сигнатуры файла, а матрица viewport вычисляется из заявленных page box и page rotation (0°, 90°, 180°, 270°) с учётом направления оси Y. Физический размер выводится из заявленных user units × UserUnit × 25.4/72. Сам PDF page dictionary здесь НЕ разобран: правильность указанного CropBox, UserUnit, цветов, страниц и paint-операций остаётся внешним обязательством аудитора.

Source-to-field matrix обязана быть невырожденной, без shear и неравномерного масштабирования. Неавторизованная зеркальность запрещена. Требуется минимум пять отдельных anchors с исходными, экранными и физическими координатами. Они должны соответствовать матрицам в пределах 0,25 px и 0,02 мм и охватывать не меньше 65% ширины и высоты источника. Все четыре угла страницы должны помещаться в поле.

## Цветоуправление: граница текущего этапа

PNG поддерживается только в строгом 8-bit noninterlaced RGB/gray/RGBA подмножестве без ICC/gAMA/sRGB/cICP и прочих профилей. Подписной receipt фиксирует имя и версию renderer, SHA исполняемого файла, заявленную RGB/ICC политику и SHA профиля конвертации. **ICC преобразование, истинность цветов и PDF CMYK/spot не проверяются этим кодом**: подпись фиксирует только утверждение исполнителя. Любой unsupported PNG → MANUAL. Не использовать эти данные для доказательства точности Pantone/CMYK.

## Приватный запуск

На доверенной машине подготовить исходные локальные файлы: artwork.svg (либо PDF), preview.png, order-evidence.bin, render-receipt.json, render-receipt.sig, renderer-public.pem. Receipt должен быть сформирован и подписан внешним доверенным renderer-аудитором по **точным JSON байтам**; SHA DER SPKI открытого ключа должен быть независимо заранее известен.

Команда:

    node vision/dataset/verify-render-files.mjs artwork.svg preview.png order-evidence.bin render-receipt.json render-receipt.sig renderer-public.pem TRUSTED_SPKI_SHA256

Выходной статус положительной внутренней проверки: SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY. Отсутствие документа, подмена PNG, неверный ключ, неправильный мм масштаб или неверная матрица приводит к MANUAL (CLI exit code 2). Файлы клиентских заказов, закрытые ключи и SHA клиентов не загружать в публичный GitHub или CI.

## Граница достоверности

Даже после успешной проверки остаются false:
- print_scale_proven;
- visual_render_equivalence_proven;
- gifts_order_evidence_authenticity_proven;
- production_approved.

Положительный результат удостоверяет байтовую целостность относительно подписного отчёта и математическую согласованность. Для реальной метрологии нужны независимое подтверждение заказа/поля, сам render worker со сравнением изображения по пикселям и цветоуправление ICC, а также две экспертные аттестации. Ни численные реальные TP/FN, ни производственные OK/ERROR до этого не заявлять.

## Технические источники

- W3C SVG2 Coordinate Systems/viewBox: https://www.w3.org/TR/SVG/coords.html
- W3C PNG Third Edition: https://www.w3.org/TR/png-3/
- PDF.js viewport: https://mozilla.github.io/pdf.js/examples/
- PDF 1.7 UserUnit, CropBox: https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.7old.pdf

## Следующий этап C3B.3.K

Независимый, закреплённый по версии офлайн renderer (PDF.js/MuPDF/Resvg), повторная растеризация и сравнение raw pixel buffer с PNG; отдельный проверяемый ICC/spot color pipeline и удостоверенный source order placement. Только затем закрытый real-data blind pilot.
