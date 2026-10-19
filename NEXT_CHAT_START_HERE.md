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
