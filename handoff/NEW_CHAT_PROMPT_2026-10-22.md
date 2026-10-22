# Скопируйте этот текст в новый чат

Продолжаем разработку «Макетной» (Gifts Layout Workbench), PrintCheck, VectorCraft, TraceDraw и Редактора мокапов. Нужно **восстановить фактическое состояние GitHub** и продолжить разработку, сохранив всю историю и работающую версию.

СНАЧАЛА ПРОЧТИ ГЛАВНЫЙ HANDOFF:
https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/START_HERE_MAKETNAYA_2026-10-22_CURRENT.md

Самое новое изменение:
https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/MAKETNAYA_TRACEDRAW_RASTER_CMYK_2026-10-22.md

Цветовой пайплайн:
https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md
https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/MAKETNAYA_PDF_COLOR_STATE_2026-10-21.md

Репозиторий: https://github.com/tohaa28/tohaa28.github.io
Source: gifts-layout-workbench-mockups-source (зафиксированный функциональный SHA 8b2b7729df1f2ce140125275a1a291c6f775e33d; после него идут документационные commits).
Production: main/gifts-layout-workbench-mockups/ на SHA fc250443923f4fae660913c53a3bb16a60dcd601.
Точки восстановления: checkpoint-maketnaya-nextchat-20261022-source и checkpoint-maketnaya-nextchat-20261022-production.
Версия: Макетная r024116c7; PrintCheck v25 re1f43fb8; TraceDraw 0.9.4-gifts-raster-cmyk1.
Успешные проверки: CI 39682223950 (precheck,publish,browser_verify), реальный TraceDraw WASM 39682223824, WASM build 39679316542, Pages deploy 39682408171.

Последний вопрос пользователя: «в редакторе перевожу cmyk в rgb и ... принтчек все равно находит rgb». ВАЖНО: если действительно преобразовано CMYK→RGB, обнаружение RGB правильно; для получения CMYK надо преобразовывать RGB→CMYK реальные объекты. В репозитории уже есть проверенные фиксы: native CMS VectorCraft, Paint-only PDF parser PrintCheck, q/Q/Forms, реальная DeviceCMYK bitmap конверсия TraceDraw. Но пользовательский конкретный PDF не исследован. НЕ объявляй, что воспроизводимый на файле пользователя дефект закрыт, пока не воспроизведёшь и не проверишь фактический PDF после передачи. Не подавляй RGB в отчёте искусственно.

Что сохранить: модель/геометрию логотипа, растр+вектор, PrintCheck повторно после возврата, безопасность замены PDF заказа, состояние персональных проектов и мокапов, работающие анимации, способы печати, настройки цветов и требования. Не трогай mockup-profiles.json и method-settings.json, не делай реальных удалений вложений gifts.ru. Работай через tools/build-launcher.mjs и patch pipeline, а не прямыми изменениями скомпилированного assets/index-BpU9kvz8.js. Перед правками backup source/main; после — реальные тесты, публикация, проверка всех CI jobs, контрольные точки и handoff.

Первым ответом нового чата перечисли **какие HEAD и версии реально прочитаны**, что проверено, что остаётся открытым, после чего выполняй моё новое задание. Архив handoff можно прикрепить к сообщению, но канонические исходники — в GitHub source по указанному SHA.
