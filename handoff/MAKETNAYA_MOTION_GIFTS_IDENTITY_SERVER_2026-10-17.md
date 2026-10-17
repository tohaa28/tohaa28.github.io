# Макетная — исправление статичной шапки, имя gifts.ru, безопасное API для личных макетов
Дата: 2026-10-17. Последняя функциональная версия.

## Запрос
1. Верхняя строка Макетной выглядит неподвижной — исправить настоящее движение.
2. Сохранять макеты на сервере, отдельно по пользователю и артикулу.
3. Брать имя из реальной авторизации gifts.ru, не позволять вручную подменять владельца.

## Базовое резервирование
- SOURCE backup `backup-before-header-motion-server-library-20261017-source` — `a5522d99654ffb9cd37c63a80d968b7cf53cdbbc`.
- PRODUCTION backup `backup-before-header-motion-server-library-20261017-production` — `b317413411cbefde773f645be154d90a950c1874`.
- Финальная frozen SOURCE: `checkpoint-maketnaya-motion-gifts-user-server-adapter-20261017-source` = `ee6e5bc608afbc9a91617073c0ecb9ce20a66258`.
- Финальная frozen PRODUCTION: `checkpoint-maketnaya-motion-gifts-user-server-adapter-20261017-production` = `e53eb6e052c1f67031bfe4d9c047ffe9812e802e`.

## Анимация
В `editor.html` существовал `@media(prefers-reduced-motion:reduce)` с `animation:none!important` сразу для персонажей, проекций на ноутбуке, карточек, надписей и полёта — поэтому при настройке ОС/browser reduced motion вся строка становилась статичной даже после предыдущего исправления keyframes. Теперь собственный атрибут `#gwbOrdersMotion[data-motion="play"]` включает движение по умолчанию. Небольшая доступная клавиатурой кнопка `#gwbMotionToggle` явно ставит на паузу/возобновляет все слои (с сохранением выбора через localStorage). При `pause` неподвижный кадр задаётся селекторами только конкретной анимации, вне глобального reduced-motion медиазапроса. Разные позы, движение карточек, надписи, экран ноутбука сохранены. Функция корзины никак не затронута.
`tests/order-motion-runtime-browser.mjs` запускает реальный Chromium с `reducedMotion:'reduce'`, проверяет фактическое увеличение animation clock и физическое изменение координаты карточки за 1.4 c, остановку и повторный запуск. `tests/order-motion-banner.test.mjs` обновлён соответственно.

## Имя из авторизованного gifts.ru
Из образца реальной страницы gifts.ru обнаружена структура личного меню: `g-droper`, ссылка `/private/cabinet` и вложенный `g-drop .drop--padding .opacity-half` с именем пользователя. Новая `giftsIdentity()` в `assets/personal-layout-library.js` извлекает имя именно из этого меню на same-origin gifts.ru parent, а не из свободного input. Ручное поле профиля удалено, имя показывается как `Пользователь gifts.ru: ...`. Обновляется при изменении меню/фокусе. Изолированный локальный резерв работает по отображаемому имени + артикулу, но это **НЕ средство безопасности для сервера**.

## Сервер: код готов, deployment заблокирован
- `server/personal-layouts/index.mjs` — private Node >=22 API c `GET /v1/me`, `GET/POST /v1/layouts?article=...`, `GET/DELETE /v1/layouts/:id?article=...`. Запись на приватном persistent disk за пределами публичной статики. Поля хранятся с исходными SVG/растрами и placement. Разделение по стабильному внутреннему ID gifts.ru и артикулу; URL и ID проверяются. Не использует номер заказа.
- На каждый запрос обязательна **подтверждённая сервером** личность с HMAC SHA256 в headers `X-Gifts-User-Id`, `X-Gifts-User-Name-B64`, `X-Gifts-Identity-Time`, `X-Gifts-Identity-Signature`. UTF-8 имя передаётся base64url, есть ограничение времени и constant-time comparison, CSRF Origin guard для записи. Обязателен секрет `GIFTS_IDENTITY_HMAC_KEY` (не находится в GitHub).
- **Ни браузер, ни собственный displayName не могут сами создавать подписанную личность.** Доверенный reverse proxy gifts.ru под `/private/maketnaya-layouts/v1/*` должен проверить сеанс, узнать внутренний ID пользователя и поставить подписанные заголовки с удалением потенциально присланных клиентом поддельных. Инструкция в [server/personal-layouts/README.md](../server/personal-layouts/README.md).
- `assets/personal-layout-library.js` уже реализует подключение к same-origin `/private/maketnaya-layouts/v1/me`, переключение на серверный save/list/restore/delete/export/import после ответа от проверенного пользователя, хранит версии отдельно от заказов. При отсутствии настроенного сервера явно показывает «Сервер недоступен · локальный резерв», кнопка «Сохранить локальную копию», не выдаёт локальный результат за серверный.
- В текущем окружении **сервер на gifts.ru НЕ подключён**. GitHub Pages — только статическое размещение; коннектор существующего проекта Vercel возвращает 403, а gifts.ru SSO reverse proxy не предоставлен. Поэтому нельзя честно утверждать, что в production уже работает облачное сохранение. Доступ к server-side верификатору gifts.ru и приватному persistent storage — обязательная внешняя зависимость.
- Нельзя экспортировать клиентские макеты в public git/Pages, передавать пароль gifts.ru на сторонний сервер или принимать неподписанный userId.

## Тесты и версия
- `tests/personal-layout-private-server.test.mjs` поднимает настоящий Node API с временным private disk и проверяет сохранение, Unicode ФИО, подпись, запрет доступа чужому владельцу, разные артикулы, CSRF и удаление.
- `tests/personal-layout-server-browser.mjs` прогоняет browser клиент c server mock и гарантирует явное восстановление при reload и точный возврат исходных байтов.
- `tests/personal-layout-library-browser.mjs` проверяет gifts.ru имя, отсутствие ручного профиля и честный локальный fallback.
- `39066680170`: Publish Maketnaya with Mockups — **SUCCESS** (precheck/publish/browser_verify). Frontend в `main/gifts-layout-workbench-mockups/` опубликован. GitHub Pages приложение https://tohaa28.github.io/gifts-layout-workbench-mockups/
- `editor.html` отображает версию `r20261017-auth-server-1` в исходниках; публикационный workflow штампует фактический hash-коммит.
- `mockup-profiles.json` git blob `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` `cbf6c8204e4fb3892d806342d37debefb8d9038e` — source и production идентичны; никаких изменений в реестрах.

## Следующая работа
1. Получить рабочий доверенный способ проверки gifts.ru session на сервере + deployment credentials к закрытому серверу/прокси (не пересылать логины и пароли). Создать first-party proxy, добавить секрет вне git, постоянный private disk, проверить два реальных gifts account.
2. После включения server endpoint тестировать с настоящими сессиями: смена пользователя, два артикула, список старых вариантов, восстановление в несовпадающий шаблон должно быть запрещено.
3. Никогда не считать `personal-draft` макетом текущего заказа без явного выбора пользователя; сохранить прежние PrintCheck, мокапы цилиндров, редактор логотипа и все источники orders.
