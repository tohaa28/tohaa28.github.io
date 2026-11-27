# PrintCheck Vision — C3B.3.K: независимый PDF/SVG повторный рендер и пиксельная проверка

Дата: **2026-11-17**. Статус **экспериментальный**, ветка `feature/printcheck-vision-copy-v01`, черновой PR #4. Изолировано от production «Макетной» и GitHub Pages.

## Исправленная ошибка доверия

На этапе J существовала подписанная Ed25519 цепочка original SVG/PDF → PNG preview → order evidence → mm field. Она численно сверяла геометрию, **но не выполняла фактический повторный рендер**. Из-за этого полученный PNG мог быть не связан с видимыми объектами исходного SVG/PDF.

В K добавлена независимая повторная растеризация точных **подписанных исходных байтов** и сравнение каждого байта RGBA с PNG, прошедшим строгую PNG/CRC-проверку. Внешний renderer никак не может заменить входное signed artwork своим документом. Если engine недоступен, unsupported формат, один пиксель не совпал или исходный PDF ведёт себя не так, как допускает исследовательское подмножество, итог MANUAL.

### Основные модули

- `vision/dataset/exact-pixel-replay.mjs`: строгое попиксельное RGBA-сравнение без «визуальных допусков», alpha включён; защищённый бюджет до 12 млн пикселей, число несовпадающих пикселей, доля и максимальная поканальная погрешность. `EXACT_RGBA_REPLAY_ONLY` не означает цветопробу или годность к печати.
- `vision/raster/replay-engines.mjs`: отдельные реальные движки Rust-based resvg для SVG и PDF.js + Skia Canvas для PDF, без внешних ресурсов. Неподдерживаемые конструкции → MANUAL.
- `vision/raster/verify-independent-replay.mjs`: сначала подтверждает прежнюю Ed25519-подпись и exact SHA original/PNG/order evidence, затем выполняет новый независимый рендер и сравнивает каждый RGBA-канал. Успех `EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY`.
- `vision/dataset/locked-pilot-gate.mjs`: старый синхронный путь `verifyLockedPilot` теперь может выдать только `SIGNED_HOLDOUT_SCREENED_PENDING_RASTER_REPLAY` с `evaluation_allowed=false`. Новый асинхронный `verifyLockedPilotWithReplay` проверяет **все ранее требуемые подписи/контрольные ROI/оригиналы и настоящий независимый рендер**. Только он может установить `evaluation_allowed=true` для исследовательских метрик. Переданный вызывающим кодом «готовый успех» не принимается вместо рендера.
- `vision/raster/verify-replay-files.mjs`: локальная приватная CLI для доверенной машины, проверяет шесть исходных файлов и подпись, затем запускает реальные движки; не раскрывает исходные пути/имена клиента в stdout и отказывается читать symlink.
- `vision/raster/package.json` и `vision/raster/package-lock.json`: полностью закреплённая исследовательская зависимость в отдельной папке, без подключения к производственной сборке.

## Поддерживаемые форматы — fail closed

**SVG:** только inline root SVG с физическими width/height, явным viewBox и одним или несколькими заполненными одноцветными векторными `<path/>` (сплошной `#RRGGBB`). Запрещены CSS/текст/шрифты, обводки, маски, clip, SVG `<image>`, URL, внешние ресурсы, XML entities/doctype и неподдерживаемые атрибуты. Проверяющий модуль сознательно **не является полным SVG2 parser**.

**PDF:** только PDF 1.x, одна страница, простой неподжатый ASCII-stream с одной непрозрачной прямоугольной заливкой **чёрным DeviceRGB** (оператор `0 0 0 rg`, `re` и `f`). PDF.js должен самостоятельно подтвердить page box, rotation, UserUnit и разрешённые paint-операции. После этого render → Skia RGBA. Сжатые потоки, сложные страницы, fonts/images, transparency, Indexed/ICC, CMYK, DeviceN, spot/Separation и неизвестные объекты → MANUAL. Это узкий исследовательский прототип, не полноценная печатная интерпретация PDF.

**Почему отдельный анализ PDF-байтов обязателен:** PDF.js может привести CMYK к RGB ещё на уровне operator list. Тест обнаружил, что одна проверка интерпретированных операций ошибочно позволяла CMYK-заливку. Исправлено дополнительным строгим контролем исходного потока **до** интерпретации PDF.js; реальные производственные многоцветные PDF по-прежнему не подтверждаются.

