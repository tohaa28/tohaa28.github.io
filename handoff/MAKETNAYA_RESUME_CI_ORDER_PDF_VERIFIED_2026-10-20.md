# Макетная — продолжение разработки и восстановление CI (20.10.2026)

## Точная исходная точка

Репозиторий: `tohaa28/tohaa28.github.io`.

- Исходная ветка перед работой: `gifts-layout-workbench-mockups-source`, HEAD `511af8efb3a732bef339d07f03e8ec57dc360a09`. Отличалась от сохранённого в архиве `edf45d4` только файлом `handoff/START_NEW_CHAT_MAKETNAYA_2026-10-20.md`.
- Production перед работой: `main`, HEAD `1ed41aa19a9bc68bb4c8c8a66b304e6384d34ecb`, версия `rc719f669`.
- Утверждённый более ранний стабильный билд `r6a2d4657` сохраняется без изменений.
- Исходный файл заказа `Заказ 8006776.html` из архива пользователя является **приватным**. На публичный GitHub его не загружать.

## Работа, фактически выполненная в этом продолжении

Была разобрана серия сбоев публикации GitHub Actions, мешавшая проверить уже реализованный функционал клиентских PDF из заказа.

1. `b3043e269698255e05993f69141e05fe7f0066c5` — исправлены ошибочные экранирования в `tests/editor-choice-animation.test.mjs`: регулярное выражение PNG и CSS-проверки.
2. `cf6cbfd668c14123173dd4a9a6e009773be02bcb` — номер заказа передаётся аргументом в отдельный контекст Playwright `page.evaluate`.
3. `e9ebdc975dabe5cc60194519865094299b166131` — добавлена диагностическая информация при сбое вывода списка клиентских PDF в браузерном тесте.
4. `d356e8a6c5a948d662503dbcf471ebbe1de8560e` — тестовые HTML-ответы подаются в UTF-8; это устранило «кракозябры» в русской надписи «Заказ №…» и ошибку обнаружения карточки заказа.
5. `e1c6591e91a323ff3ce5cb35ca0720eb7ceba7b0` — тест `vectorcraft-parent-close-browser.mjs` ждёт асинхронного `postMessage`, прежде чем проверять обработку сигнала в родительской вкладке.

**Изменения затронули только тесты.** Логика PrintCheck, CMYK, VectorCraft, TraceDraw, мокапов, идентификаторов заказов и клиентских PDF не переписывалась.

## Успешная проверка и публикация

- GitHub Actions `Publish Maketnaya with Mockups`: run **39495090977**, `completed/success`.
- URL: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39495090977
- `precheck` — SUCCESS (unit/syntax + Chromium browser cases).
- `publish` — SUCCESS, production HEAD `ac5f79743c95a37eb5c972065d93be9a02cdde67`.
- `browser_verify / browser-test` — SUCCESS.
- Проверка заказов, прикреплённых PDF и чужих attachment ID: `Uploaded order layouts: 2 files, visible in basket and editor, explicit editable PDF import, foreign attachment rejected — PASS`.
- Прочие браузерные проверки охватили VectorCraft, TraceDraw, CMYK roundtrip, сдвиги и масштаб, анимации, mockup-cylinder и прямую загрузку Макетной в тестовой gifts.ru среде.

Важно: это автоматические тесты с контролируемыми ответами gifts.ru. **Реальный импорт** файлов через приватную авторизованную сессию пользователя всё ещё не подтверждён.

## Точки восстановления и данные

Backup до работы:
- `backup-maketnaya-resume-20261020-source-511af8e` → `511af8efb3a732bef339d07f03e8ec57dc360a09`
- `backup-maketnaya-resume-20261020-main-1ed41aa` → `1ed41aa19a9bc68bb4c8c8a66b304e6384d34ecb`

Проверенные контрольные ветки после работы:
- `checkpoint-maketnaya-20261020-ci-fixed-source-e1c6591` → `e1c6591e91a323ff3ce5cb35ca0720eb7ceba7b0`
- `checkpoint-maketnaya-20261020-ci-fixed-production-ac5f797` → `ac5f79743c95a37eb5c972065d93be9a02cdde67`

Данные сохранены:
- `mockup-profiles.json`: source и production совпадают, blob `750a78701bbba0ea82ec59fd95f78b01dfd37026`. В production до обновления была более старая копия.
- `method-settings.json`: source и production совпадают, blob `cbf6c8204e4fb3892d806342d37debefb8d9038e`.
- Изменения production относительно старого HEAD: `editor.html`, оба `launcher.js`, `mockup.html`, `mockup-profiles.json`. Пользовательские PDF/регистры не сбрасывались.
- Обновлённые метки production: `Макетная rbc3dfac6`, `PrintCheck v25 rbd827241`, `Редактор мокапов r533574f8`.

## Ближайшая функциональная проверка

На авторизованном gifts.ru через закладку открыть Макетную, обновить корзину, открыть заказ 8006776 (если доступен): ожидать счётчик «Загружено макетов: 2» и два файла `gerb2.pdf` и `che.pdf`. Затем выбрать реальный артикул/поле, нажать «Открыть для редактирования», проверить содержимое PDF, его размер, цвета и привязку. Не автоназначать загруженные файлы, т.к. вложения относятся к заказу в целом. Не трогать «Согласование макетов». Оригинал на gifts.ru не изменять.

Если PDF включает полный бланк с конструктором, автоматическое отделение логотипа пока не реализовано; редактирование возможно как загруженной копии, геометрию нужно проверить вручную.

Читайте также исходную полную историю и файл `handoff/START_NEW_CHAT_MAKETNAYA_2026-10-20.md`.
