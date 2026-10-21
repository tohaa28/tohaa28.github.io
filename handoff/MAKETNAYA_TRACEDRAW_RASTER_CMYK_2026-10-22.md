# TraceDraw: настоящее CMYK-преобразование растра, 22.10.2026

База source: a0fffac5df723e5bb76099ea36405f34fd2599ff.
База production: 2a98bc69fcc547f11db2ef6621d75314f32bf84f.
Исходный TraceDraw: igtoth/tracedraw, 0f206489770adcacc6cc130a9e31a5610faad68a.
Резервные ветки: backup-tracedraw-raster-cmyk-20261021-source и
backup-tracedraw-raster-cmyk-20261021-production.

## Подтверждённая причина

В исходном Rust-коде Bitmaps > Mode > CMYK и Convert to Bitmap > CMYK
оставляли RGBA-пиксели без изменений. Отдельная модель растрового объекта
не сохранялась; обычный PDF-экспорт создавал DeviceRGB. CMYK был доступен
для изображений только при принудительном режиме PDF/X-1a всего документа.

Новый tests/tracedraw-raster-cmyk-runtime.mjs воспроизвёл ошибку на старом
опубликованном WASM через настоящее меню «Растровые изображения → Режим →
Цвет CMYK». После команды PDF всё ещё содержал RGB-изображение. Тест упал
на проверке CMYK XObject. Сообщения движка при этом не имитируются.

## Изменение самого движка

tools/tracedraw-raster-cmyk.patch применяется к закреплённому исходнику
перед компиляцией через проверяемый git apply. Исправляет core/document,
core/command, приложение ops2 и io/pdf, а не получающий мост Макетной.

- Bitmap имеет отдельный optional bitmap_color_mode, сохраняемый в .tdraw.
- SetBitmapColorMode выполняется через Engine; переключение нескольких
  изображений составляет один шаг Undo/Redo. Исходный PNG и эффекты сохраняются.
- Диалог Convert to Bitmap задаёт тот же режим новому объекту.
- PDF действительно преобразует RGB-пиксели через Color::convert_to("CMYK")
  и записывает четыре 8-битных канала DeviceCMYK. Прозрачность остаётся
  отдельной маской DeviceGray. Невыбранные RGB-изображения не перекрашиваются.
- RGB возвращает исходные RGB-каналы без накопления потерь преобразования.
- Это не CMYK-кодирование PNG: PNG остаётся исходником и RGB-превью.
  Сохранение нового признака в SVG/CDR и полная цветопроба растра в интерфейсе
  данным изменением не заявляются. Настроенный рабочий профиль применяется
  при PDF-экспорте.

JS и WASM загружаются с общей версией кеша по хешу патча, чтобы новый
загрузчик не использовал старый бинарник. Версия web-сборки:
0.9.4-gifts-raster-cmyk1; бинарник сопровождается RASTER_CMYK_REVISION.

## Проверки до публикации

- 204 модульных теста Макетной прошли.
- Три новых native IO-теста прошли: реальные 4 канала и значения пикселей,
  alpha, native save/load, совместимость старых файлов, Undo/Redo, RGB-возврат,
  сохранение другого RGB-объекта.
- Прошли оба новых теста приложения: настоящее действие меню и диалог
  Convert to Bitmap. Все 696 тестов приложения прошли; 4 старых ignored.
- Полный локальный cargo test --workspace: 1233 passed, 1 failed.
  tests::forced_justification_spreads_the_last_line_too в tracedraw-text
  падает также на ЧИСТОМ исходном 0f20648 без наших изменений на этой Windows.
  Это отдельный старый сбой текстового теста; полный прогон не объявляется зелёным.
- Локальная версия компилятора: 1.99.1. Серверная сборка закрепляет 1.97.0.
  cargo build -p tracedraw завершился успешно. cargo clippy --workspace
  завершился без ошибок; версия 1.99 сообщает новые предупреждения в старом
  коде, поэтому итоговая строгая проверка библиотек выполняется на 1.97.0.
  В unattended CI используются стандартный upstream library workspace и
  оба конкретных теста CMYK приложения. Полный UI sweep приложения на Windows
  открывает системный Save dialog; в локальном прогоне он был отменён.

## Подтверждённая публикация

- Код исправления движка: a666448de47e5c0697fe79deef56d966846eca00.
- Проверенная WASM-сборка из source 20f841c5005097d8905810ed6a519a38223e9f28.
  Native-тесты, native build, Clippy 1.97.0 и WASM прошли в
  [39679316542](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39679316542).
- Исполняемый WASM первоначально опубликован в main
  8051743f4f29d556debd4fdecb6167fd97222616.
- Итоговый функциональный source с новой версией запуска и live-тестом:
  8dbcb1213b4a7ebbf0beeb3f02b446c2ec19eedf.
- Итоговый production main: fc250443923f4fae660913c53a3bb16a60dcd601.
- [Публикация 39682223950](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682223950):
  precheck, publish, browser_verify SUCCESS.
- [Live WASM 39682223824](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682223824):
  SUCCESS. Настоящие меню и клавиатура: RGB → CMYK → RGB, четыре канала PDF,
  одинаковая alpha, одинаковые габариты, Undo и Redo. Штатный Redo TraceDraw:
  Ctrl+Shift+Z; Ctrl+Y управляет привязкой к сетке. Смешанный растр/вектор
  также прошёл отдельный тест настоящего движка.
- [Pages 39682408171](https://github.com/tohaa28/tohaa28.github.io/actions/runs/39682408171): SUCCESS.
- На сайте проверены Макетная r024116c7, PrintCheck v25 re1f43fb8,
  TraceDraw web 0.9.4-gifts-raster-cmyk1 и RASTER_CMYK_REVISION с source 20f841c.
- SHA-256 опубликованного tracedraw-integration.js совпал с source:
  978d94c0cde5d0378d9fe3bdf19d4e3c40190eaa27dd146e22220ce84fb4d388.
  PrintCheck не менялся: SHA-256 logo-preflight.mjs
  64a000b9eebe27693f1a7d34d0832a80b3aa20ab1d7caede803b83ce5a499a24.
- Registry source/production совпадают и сохранены: mockup-profiles.json
  750a78701bbba0ea82ec59fd95f78b01dfd37026; method-settings.json
  cbf6c8204e4fb3892d806342d37debefb8d9038e.
- Контрольные ветки: checkpoint-tracedraw-raster-cmyk-20261022-source
  (код 8dbcb121 плюс итоговая документация),
  checkpoint-tracedraw-raster-cmyk-20261022-production → fc250443.

Первые сборки 39677111586 и 39678685348 остановились соответственно из-за
неустановленного Clippy и старого unit-теста под слишком широкой проверкой
стиля всех test targets. В workflow добавлен компонент Clippy и строгая
проверка library sources, как в правилах upstream. Функциональные тесты не
отключались. Последняя сборка прошла полностью. Старый Windows-тест шрифтов
по-прежнему указан выше отдельно; его исправление в этот релиз не входило.

PrintCheck не отключается и RGB не маскируется метаданными документа.
Передача вектора/растра, прогресс, блокировка переноса, обе команды
сохранения в заказ gifts.ru, пользовательские registries и PDF не менялись.
