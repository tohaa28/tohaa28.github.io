> **ПОСЛЕДНЯЯ КОНТРОЛЬНАЯ ТОЧКА 17.10.2026:** [Выравнивание кнопки VectorCraft и скрытие «Закрыть Макетную»](handoff/MAKETNAYA_VECTORCRAFT_APPLY_ALIGNMENT_AND_CLOSE_2026-10-17.md). Apply поднята на 3 px, при открытии встроенного редактора скрывается внешний крестик с восстановлением при закрытии. Source checkpoint `checkpoint-vectorcraft-apply-aligned-close-hidden-20261017-source` (`2e68977886a45845c2e00b880d39a290a6e1f325`), production checkpoint `checkpoint-vectorcraft-apply-aligned-close-hidden-20261017-production` (`eec24b5221f3a8926b2baf9655e9f2cc4e910848`). CI `39058337789`, WASM `39057896809`, browser `39056115362` attempt 3, Pages `39058693564` — SUCCESS. Не стирать актуальные JSON реестры.

> **НОВЕЙШАЯ КОНТРОЛЬНАЯ ТОЧКА (17.10.2026):** кнопка «Применить в Макетной» теперь встроена в **верхнюю штатную панель VectorCraft**, не плавает поверх холста. Подробности: [MAKETNAYA_VECTORCRAFT_NATIVE_APPLY_2026-10-17.md](handoff/MAKETNAYA_VECTORCRAFT_NATIVE_APPLY_2026-10-17.md). Source checkpoint `checkpoint-vectorcraft-native-toolbar-apply-20261017-source` (`f94e450a9bfa84c70f01837769095e5439a26656`), production checkpoint `checkpoint-vectorcraft-native-toolbar-apply-20261017-production` (`58160d9be0c69b8d1407d05216d9ed8eff031474`). Real WASM test `39056115362` attempt 2 SUCCESS, Pages `39056837167` SUCCESS. Сохранять старые checkpoint и актуальные JSON.

> **ОБНОВЛЕНИЕ 17.10.2026 — ПОСЛЕДНЕЕ СОСТОЯНИЕ:** восстановить прежде всего [новый handoff VectorCraft immersive](handoff/MAKETNAYA_VECTORCRAFT_IMMERSIVE_2026-10-17.md). Полноэкранный режим, скрытые устаревшие переключатели, `Применить в Макетной` внутри реального egui VectorCraft, скрытие внешней кнопки закрытия — выполнены и опубликованы. Замороженные checkpoint refs: `checkpoint-maketnaya-vectorcraft-immersive-20261017-source` (b58a7a024bc5c45ce586494d279b33cf34d97e48) и `checkpoint-maketnaya-vectorcraft-immersive-20261017-production` (7a54ade50995414ef41c04e450cd13a0509ab182). CI: 39054009557; живой WASM: 39054009562; Pages: 39054084859 — все SUCCESS. Сохранить свежие JSON реестры, не откатывать со старой точкой.

# Важное: действующее состояние Макетной (17.10.2026)

Для **продолжения проекта в новом чате** сначала открыть:

- [Главный handoff](handoff/START_HERE_2026-10-17.md)
- [Полная история разработки](handoff/DEVELOPMENT_HISTORY_2026-10-17.md)
- [Машиночитаемое состояние](handoff/MAKETNAYA_STATE_2026-10-17.json)
- [Готовое сообщение для нового чата](handoff/NEW_CHAT_PROMPT_2026-10-17.md)

**Канонический исходный код** `gifts-layout-workbench-mockups-source`, **production** `main/gifts-layout-workbench-mockups`, **live** https://tohaa28.github.io/gifts-layout-workbench-mockups/.

**Релиз, проверенный 17 октября:** gifts.ru-оформление VectorCraft **по умолчанию**; переключатель native темы рядом с переходом к простому редактору; редактирование только текущего поля, физические размеры mm, возвращается только видимый SVG-логотип по art bounds. CI `39050357382` success, Pages `39050426031` success. При сборке на реальном WASM использовать также run `39021992518` как пройденный тест смены egui темы.

**Контрольные refs для точного восстановления:** `checkpoint-maketnaya-gifts-theme-default-20261017-source` (code SHA `56e4d0815fe806f2a8669f06fa37110b1d688174`) и `checkpoint-maketnaya-gifts-theme-default-20261017-production` (site SHA `2ed2dfaaa3e8ac020c48942c90fa64a19c83eb01`).

**Важно при откате:** не заменять свежие `mockup-profiles.json` и `method-settings.json` архивными файлами. Старые документы `PROJECT_HANDOFF.md` и `CURRENT_HANDOFF_MAKETNAYA_PRINTCHECK.md` теперь исторические, а НЕ актуальные 17 октября.
