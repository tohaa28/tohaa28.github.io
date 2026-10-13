# Полная хронология ключевых изменений Макетной
Фиксация: 2026-10-13

Это не замена `PROJECT_HISTORY_MAKETNAYA.md`, а компактный индекс по истории разговоров и Git.

## 25–29 сентября 2026 — становление Макетной
- Проект оформлен как отдельный веб-редактор, не расширение Chrome.
- Gifts.ru — источник заказа/корзины/мест нанесения.
- Floot окончательно исключён; GitHub принят как канонический источник.
- Закреплён поток: заказ → артикул → реальные данные/preview → нанесение/place → поле → editor → logo → save.
- Поля и places должны дословно соответствовать заказу.
- Позиции без drawtask/place не дополнять выдуманными данными.
- Связь constructor↔article читается из «Шаблоны макетов».
- Поля `print1/print2` сопоставляются по порядку.
- Добавлены full GitHub Pages / bookmarklet / installer подходы.
- Свободная форма поля должна использовать реальный contour, не bbox.
- Multiple fields и разные logo закладываются как штатный сценарий.

## 30 сентября – 3 октября — Mockup Lab / независимая ветка
- Пользователь попросил не включать экспериментальные мокапы сразу в рабочую Макетную.
- Создан отдельный Mockup Lab на данных заказа.
- Handoff включает article/product/method/place/applicationId/printN/geometry.
- Развивается photo↔field mapping, JSON registry, PNG.
- Позже создана независимая копия Макетной с мокапами.
- Ручной handoff заменён bridge/postMessage.
- Привязки стали храниться на GitHub.
- Одно поле может иметь несколько фото, одно фото — несколько полей.

## 4–5 октября — единый стиль, readiness, PrintCheck status
- Макетная и Mockup Editor приведены к общему visual system.
- Скрыты readiness/progress UI, логика readiness сохранена.
- Скрыты ручные handoff controls.
- PrintCheck показывает «поиск мелких элементов...» до завершения detail scan.
- Исправлялись cache/version цепочки PrintCheck.
- Разрабатывается cylinder geometry.
- Формируется обязательное правило сохранения mapping при rollback.

## 6–8 октября — PrintCheck v15…v25, поля и точность
- Последовательно менялись методы определения мелких positive/negative.
- v25: coverage/SWT/multisegment positive markers.
- Ручной mask удалён, маска определяется автоматически.
- Отдельные цвета не должны создавать ложные defects на границе.
- Введена user-model проверка физическим кругом.
- Исправлялись физические размеры полей.
- Для исходного LM1 оставлена обязательная пользовательская перепроверка.
- UI PrintCheck и остальная Макетная должны оставаться разделёнными.

## 9 октября — полноширинный старт и mockup geometry
- До выбора заказа список занимает всю ширину.
- После выбора плавно открывается workspace.
- В корзинах превью + компактные параметры.
- Исправлено перекрытие mockup badge / quantity.
- Cylinder artwork сохраняет пропорции.
- Добавлена опция сохранения пропорций поля.
- Параметры цилиндра сохраняются в профиле.

## 12 октября — заказные карточки
- Многопозиционные заказы получили compact accordion.
- Затем первый артикул оставлен всегда видимым.
- Переключение изменено на hover; стрелка стала декоративной.
- Equal height cards per grid row.
- Position count 12.5px / 750.
- Шаг 1 сделан компактнее.
- Подписи/значения шага 1 окончательно 10px.
- Внутренняя зелёная рамка списка убрана, внешняя оставлена.
- Все эти изменения проходили regression/publish/browser_verify на соответствующих commits.

## 12 октября — motion experiments и откаты
- Дверная стартовая сцена заменена на staged motion intro 2.6s.
- Затем разработан внутренний step-motion flow.
- Затем Studio UI 2.0.
- Пользователь не принял глубокую перестройку и запросил откат.
- Выполнен rollback к approved post-intro/pre-Studio состоянию.
- История motion commits сохранена.
- `mockup-profiles.json` при rollback не откатывался.

