# Vision AI 0.1.15 — универсальная панель и безопасный экспорт ZIP
Дата 2026-11-19; экспериментальная ветка feature/printcheck-vision-copy-v01.
PR #4 оставить черновиком, основную Макетную не модифицировать.

## Требование
Полная панель управления на любой авторизованной странице
http://psk.testgifts.local/* или http://testgifts.local/*.
Каждый заказ читается только по /private/order/{7-значный номер} на testgifts.local.
ZIP должны сохраняться по 100 утверждённых заказов, при скачивании
сканирование продолжается с bounded backpressure. Browser Safe Browsing
не отключать и опасные загрузки не подтверждать автоматически.

## Архитектура
1. vision/orders/extension/vision-order-launcher.js — удалённая панель
   на обеих тестовых площадках: выбор TXT, старт, пауза, стоп, ZIP,
   настройка задержки, экспорт реестра и текущие счётчики.
2. vision/orders/extension/service-worker.js — команда
   vision-remote-scanner-v1 на разрешённых test-origin страницах;
   создаёт /devorders в неактивной Chrome-вкладке или использует
   уже открытую. Работа остаётся в этом каноническом origin, где уже
   хранятся IndexedDB-состояние, партии и процесс сканирования.
3. vision/orders/overlay-entry.mjs — получает из worker
   vision-engine-command-v1 и вызывает ограниченный API режима TXT
   либо диапазонного сканера. Не отправляет заказные материалы наружу.
4. vision/orders/approval-file-controller.mjs,
   vision/orders/approval-range-controller.mjs — API remote();
   сохраняются прежние status ID 59, strict GET и retry.
   Импорт нового TXT поверх существующей очереди требует
   подтверждения в видимом интерфейсе, не во фоновой вкладке.

## Загрузка ZIP без флага небезопасного HTTP-источника
1. Ранее <a download> инициировал blob:http://psk.testgifts.local/ ZIP.
2. Теперь vision/orders/extension-zip-transfer.mjs разбивает бинарный
   Blob на подтверждаемые последовательные блоки 48 КБ.
   Каждый блок идёт отдельным chrome.runtime.sendMessage, поэтому
   перезапуск service worker не обрывает постоянный Port.
3. zip-offscreen.html и zip-offscreen.js — стандартный Chrome
   chrome.offscreen (reason BLOBS), origin chrome-extension://.
   Только упакованный код: проверка ожидаемого размера, ZIP PK-
   сигнатуры и EOCD, буферизация в пределах 200 МБ.
4. Service worker скачивает созданный offscreen Blob через
   chrome.downloads.download с conflictAction=uniquify и saveAs=false.
5. Статус Chrome downloads.search используется как подтверждение;
   danger!=safe/accepted даёт MANUAL_ZIP_CHROME_SECURITY_REVIEW_REQUIRED.
   Никаких acceptDanger, disabling Safe Browsing, скрытого обхода
   или выдачи неподтверждённых ZIP за успешные.
6. Intent стадии preparing/started записывается в IndexedDB до передачи.
   После перезагрузки проверяется Chrome Downloads,
   при отсутствии реальной загрузки возможен повтор из того же
   сохранённого ZIP без потери курсора.

## Тесты
- tests/printcheck-vision-launcher.browser.mjs: управление сканером из
  testgifts.local/catalog и psk.testgifts.local/catalog без навигации
  с этими страницами; ограничение на login.
- tests/printcheck-vision-approval-range.browser.mjs: reload, архив
  из chrome-extension Blob, Chrome Downloads API и распаковка ZIP.
- tests/printcheck-vision-approval-file-list.browser.mjs: импорт TXT,
  старые номера, IDB, архив, пауза.
- tests/printcheck-vision-zip-overlap.browser.mjs: 100 записей,
  задержка подтверждения ZIP на 8 секунд, проверка следующего номера.
- tests/printcheck-vision-extension-worker.test.mjs: mocked multiple
  onConnect listeners, строгие разрешённые GET.
- workflow .github/workflows/publish-printcheck-vision-preview.yml
  собирает только изолированный vision-local-lan-extension.zip.

## Не забывать
- Новый ZIP передавать на secure extension origin, не через HTTP anchor.
- Нельзя отключать проверки опасных файлов Chrome.
- Не терять текущие IDB архивы при обновлении расширения и не изменять
  hostname канонической вкладки без миграции данных.
- При блокировке ZIP сохранять данные до ручного решения в Chrome.
- Номера из личного dst.txt не попадали в публичный GitHub.

Сборка: https://tohaa28.github.io/gifts-layout-workbench-vision/vision-local-lan-extension.zip
CI: https://github.com/tohaa28/tohaa28.github.io/actions/workflows/publish-printcheck-vision-preview.yml
