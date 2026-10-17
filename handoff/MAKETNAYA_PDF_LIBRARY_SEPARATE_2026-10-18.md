# Макетная — отдельная библиотека сохранённых PDF, 18.10.2026

## Технически подтверждённый результат
- Кнопка остановки анимации верхней строки **полностью удалена**: нет `#gwbMotionToggle`, переключателя и сохранённого ручного pause состояния. Анимация `gwbOmFly` и динамика персонажа/ноутбука остаются и проходят `tests/order-motion-runtime-browser.mjs`, в том числе при системном `reducedMotion:reduce`.
- Личные варианты **не находятся внутри Шага 2 выбора поля**. Новый `#gwbPersonalLibrary` — отдельный блок прямым дочерним элементом `#orderEditor`, визуально отделённый от рабочего редактора.
- Удалена кнопка `Импортировать копию` и загрузка JSON через file input. Удалён экспорт JSON из видимого списка. Вместо него — **Скачать PDF**.
- При нажатии на `Сохранить на сервер` / `Сохранить локальную копию` вызывается существующая **штатная** функция `window.gwbCreateReadyLayoutPdf()`, которая создаёт настоящий печатный PDF поверх конструктора с нанесениями, а не картинку JPG и не переименованный JSON. PDF проверяется по MIME, размеру и сигнатуре `%PDF-`. Параллельно сохраняются исходные файлы и вся геометрия полей в предыдущем формате `gwb-personal-layout/v1`, чтобы восстанавливать вариант для редактирования по явному нажатию.
- В IndexedDB запись `personal-draft` содержит отдельный `pdf:{name,mime,bytes:Uint8Array}`. Для старых записей без PDF кнопка загрузки отключена; можно вручную восстановить старый вариант и сохранить его заново в PDF. **Никакая запись не становится автоматически макетом заказа.**
- `server/personal-layouts/index.mjs`: доверенный сервер (после подключения администратором gifts.ru) хранит отдельный приватный файл `UUID.pdf` рядом с приватным `UUID.json` редактируемого исходника, строго разделяя по подтверждённому неизменяемому ID пользователя и артикулу. Добавлен защищённый `GET /v1/layouts/:id/pdf?article=...`; удаление удаляет оба файла, проверяется подпись/владелец. Фальшивые PDF отклоняются. **API ещё не развёрнут на gifts.ru; без него приложение честно пишет, что PDF сохранён локально.**
- Отображаемое имя берётся из личного меню авторизованного gifts.ru, как в прошлой версии.

## Тронутые файлы
- `editor.html`: удаление контроля анимации и новый cache buster для PDF библиотеки.
- `assets/personal-layout-library.js`: самостоятельный блок, настоящий PDF export/store/download, приватный серверный route, удаление JSON import/export UI.
- `server/personal-layouts/index.mjs`: хранение PDF в отдельном файле с серверной изоляцией.
- `tests/personal-layout-pdf-fixture.mjs`: валидный векторный тестовый PDF.
- `tests/personal-layout-library-browser.mjs`: отдельный блок, PDF скачивание побайтно, локальная сохранность после перезагрузки, ручное восстановление.
- `tests/personal-layout-server-browser.mjs`: PDF upload/download и восстановление через серверный API.
- `tests/personal-layout-private-server.test.mjs`: серверный двоичный PDF, запрет доступа чужого пользователя, отклонение повреждённого PDF, удаление.
- `tests/personal-layout-library.test.mjs`, `tests/order-motion-runtime-browser.mjs`, `tests/order-motion-banner.test.mjs`: проверки текущих UI контрактов.

## Откат
До правок:
- `backup-before-pdf-personal-layout-block-20261018-source`: `7f530b08a15be892864649330b0f565591d25d98`
- `backup-before-pdf-personal-layout-block-20261018-production`: `e53eb6e052c1f67031bfe4d9c047ffe9812e802e`

Новые ЗАМОРОЖЕННЫЕ контрольные точки, **не передвигать**:
- Source: `checkpoint-maketnaya-pdf-library-separate-20261018-source` = `dd5d9380336a3435180e08a240ca7e9d2992393d`.
- Production: `checkpoint-maketnaya-pdf-library-separate-20261018-production` = `58907913d1f71484c5b3a77f82f4070b6e09b1e2`.

## Доказательства
- Полный GitHub CI: `39071296063`, **success** — precheck, publish, browser_verify/browser-test.
- GitHub Pages: `39071371357`, **success**.
- PDF-проверки создают и скачивают реальные PDF-байты, сопоставляют полученный PDF с оригинальным тестовым векторным PDF. Старый PrintCheck, векторный редактор, мокапы и заказный workflow остались работоспособны.
- Реестры `mockup-profiles.json` source/main SHA `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`, `method-settings.json` source/main SHA `cbf6c8204e4fb3892d806342d37debefb8d9038e`; не затронуты.

## Важное ограничение
Сервер **ещё не включён** на gifts.ru: нельзя выдавать локальный PDF за серверное сохранение. Для истинной синхронизации нужны защищённый reverse proxy, серверная проверка реальной сессии и приватное долговечное файловое хранилище. Публичные GitHub Pages / repository **нельзя** использовать для персональных макетов клиентов. Код готов для установки оператором сервера gifts.ru, но без доступа к шлюзу развернуть это безопасно нельзя.

Продолжение разработки: исходная ветка `gifts-layout-workbench-mockups-source`, production `main/gifts-layout-workbench-mockups/`; не переписывать пользовательские JSON реестры и старые checkpoint.
