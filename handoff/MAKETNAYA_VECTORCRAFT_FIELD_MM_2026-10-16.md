# VectorCraft — точные размеры поля нанесения, 16 октября 2026

## Запрос
Размер выбранного поля Макетной в миллиметрах должен передаваться в VectorCraft как размер монтажной области и возвращаться с отредактированным файлом. Сохранить корректные пропорции логотипа, его размещение в поле и привязку к конкретному нанесению.

## Изменения
- **tools/patch-logo-editor-bridge.mjs**: `gwbGetActiveLogoForEditor()` возвращает реальные `fieldSizeMm:{w,h}` и `placementMm:{x,y,w,h,rotation,clipToField}` из выбранного `y.placements[y.active]`; координаты x/y относительны начала поля. `gwbApplyEditedLogoToActiveField(file,token,options)` сохраняет текущий токен выбранного поля и дополнительно проверяет соответствие физических размеров при `options.fieldCanvas=true`. На SVG-полотне, которое уже занимает всё поле, bbox placement становится в точности bbox поля с нулевым дополнительным поворотом; первоначальный offset/rotation записаны в изменяемые SVG-трансформации, что исключает двойную установку размеров и поворота.
- **assets/vectorcraft-field.js**: создаёт SVG монтажную область `width=Wmm height=Hmm viewBox="0 0 W H"` для исходных SVG, PNG, JPG, WEBP. Векторные объекты не становятся растром — SVG-вектор переносится как `<g transform=...>` с исходными дочерними графическими элементами и defs. Растры остаются растровыми. Размеры и исходное размещение выражаются в физических миллиметрах. Импорт SVG без viewBox восстанавливает координаты из width/height c преобразованием mm/cm/in/pt/px в CSS user units. Для PDF и PDF-compatible AI исходные байты идут **напрямую в VectorCraft** без предварительного растрирования.
- **assets/vectorcraft-integration.js**: шлёт `fieldSizeMm` и `fieldCanvas` через postMessage; выводит фактические размеры поля в шапке; валидирует возвращённый SVG по физическим размерам его artboard (72 pt/in). Отказывается от незаметного масштабирования при несовпадении размеров. Устанавливает `width/height` SVG в точных мм. При возврате заранее обёрнутого SVG размещает по полному полю, для исходного PDF/AI сохраняет предыдущую схему placement (чтобы не менять положение PDF без контроля).
- **tools/vectorcraft-bridge.rs**, **tools/patch-vectorcraft-upstream.py**: `bridge_field_mm` держит физический размер и флаг уже подготовленного fieldCanvas. После фактического открытия оригинала внутри Rust сессии проверяет физический размер artboard и, если нужно, через native `artboard.setProps` выставляет его в пунктах `mm*72/25.4`. У подготовленного SVG несовпадение считается ошибкой. У PDF/AI пропорциональное масштабирование разрешено только при одинаковом соотношении сторон; произвольное растяжение векторов запрещено. SVG экспортируется из `artboard:0` (а не из случайного bbox объектов).
- **editor.html**: включает `vectorcraft-field.js` перед `vectorcraft-integration.js`.

## Регрессии
- `tests/vectorcraft-handoff-browser.mjs` проверяет 120×80 мм, исходное размещение 100×60 мм и поворот 30°, SVG без viewBox, попытку вернуть документ чужого размера, повторное открытие и отмену, отправку PDF-байтов с размером поля 80×80 без растрирования и сохранение PDF placement.
- `tests/vectorcraft-runtime-browser.mjs` на источниках/feature branch проверяет реальный WASM: исходный 100×50 мм SVG после открытия на поле 90×45 мм должен вернуться как SVG с physical size 90×45 мм. Эту версию теста нужно публиковать/запускать после выпуска WASM с `gwb_apply_field_size`.

## Безопасность и откат
- Предшествующий рабочий source: `d6c0a99945c3c75aaa87c6f36f2de4d286394ccd`, production main: `a92f22069354bafe08c50d99ef6ea6b7741553ad`.
- Backup branches: `backup-before-vectorcraft-field-size-20261016`, `backup-published-before-vectorcraft-field-size-20261016`.
- Не менять исходные `mockup-profiles.json`, `method-settings.json` или алгоритмы PrintCheck, cylindrical mockup; при rollback брать актуальные реестры из main.
- `tests/vectorcraft-handoff-browser.mjs` тестирует изолированную протокольную оболочку с имитацией iframe; `tests/vectorcraft-runtime-browser.mjs` обязан тестировать **настоящий** WASM и сохранённый размер перед тем, как утверждать готовность.

## Проверка и публикация
- Source commit with field-mm bridge: `a1132438d38fa0ef913c392e148ebee22767d0ac`; corrected 100×50 → 90×45 actual browser test: `d48e384572949870607c50a413250d9155a878d1`.
- GitHub Actions `38906322578` («Build VectorCraft WebAssembly») — **success**, опубликован реальный новый Rust/WASM `vectorcraft-web-c3513163990f5dfc_bg.wasm` (64,744,107 bytes).
- GitHub Pages run `38907747803` — **success**, обеспечивает доступность нового WASM.
- Браузерный тест реального движка `38907819630` — **success**: исходный документ SVG 100×50 мм импортирован в VectorCraft с требуемым полем 90×45 мм, возвращённый SVG физически 90×45 мм; `svgBytes=372`, `browserErrors=[]`. Это реальный Chromium/WebAssembly, не имитация iframe.
- Обычный workflow публикации Макетной `38906951940` — предварительные/браузерные проверки success, включая передачу полей SVG + PDF и отмену. Финальный publisher с обновлённым runtime smoke — `38907819765`: проверить browser_verify before declaring final publication.
- После публикации обязательно повторно сравнить SHA реестров из `main` и source: `mockup-profiles.json` `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, `method-settings.json` `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
- Для штатной проверки: запустить закладку Макетной на gifts.ru, выбрать поле 90×45, открыть «Редактор логотипа», увидеть в заголовке «90 × 45 мм», отредактировать кривую и нажать «Применить в Макетной»; возвращённое поле должно остаться 90×45 мм без второго поворота или масштабирования логотипа.
