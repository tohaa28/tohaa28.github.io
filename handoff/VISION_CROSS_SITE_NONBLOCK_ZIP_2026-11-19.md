# Vision AI 0.1.14 — запуск с обоих порталов и неблокирующий ZIP
Дата: 2026-11-19.
Ветка: feature/printcheck-vision-copy-v01; PR #4 оставить черновиком.

## Контекст
Предыдущая v0.1.13 сканировала диапазон 3200000–8200000
или импортированный TXT из 333943 уникальных исторических номеров.
Сканер располагался исключительно на psk.testgifts.local/devorders.
Обе ZIP-процедуры ожидали Chrome Downloads COMPLETE перед следующим GET.

## Изменения
1. vision/orders/extension/manifest.json: v0.1.14 и третий
   content script для http://psk.testgifts.local/* и http://testgifts.local/*.
2. vision/orders/extension/vision-order-launcher.js: плавающая кнопка
   Vision AI · заказы в нижнем правом углу любой страницы тестовых сайтов,
   кроме devorders и страниц авторизации. Клик запускает сообщение
   vision-open-scanner-v1.
3. vision/orders/extension/service-worker.js: только с allowlisted
   тестовых origins принимает запуск и открывает/фокусирует
   единственную вкладку http://psk.testgifts.local/devorders.
   Сохраняется единый IndexedDB origin, сессия и checkpoint.
4. vision/orders/approval-file-controller.mjs: после ZIP начала скачивания
   scan loop не ожидает Chrome COMPLETE. Подтверждение проверяется
   короткими неблокирующими запросами. При следующем полном batch
   включается bounded backpressure. Старый batch остаётся в IDB.
5. vision/orders/approval-file-persistence.mjs: commit ZIP удаляет
   только подтверждённые строки; следующая партия сохраняется.
   Две партии до 200 записей допускаются во время загрузки.
6. vision/orders/approval-range-controller.mjs: аналогичный staged ZIP
   и продолжение проверки; checkpoint подтверждённого ZIP
   отделён от cursor текущего обхода. В журнале содержится
   downloaded order_numbers, end_cursor и снимок реестра ошибок.
7. vision/orders/approval-range-persistence.mjs: атомарно удаляет только
   подтверждённые номера ZIP, не затрагивая следующие.
   При reload между Chrome checkpoint и IDB prune журнал восстанавливается
   по part и end_cursor, не теряя данные.
8. В обеих реализациях двоичные буферы старой партии освобождаются
   из памяти после создания Blob ZIP, но остаются в IndexedDB до ACK.
9. tests/printcheck-vision-launcher.browser.mjs: тест обоих origins,
   reuse единственной вкладки и скрытие кнопки на login.
10. tests/printcheck-vision-zip-overlap.browser.mjs: синтетический
    100-order batch, искусственный ZIP PENDING на 8 секунд,
    проверка следующей карточки и reload до ACK.

## Инварианты
- Три старых тестовых host permissions; без production gifts.ru.
- Серверная авторизация обязательна. Нет изменения cookie или POST.
- ZIP завершён только при Chrome Downloads COMPLETE.
- При неопределённой загрузке не удалять неподтверждённые вложения.
- Одновременно один скачиваемый ZIP + следующая партия до 100.
- При заполнении следующей партии есть контролируемое ожидание;
  это безопасное ограничение очереди, а не блокировка каждого номера.
- Не публиковать исходные номера заказов и личную переписку в GitHub.
- При обновлении не очищать данные сайта psk.testgifts.local.

## Ссылки
Preview: https://tohaa28.github.io/gifts-layout-workbench-vision/vision-local-lan-extension.zip
PR: https://github.com/tohaa28/tohaa28.github.io/pull/4
CI: https://github.com/tohaa28/tohaa28.github.io/actions/workflows/publish-printcheck-vision-preview.yml
## Проверка и публикация
GitHub Actions run #44545917824 — SUCCESS.
https://github.com/tohaa28/tohaa28.github.io/actions/runs/44545917824
Браузерные PASS: M3.28 range reload; M3.29 TXT import/reload;
M3.30 двухдоменный launcher; M3.30 ZIP PENDING на 8 секунд,
сканирование следующей карточки и reload до подтверждения скачивания.
ZIP опубликован в изолированной preview-папке main,
sha файла GitHub fe92344faea625072d1930e85c83dcde413960f1.
PR #4 остаётся OPEN DRAFT; в production код не сливался.
