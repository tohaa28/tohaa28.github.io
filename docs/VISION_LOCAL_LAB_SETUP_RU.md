# Vision Check — локальный тестовый стенд Windows D:\

## Текущий статус

Готов исходный код автономного лабораторного стенда. В этой сессии нет доступа к реальному диску D: пользователя; файлы устанавливаются **только после запуска установщика на его ПК**. Исходные макеты остаются локальными. Стенд импортирует ZIP, который формирует кнопка «Локальные примеры ZIP» в Vision Check поверх таблицы заказов.

Стенд **не обучает модель автоматически** и не утверждает пригодность заказа. Объекты нужно разметить на уровне отдельных ROI, подтвердить технологические пороги/масштаб и семейное разделение train/validation/test.

## Подготовка

1. Откройте https://tohaa28.github.io/gifts-layout-workbench-vision/vision-local-orders.html, установите закладку Vision Check.
2. На тестовой странице \`http://psk.testgifts.local/devorders?status=140\` нажмите закладку. Нажмите «Проверить макеты». Новая версия ищет **карточку заказа**, а не только файлы в строке: \`/private/order/<номер>\` → \`data-orderid\` → \`/ajax/gifts/order?action=makets_popup&oid=...\` → клиентские \`/cart/act/mda\`. PDF-шаблоны \`/drawing\` не включаются в обучающую выгрузку, поскольку это эталоны, а не клиентские логотипы.
3. Поставьте метку технолога. Нажмите «Локальные примеры ZIP». Скачайте ZIP на свой ПК. Файл содержит исходные SVG/PDF/bitmap, так что не прикладывайте его к публичным репозиториям.
4. Скачайте пакет кода [vision-local-lab.zip](https://tohaa28.github.io/gifts-layout-workbench-vision/vision-local-lab.zip), распакуйте во временный каталог на ПК.
5. Установите Python 3 для Windows с launcher \`py -3\` (если его нет). В PowerShell из распакованного каталога запустите:

   \`\`\`powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\install-vision-local-lab.ps1
   \`\`\`

   Создаются каталог \`D:\VisionCheckLab\`, \`visionlab.sqlite3\`, подпапки \`samples\`, \`reports\`, \`quarantine\`, \`incoming\`, \`logs\`, \`tools\` и команды Windows CMD. Никаких установок из интернета этот скрипт не делает.
6. Перетащите скачанный ZIP с тестовыми макетами на \`D:\VisionCheckLab\IMPORT-EXPERT-ZIP.cmd\`. Программа проверит формат архива, CRC, SHA-256, сигнатуры и ограничения размеров, а затем сохранит файлы с анонимными именами в \`D:\VisionCheckLab\samples\<id>\`.
7. Откройте \`D:\VisionCheckLab\START-VISION-LAB.cmd\`. В окне будет адрес **локальной read-only панели** на \`http://127.0.0.1:8765/?token=...\`. Соединений с удалёнными серверами нет.

## Другие команды

\`\`\`powershell
py -3 D:\VisionCheckLab\tools\vision_local_lab.py report --root D:\VisionCheckLab
py -3 D:\VisionCheckLab\tools\vision_local_lab.py list --root D:\VisionCheckLab
\`\`\`

После получения sample ID можно зафиксировать конкретный подтверждённый дефект вручную, **только если координаты и физический масштаб реально известны**:

\`\`\`powershell
py -3 D:\VisionCheckLab\tools\vision_local_lab.py annotate --root D:\VisionCheckLab --sample-id "20261117T120000_abc123:0001" --expert tech01 --kind narrow_gap --label confirmed_defect --units svg_document_mm --x 10 --y 20 --width 0.12 --height 1 --technology screen_print
\`\`\`

Подставьте настоящий \`sample-id\` из \`list\`, координаты из реального векторного документа и способ нанесения. Установленный стенд не считает такой ROI достаточным для обучения до независимой проверки. Дополнительная экспертная разметка проверяется по будущему контракту.

## Ограничения безопасности

- Доступ к тестовой сети из GitHub Actions/ChatGPT не подтверждён; браузерное подключение к другому поддомену может быть ограничено CORS, CSP или авторизацией. В таком случае Vision показывает \`MANUAL\`, не пробует обходить сетевые ограничения. Нужен разрешённый локальный proxy/коннектор или модуль в том же origin.
- Сбор только тестовых заказов, без записей обратно в заказ. Никакие действия \`upload_makets\`, \`j_delete_maket\` или оформление заказа не вызываются.
- Формы SVG/PDF/bitmap могут быть пригодны для **сбора и экспертной разметки**, но не автоматически для обучения: необходимо исключить шаблоны конструкторов, проверить подлинные исходники, права, физические размеры и координаты, сделать два независимых набора labels и разделение по исходным семействам. Сейчас все \`training_ready=false\`, \`approved_for_training=0\`.
- Не загружайте приватные ZIP или \`visionlab.sqlite3\` в GitHub. Панель не раздаёт оригиналы, слушает только \`127.0.0.1\` и требует временный токен. Исходники ZIP не используются как исполняемый код.

## Структура исходников

- \`tools/install-vision-local-lab.ps1\` — установщик на D:
- \`tools/vision_local_lab.py\` — автономный Python 3 + SQLite/zipfile/hashlib/HTTPServer, без pip-зависимостей.
- \`tests/test_vision_local_lab.py\` — независимые синтетические проверки, без настоящих заказов.
- \`vision/orders/order-page-discovery.mjs\` — извлечение карточки заказа и её клиентских макетов по протоколу существующей Макетной.
- \`tests/printcheck-vision-order-detail.browser.mjs\` — desktop Chromium с синтетической копией карточки и popup; не доказывает, что реальные тестовые домены повторяют эти страницы.
