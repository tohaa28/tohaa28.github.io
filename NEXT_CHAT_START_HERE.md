> **НОВЫЙ АКТУАЛЬНЫЙ HANDOFF 21.10.2026:** [полный пакет и скачивание](handoff/PACKAGE_MAKETNAYA_2026-10-21.md) → [главный START_HERE](handoff/START_HERE_MAKETNAYA_2026-10-21_LATEST.md) → [вся хронология](handoff/MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md) → [план проверки RGB/CMYK](handoff/MAKETNAYA_NEXT_STEPS_2026-10-21.md) → [машинный state](handoff/MAKETNAYA_STATE_2026-10-21.json) → [текст для нового чата](handoff/NEW_CHAT_PROMPT_2026-10-21.md). Рабочий релиз: **Макетная r7fa6f062 / PrintCheck v25 rb14f6d50**; functional source **8ef0ade6161fa8bfc21c2398532a84de824a7263**, production **6010440328ed7c4ebcacc65f237bdc163e5f2f21**, CI **39607112412 SUCCESS**. Уточнение: user RGB/CMYK файл после выпуска ещё не проверен вручную. Устаревшие инструкции 19 октября ниже оставлены как история.

> **Замороженное состояние 19.10.2026:** [итоговая самостоятельная инструкция](handoff/START_HERE_2026-10-19_FINAL.md) / [machine-readable manifest](handoff/PROJECT_STATE_2026-10-19_FINAL.json) / [новый чат — готовый запрос](handoff/NEW_CHAT_PROMPT_2026-10-19_FINAL.md). Checkpoint source **52743e6b27cd4d644f0465ed07999035af7e1a98**, production **eafb2c85d563b619165c79f858426b97256126ca**. Ранние документы сохранены.

# Продолжение «Макетной» в новом чате — 19.10.2026

**Начать с [handoff/START_HERE_2026-10-19.md](handoff/START_HERE_2026-10-19.md).** Это самостоятельный, проверенный handoff: две системы редактирования (VectorCraft + настоящий TraceDraw WASM), состояние всех связанных модулей, контрольные точки, ссылки CI, честные ограничения и правила безопасного отката.

## Открыть по порядку
1. [Полный старт и все SHA](handoff/START_HERE_2026-10-19.md)
2. [TraceDraw — реальная интеграция и живые тесты](handoff/MAKETNAYA_TWO_EDITORS_TRACEDRAW_2026-10-19.md)
3. [Список следующей работы и тест-план](handoff/NEXT_STEPS_2026-10-19.md)
4. [Машиночитаемое состояние](handoff/PROJECT_STATE_2026-10-19.json)
5. [Вся ранее накопленная история](HANDOFF_FOR_NEXT_CHAT.md) и [индекс прежних handoff](handoff/README.md)

## Версии
- Исходники: `gifts-layout-workbench-mockups-source`
- Опубликованная версия: `main/gifts-layout-workbench-mockups/`
- Проверенная source: `checkpoint-maketnaya-tracedraw-two-editors-20261019-source` (`73e7d178a632a95c368b9ab1b72d3ab84e1d5cfe`)
- Production: `checkpoint-maketnaya-tracedraw-two-editors-20261019-production` (`eafb2c85d563b619165c79f858426b97256126ca`)
- Handoff snapshot source: `checkpoint-maketnaya-next-chat-20261019-source` (`af6f756ad347feadf349fb28f91908928717339d`)
- Handoff snapshot production: `checkpoint-maketnaya-next-chat-20261019-production` (`eafb2c85d563b619165c79f858426b97256126ca`)

**Проверено:** основной CI `39231640321`, компиляция TraceDraw `39231601793`, live real WASM `39231640175`, GitHub Pages `39232177088` — успешны.

**Важные НЕГОТОВЫЕ части:** прямой CDR handoff в embedded TraceDraw; полная блокировка создания/открытия чужого документа в его меню; серверное сохранение пользовательских PDF через подтверждённую сессию gifts.ru. Не заявлять их готовыми.

**Критический запрет:** не перезаписывать из архивов действующие `mockup-profiles.json`, `method-settings.json`, каталог WASM и личные данные. Не публиковать чужие логотипы.
