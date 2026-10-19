# Безопасная разработка, выпуск и восстановление «Макетной»

Дата: 19.10.2026. Применяется к source-ветке **gifts-layout-workbench-mockups-source** репозитория **tohaa28/tohaa28.github.io**.

## Инварианты
- Рабочая production-ветка — **main**, директория **gifts-layout-workbench-mockups/**. Сам сайт: https://tohaa28.github.io/gifts-layout-workbench-mockups/.
- Исходники обновлять только в source-ветке и выпускать через **.github/workflows/publish-maketnaya-mockups.yml**. Не править готовый минифицированный JS напрямую, если у модуля есть воспроизводимый patch/build.
- Данные **mockup-profiles.json** и **method-settings.json** не откатывать вместе с UI. В исходном снимке их blob SHA: **ddb84fdc0d656341770a2399f5a10f0e21f5d72c**, **cbf6c8204e4fb3892d806342d37debefb8d9038e**. Проверять свежие хэши заново перед ЛЮБОЙ обратной записью.
- Папки **gifts-layout-workbench-mockups/vectorcraft/** и **.../tracedraw/** содержат фактически готовые WASM/JS/лицензии. Простой publish должен сохранять обе. При полном откате надо восстанавливать целые каталоги из production checkpoint.
- Исходники авторизации gifts.ru не считать серверной верификацией; персональные материалы клиентов не отправлять в публичный GitHub.
- Не повреждать связь заказ → артикул → принт/место → поле → конструктор, историю мокапов, PrintCheck и SVG bounds.
- **VectorCraft**: gifts-theme по умолчанию, стандартная тема/простой редактор сохранены под капотом, текущий выбранный документ, поле мм, cropped-only SVG, возврат в правильное поле; не удалять инструменты.
- **TraceDraw**: независимая опция редактора, self-hosted Rust, SVG/PDF input, cropped art SVG return; CDR input внутри embedded пока не готов. Нельзя «симулировать» Rust обработку вместо реальной.

## Проверенный снимок для восстановления
- Frozen source branch: **checkpoint-maketnaya-20261019-newchat-final-source**, commit **52743e6b27cd4d644f0465ed07999035af7e1a98**.
- Frozen production branch: **checkpoint-maketnaya-20261019-newchat-final-production**, commit **eafb2c85d563b619165c79f858426b97256126ca**.
- Functional code of that frozen source соответствует **73e7d178a632a95c368b9ab1b72d3ab84e1d5cfe**; после него 6 docs-only commits.
- Старые frozen checkpoints сохранять: особенно **checkpoint-maketnaya-tracedraw-two-editors-20261019-source/production**, **checkpoint-maketnaya-gifts-theme-default-20261017-source/production**, **checkpoint-maketnaya-vectorcraft-art-only-20261016-source/production**.

## Штатная подготовка к новому изменению
1. Прочитать START_HERE_2026-10-19_FINAL.md и NEXT_STEPS_2026-10-19.md.
2. На GitHub получить **текущий** SHA веток source/main (не использовать прошлые значения как свежие).
3. Создать две backup-ветки непосредственно от этих HEAD. Не делать force-push исходной/production ветки.
4. Установить, какой модуль меняется; ограничить область коммита. Добавить regression, в том числе негативные тесты неправильного поля и отмены.
5. Публиковать на source-ветку. Workflow **publish-maketnaya-mockups.yml** должен дать success для **precheck, publish, browser_verify**.
6. Для Rust/VectorCraft отдельно **build-vectorcraft-web.yml** и после Pages — настоящий VectorCraft runtime browser. Для Rust/TraceDraw — **build-tracedraw-web.yml**, затем **verify-tracedraw-live.yml**; не считать запуск live-теста на предыдущем бинарнике проверкой нового кода.
7. Проверить наличие обоих WASM в main; повторно сравнить пользовательские JSON source/main; обновить handoff с точными SHA, номерами успешных runs, причиной изменений и ограничениями.

## Безопасный откат
1. Зафиксировать SHA и текущие версии **обеих** веток; отдельно прочитать актуальные `mockup-profiles.json` и `method-settings.json`.
2. Определить точный список файлов для возвращаемого модуля. Предпочесть восстановление изменённых кодовых файлов из frozen source checkpoint и новый штатный publish вместо отката всей ветки.
3. Если нужен полноценный rollback production WASM, восстановить соответствующие папки vectorcraft/ и tracedraw/ из frozen production checkpoint, но оставить **самые свежие** серверные JSON и сопутствующие пользовательские записи.
4. Не перезаписывать другие разделы main и не публиковать два конкурирующих workflow одновременно, не проверив их заключение.
5. Провести все regression и browser-test заново. В отчёте указать оба финальных коммита, номера успешных Actions, защищённые данные и реальную проверенную функциональность.
6. При ошибке сборки не утверждать успешную публикацию. Предыдущий проверенный checkpoint хранится независимо.

## Не реализовано и не подменять обещаниями
- Реальный защищённый API хранения личных PDF на gifts.ru ещё не развернут, сейчас браузерный IndexedDB.
- Сессия пользователя берётся из UI gifts.ru, это не доверенная server session validation.
- Прямой CDR в embedded TraceDraw не реализован; не приписывать upstream возможности встроенному мосту.
- Не проверено всё поведение сложных PDF/SVG, CMYK/spot и CDR/CMX. Нужны расширенные QA для конкретных файлов и экранирования.

**Публичные документы handoff не должны содержать customer artwork, секреты, токены или персональные данные.**
