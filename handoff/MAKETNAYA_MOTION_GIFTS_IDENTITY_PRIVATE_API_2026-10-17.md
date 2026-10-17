# Макетная — исправление анимации шапки, имя gifts.ru и безопасный сервер макетов
Дата: 17 октября 2026. Последний **протестированный** функциональный релиз, source и production сохранены.

## Требования
- Верхняя строка действительно движется; не достаточно менять CSS-ключевые кадры, если анимация отключена системными настройками.
- Личные сохранённые варианты должны быть по пользователю gifts.ru и артикулу, а не вручную вводимому имени.
- В конечном варианте сохранять файлы на сервере без автоматического принятия их в заказ.

## Контрольные точки
- SOURCE: `checkpoint-maketnaya-motion-gifts-identity-private-api-20261017-source` = `ee6e5bc608afbc9a91617073c0ecb9ce20a66258`
- PRODUCTION: `checkpoint-maketnaya-motion-gifts-identity-private-api-20261017-production` = `e53eb6e052c1f67031bfe4d9c047ffe9812e802e`
- До изменений: `backup-before-header-motion-server-library-20261017-source` = `a5522d99654ffb9cd37c63a80d968b7cf53cdbbc` и `backup-before-header-motion-server-library-20261017-production` = `b317413411cbefde773f645be154d90a950c1874`.
- Все прежние checkpoint и серверные реестры сохраняются.

## Исправлена верхняя строка
- В `editor.html` ранее было `@media(prefers-reduced-motion:reduce)`, отключавшее **всю** анимацию навигационной строки, даже когда изменяли `@keyframes`. Убрано автоматическое выключение, добавлен явный доступный контрол `#gwbMotionToggle` для паузы/воспроизведения (по умолчанию «play», собственный ключ `gwb.ordersMotion.play.v2`).
- Сохранены 8 WebP кадров персонажей, crossfade, движение файлов, SVG экран ноутбука, четыре сообщения, навигационные ссылки и mobile layout.
- `tests/order-motion-runtime-browser.mjs` воспроизводит настройки `reducedMotion:'reduce'`, измеряет изменение фактического положения карточки и времени Web Animations API, переключает паузу/воспроизведение. Не подменять этот тест проверкой наличия CSS-текста.
- `tests/order-motion-banner.test.mjs` теперь проверяет новый play/pause механизм вместо требований к старому скрывающему media rule.

## Определение пользователя gifts.ru
- В реальном HTML gifts.ru из ранее предоставленного пользователем файла найдено личное меню `g-droper`, содержащее ссылку `/private/cabinet` и имя в `g-drop .drop--padding .opacity-half`. Используется оно, а не произвольный ввод локального имени.
- `assets/personal-layout-library.js`: `giftsIdentity()`, наблюдение за авторизационным меню в родительской странице gifts.ru. При прямом открытии GitHub Pages, без сеанса или при отсутствии имени нельзя делать вид, что пользователь известен.
- Отображаемое имя **не является криптографическим доказательством авторизации** для сервера.

## Серверные операции: готовый код, НО НЕ ПОДКЛЮЧЁН
- `server/personal-layouts/index.mjs` реализует приватный Node.js API `GET /v1/me`, `GET/POST /v1/layouts?article=...`, `GET/DELETE /v1/layouts/:id?article=...`.
- Хранение исходных файлов, JSON макета, координат, миниатюр на приватном серверном диске с разграничением по **внутреннему неизменяемому ID** авторизованного пользователя gifts.ru и артикулу. Статус `personal-draft`, `orderId:null` — никакой автопривязки к заказам.
- Сервер не принимает ID из пользовательского JavaScript. Требует подписанный gifts.ru доверенным reverse-proxy набор заголовков, `X-Gifts-User-Id`, `X-Gifts-User-Name-B64`, `X-Gifts-Identity-Time`, `X-Gifts-Identity-Signature`, HMAC_SHA256, точное время и проверку в постоянное время; origin guard для записи. Русские имена передаются безопасно как base64url.
- `assets/personal-layout-library.js` обращается к same-origin `/private/maketnaya-layouts/v1/me`, проверяет наличие защищённого сеанса и совпадение имени gifts.ru. **Если API недоступен, UI прямо сообщает `Сервер недоступен · локальный резерв`, кнопка `Сохранить локальную копию`; это НЕ серверное сохранение.** При наличии валидного API отображается `Сохранить на сервер`; выполняются POST, LIST, GET, DELETE и JSON импорт/экспорт. Исторические локальные варианты остаются на устройстве.
- Пошаговое развёртывание и требования к доверенному серверу описаны в `server/personal-layouts/README.md`. Публичные GitHub Pages не запускают API, а Vercel-подключение не имеет полномочий на выбранный проект: 403/нет доступных командных team scopes. Не утверждать, что реально синхронизация включена! Требуется **администратор gifts.ru, имеющий серверный доступ к подтверждению сессии и reverse proxy**, или уполномоченный сервис со стандартным server-side SSO.
- Без сервера и верификации владельца клиента небезопасно сохранять макеты в публичном git или принимать имя из браузера на веру.

## Проверки
- GitHub Actions CI `39066680170` завершён **success**: `precheck`, `publish`, `browser_verify/browser-test`; включая запуск на gifts.ru и тест физически движущейся анимации.
- GitHub Pages production `39066761891` — **success**.
- `tests/personal-layout-private-server.test.mjs`: настоящий Node процесс, подписи, запрет просмотра чужих артикулов/логотипов, UTF-8 имена и CSRF.
- `tests/personal-layout-server-browser.mjs`: Chromium mock подтверждённого API, server POST/list/restore с теми же исходными байтами и отсутствие автоподстановки в заказ.
- `tests/personal-layout-library-browser.mjs`: offline fallback, IndexedDB, JSON backup и разделение по gifts-имени.
- Blob SHA реестров: `mockup-profiles.json` source/main `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`; `method-settings.json` source/main `cbf6c8204e4fb3892d806342d37debefb8d9038e` — идентичны, не затёрты.

## Следующий шаг
Развернуть secure server integration с проверкой сессии gifts.ru силами уполномоченного администратора, затем настоящим двухпользовательским end-to-end тестом подтвердить серверное сохранение/восстановление на разных устройствах. До этого честно помечать local-only и не заявлять завершённую серверную синхронизацию. Не менять рабочие PrintCheck, мокапы и VectorCraft.