## 12–13 октября — переход в Mockup Editor
- Добавлена reversible transition Макетная ↔ Редактор мокапов.
- Открытие ~0.9s, возврат ~0.5s.
- Текущий iframe/editor state сохраняется.
- Поздняя handoff readiness/отмена защищены.
- Пользователь заменил надпись «Из макета — в изделие» на «Визуализируй это».
- Source commit заголовка: `ab9916291380ee8a2f6b78d09790fc427fed79de`.

## 13 октября — утренний UI-пакет main-only
Последовательность:
1. `b5a81657551afa0ad986bfbf0d407102d63a7387` — одностраничный шаблон без page nav.
2. `ae0cd50db277fff344cc3eb88e9953e7da50d219` — «Добавить логотип в остальные поля» к tools.
3. `3a466de9ecb7684e183dc8de33b01b1da06f864f` — article selection → whole template first.
4. `b9497b99907d04d6be5f3119a333f91e46a55b10` — hide «Вернуться к открытому макету».
5. `4a2a00a32b2d79764751eeeab857949a7e2d8cc9` — «Создать макет для заказа».
6. `d494a293fd1144ce5cff44ac4556aa6fc4332747` — новая подсказка карточки.
7. `1f10d82558498548e4207b2c50336ab2a1f43cf8` — counts в скобках заголовка.
8. `ceb5cc26725b041400695db1a848696587dc3ca8` — counts 12px/400.
9. `0f37a1f82f291447dc9e1ea22080d21778c23e39` — скрыть «МАКЕТЫ ЗАКАЗОВ».

Пользователь затем явно попросил rollback на `0f37a1f...`. Main был установлен точно на него.

## 13 октября — дата заказа
После rollback пользователь предоставил реальный HTML:
- `li.cart-header-date`;
- `.dd`;
- `.mm` + вложенный `.yy`;
- `li.cart-header-number`.

Реализованная линия:
- `41dbd916d31aa5f23a5b332f56f2e20814e6af7a` — extract date + /api/basket.
- `d54e526bfed5ecfaaa87b92c14d09690b34c3a8f` — дата сразу после номера.
- `c830cd9149d49119f78f887c1ead2bbf58b0dbd2` — правый reserve под count/arrow.

Желаемый UI: `Заказ №8006776 · 05 окт 2026`.

## 13 октября — последующая штатная публикация source
Пользователь сохранил новую mapping:
`f72c6997fd47737872660e30927dec491aa768cb` — `16535.66 · сторона а · 16535.66-2`.

Publish workflow `38389923244` — success.
Main после публикации: `8582716c4cd94c3dd839e0092edd95838017f6c1`.
Pages `38389967445` — success.

Эта публикация восстановила main из канонической source-ветки и тем самым перестала содержать утреннюю main-only UI-линию. Это не потеря истории: все commits сохранены, а итог `c830...` дополнительно закреплён веткой `backup-ui-after-order-date-spacing-20261013`.

## Ключевые rollback branches 13 октября
- `backup-hide-single-page-nav-20261013`
- `backup-move-simple-fill-20261013`
- `backup-article-full-template-20261013`
- `backup-hide-resume-editor-20261013`
- `backup-create-layout-order-label-20261013`
- `backup-order-card-hint-20261013`
- `backup-basket-counts-heading-20261013`
- `backup-basket-counts-style-20261013`
- `backup-hide-orders-heading-20261013`
- `backup-exact-0f37-hide-orders-heading-20261013`
- `backup-before-rollback-to-0f37-20261013`
- `backup-before-order-date-dom-20261013`
- `backup-before-order-date-inline-20261013`
- `backup-before-order-date-count-spacing-20261013`
- `backup-ui-after-order-date-spacing-20261013`
- `backup-source-before-complete-history-20261013`
- `backup-published-before-complete-history-20261013`

## Историческая база
Полные детали PrintCheck versions, mockup mapping, motion releases, failed/success workflows и предыдущие SHA уже сохранены в `PROJECT_HISTORY_MAKETNAYA.md`, handoff 2026-10-05, handoff 2026-10-12 и специализированных handoff-файлах. Их не удалять.