**PNG preview:** только strict C3B.3.I декодер (8-bit noninterlaced, без ICC/gAMA/sRGB/cICP). Не выполняется преобразование в CMYK, Pantone, spot или proofing. Один renderer в одной конфигурации и точное RGBA-совпадение не доказывают корректности сдвига печатных цветов, растровых процентов и реального исполнения печати.

## Подготовка приватной машины

Не нужно ничего отправлять на публичный сервер. Открыть изолированный clone экспериментальной ветки:

    npm ci --prefix vision/raster --no-audit --no-fund

Исследовательские подписные данные должны находиться вне репозитория: source.svg/pdf, preview.png, order-evidence.bin, render-receipt.json, render-receipt.sig, renderer-public.pem. Отдельный доверенный SHA256 DER SPKI ключа закрепляется за пределами пакета.

Полный запуск:

    node vision/raster/verify-replay-files.mjs artwork.svg preview.png order-evidence.bin render-receipt.json render-receipt.sig renderer-public.pem TRUSTED_SPKI_SHA256

При точном повторном RGBA-совпадении возвращается `EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY`, а не производственный `PASS`. При ошибке/MANUAL код возврата 2. Приложение не пишет файлы заказов в GitHub, не загружает документы в сеть. При работе с чужими PDF необходимо запускать CLI в изолированном процессе/контейнере с лимитом CPU, RAM, длительности и выключенной сетью: сам Node-модуль не обеспечивает OS sandbox.

## Действительно проведённые тесты

- Проверка одного изменённого пикселя, alpha, иной размерности, лимитов.
- Реальный Rust resvg и независимый PDF.js+Skia для двух простых синтетических исходников; пиксельное совпадение с независимым PNG.
- Повторная подпись **ложного PNG** не скрывает отличие исходника от картинки.
- Известный опасный случай CMYK, который PDF.js нормализует в RGB: остановка по строгому анализу исходного stream. Дополнительные проверки DeviceN, Separation, ICC, compressed/unknown resources, font, masks.
- Несовпадающий PDF page box, недостоверный ICC, SVG внешние ссылки/текст/CSS, symlink.
- Полный закрытый синтетический путь: два независимых эксперта, подписанный cohort, blind controls, signed mm placement, третья подпись рендера → действительный resvg → **только research**.
- CLI без раскрытия приватных путей, с отказом при подмене файлов.
- CI CircleCI отдельно выполняет `vision-contract` и `vision-raster`. Исследовательские npm зависимости фиксированы через v3 lock; установки выполняются `npm ci`, без сборок и релизов.

## Ограничения приёмки

Именно эта работа **не** завершает полноценное цветоуправление ICC и формирование форм CMYK/spot; проверка ICC, распознавание всех PDF paint-операций и детальный real-order mm контекст остаются отдельными задачами.

Флаги `production_approved`, `icc_proven`, `spot_color_separations_proven`, `physical_print_scale_proven`, `authenticated_gifts_order_proven` остаются false. Ни одной реальной подтверждённой двухэкспертной выборки в этом цикле не было; real-data precision/recall не вычислялись.

## Первоисточники и лицензии

- resvg-js Rust renderer, MPL-2.0: https://www.npmjs.com/package/@resvg/resvg-js
- Mozilla PDF.js, Apache-2.0: https://www.npmjs.com/package/pdfjs-dist
- @napi-rs/canvas Skia backend, MIT: https://www.npmjs.com/package/@napi-rs/canvas
- W3C PNG Third Edition: https://www.w3.org/TR/png-3/
- PDF.js viewport rendering: https://mozilla.github.io/pdf.js/examples/

## Следующий этап C3B.3.L

Расширение проверенного PDF renderer за пределы единственного черного прямоугольника без принятия скрытых CMYK/spot: извлечение независимой семантики цветового пространства, закреплённые ICC transformations с тестовыми профилями и color error ΔE; поддержка реальных PDF многослойных заливок и авторизованных mm-полей заказа, масштабируемая обработка и приватная приёмка двумя экспертами. Отдельно требуется групповой blind holdout, чтобы заявлять реальную accuracy.
