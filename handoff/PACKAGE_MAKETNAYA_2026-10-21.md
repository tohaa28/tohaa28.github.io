# Макетная — полный пакет переноса в новый чат, 21.10.2026

**Все исходники, тесты, старые и новые handoff находятся в GitHub**, source branch gifts-layout-workbench-mockups-source. Новая точка входа: [START_HERE_MAKETNAYA_2026-10-21_LATEST.md](START_HERE_MAKETNAYA_2026-10-21_LATEST.md). Этот комплект создавался **без редактирования рабочего приложения**.

## Что скачать / прочитать

1. **Полные исходники с историей**: открыть https://github.com/tohaa28/tohaa28.github.io и выбрать source branch **gifts-layout-workbench-mockups-source**. GitHub предоставляет Download ZIP на branch или commit. Для воспроизводимого состояния использовать контрольную ветку, созданную после завершения handoff, или точный SHA, указанный в конце передачи. ZIP включает runtime, build scripts, тесты, Python/Rust, handoff и GitHub Actions.
2. **Первый файл**: [START_HERE_MAKETNAYA_2026-10-21_LATEST.md](START_HERE_MAKETNAYA_2026-10-21_LATEST.md).
3. **Полная хронология**: [MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md](MAKETNAYA_CHANGELOG_2026-10-21_COMPREHENSIVE.md) + [все 81 прежних handoff](ALL_HANDOFF_FILES_2026-10-21.md).
4. **Машинный паспорт**: [MAKETNAYA_STATE_2026-10-21.json](MAKETNAYA_STATE_2026-10-21.json).
5. **План и непроверенное**: [MAKETNAYA_NEXT_STEPS_2026-10-21.md](MAKETNAYA_NEXT_STEPS_2026-10-21.md).
6. **Готовое первое сообщение**: [NEW_CHAT_PROMPT_2026-10-21.md](NEW_CHAT_PROMPT_2026-10-21.md).
7. **Последний функциональный отчет**: [MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md](MAKETNAYA_VECTORCRAFT_COLOR_PDF_EVIDENCE_2026-10-21.md).

## Проверенное состояние до этого пакета

- **Source code functional commit**: 8ef0ade6161fa8bfc21c2398532a84de824a7263.
- **Source docs snapshot до handoff**: 6eff90fe5b687a2b64cf30efe02ffd92306528d3.
- **Main production**: 6010440328ed7c4ebcacc65f237bdc163e5f2f21.
- **UI**: Макетная r7fa6f062, PrintCheck v25 rb14f6d50.
- **Успешный pipeline**: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39607112412 (precheck, publish, browser_verify).
- **Live VectorCraft WASM**: https://github.com/tohaa28/tohaa28.github.io/actions/runs/39606367485.
- **Данные mockup-profiles / method-settings**: SHA 750a78701bbba0ea82ec59fd95f78b01dfd37026 / cbf6c8204e4fb3892d806342d37debefb8d9038e (source и production равны).
- **Замороженная production**: checkpoint-maketnaya-newchat-20261021-production → 6010440328ed7c4ebcacc65f237bdc163e5f2f21.
- **Source backup до пакета**: checkpoint-maketnaya-newchat-20261021-prehandoff-source → 6eff90fe5b687a2b64cf30efe02ffd92306528d3.

## Предмет следующей проверки

После отчёта пользователя о «CMYK→RGB, PrintCheck находит RGB» в проекте уже внесено и опубликовано подтверждённое CI исправление двух настоящих дефектов (реальная CMS-конверсия и устранение ложных PDF RGB от неиспользуемой графики). Но сам проблемный пользовательский макет **ещё не перепроверен** после выпуска. Уточнить, не перепутана ли формулировка RGB→CMYK. Настоящие RGB всегда должны оставаться видимы PrintCheck при запрещающей печатной технологии. Подробности в последнем функциональном отчёте.

## Важные запреты при восстановлении

Нельзя перезаписывать живые настройки/профили из старой копии, удалять customer PDF или пользоваться «согласованием макетов». Нельзя править compiled engine без защищённой сборки tools/build-launcher.mjs. Не публиковать собственные PDF пользователя в GitHub и не заявлять прямой CDR импорт/доверенную персональную серверную PDF-библиотеку реализованными без проверки. Сверять актуальные HEAD после запуска нового чата, так как docs commits могут сдвинуть source.

Итоговый source checkpoint после документации указывается в сопроводительном сообщении при завершении пакета.
