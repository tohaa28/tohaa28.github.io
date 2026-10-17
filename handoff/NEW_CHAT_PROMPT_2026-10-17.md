# Готовое сообщение для нового чата — «Макетная» (17.10.2026)

Продолжаем разработку моей «Макетной», редактора мокапов и PrintCheck в GitHub-репозитории `tohaa28/tohaa28.github.io`. **Не начинай проект заново.** Сначала внимательно прочти актуальные документы в source-ветке `gifts-layout-workbench-mockups-source`: 

1. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/START_HERE_2026-10-17.md
2. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/MAKETNAYA_STATE_2026-10-17.json
3. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/DEVELOPMENT_HISTORY_2026-10-17.md

Рабочий сайт: https://tohaa28.github.io/gifts-layout-workbench-mockups/. **Важно**: последняя реализованная задача — полноценный VectorCraft Rust/WASM, встроенный в «Макетную», с gifts.ru-оформлением **по умолчанию** и отдельной кнопкой возврата к native-теме рядом с «Открыть прежний редактор». Не сломай уже работающую функцию.

VectorCraft ограничен одним документом выбранного нанесения; поле в миллиметрах задаёт рабочую область; редактируется уже загруженный рисунок, а назад возвращается ТОЛЬКО фактический art-bounds SVG без рабочего листа, плюс относительные координаты. Поддержаны обратная передача, повторное открытие и сохранение соседних полей. Оригинальный VectorCraft-инструментарий и отдельный простой редактор сохранены.

Функциональные контрольные коммиты, подтверждённые CI: source `56e4d0815fe806f2a8669f06fa37110b1d688174`, published main `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01`. Самые свежие source и main HEAD перед началом работы необходимо запросить заново (написание handoff уже внесло дополнительные docs-only коммиты). Замороженные backup-ветки текущего состояния: `checkpoint-maketnaya-gifts-theme-default-20261017-source` и `checkpoint-maketnaya-gifts-theme-default-20261017-production`.

Последний полный успешный publish CI: `39050357382` (precheck / publish / browser_verify). Pages `39050426031` success. Реальный VectorCraft theme WASM/browser: `39021081065` (build) и `39021992518` (браузер) success. Прежние ошибки отдельных прогонов отражены в handoff; последняя проверенная версия зелёная.

Серверные реестры — `mockup-profiles.json` и `method-settings.json` — нельзя откатывать вместе с UI. На момент фиксации их Git blob SHA: `ddb84fdc0d656341770a2399f5a10f0e21f5d72c` и `cbf6c8204e4fb3892d806342d37debefb8d9038e`. ВСЕГДА читай свежие данные обеих веток и сохраняй изменения, сделанные пользователями после снимка.

Для нового задания: создай резервные исходный и production refs, меняй только нужный модуль, добавляй regression, выполняй Github Actions (и настоящую WASM сборку с браузерной проверкой при изменении Rust), публикуй самостоятельно, затем обновляй журнал истории и фиксируй ссылки/хэши. Не спрашивай повторно то, что есть в документах. Если возникают ошибки, исправляй и тестируй до рабочего результата.

**Следующая задача:** [впишу её следующим сообщением].
