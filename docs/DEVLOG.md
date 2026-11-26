# PrintCheck Vision — журнал разработки (обязательный, непрерывный)

Проект: Maketnaya / PrintCheck Vision. Экспериментальная ветка: feature/printcheck-vision-copy-v01.
Изолированное сравнение: draft PR https://github.com/tohaa28/tohaa28.github.io/pull/4
Правило: любой цикл должен заканчиваться проверяемым результатом (commit + тесты + статус + ограничения), а не обещанием. Не редактировать действующую Макетную и не сливать черновой PR без независимой приёмки.

## M3.24 — fail-closed duplicate Linux RSS fields (2026-11-23)

- Pre-change HEAD `86ec8f6999fc2ed743d8df73a4310c5f15383ffa`; PR #4 returned by GitHub draft/open search, but connector does not expose explicit draft/merged booleans. Pre-change exact-HEAD GitHub UI smoke 45141102135, raster safety 45141102419, rules/dataset safety 45141102270 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish not confirmed.
- `e33c780f91db64a3b33c322d0e2f3c11dd0c3b44`: Linux procfs watchdog now rejects duplicate VmRSS/VmHWM fields as RSS_UNAVAILABLE instead of accepting the last potentially lower value.
- `a22244fa867c66eed6a3a90ed19bf566b615d27f`: added three-pass synthetic duplicate-field regression, for both metrics. New-head CI and independent execution were NOT yet confirmed when recording this entry; no PASS claimed for the new tests.
- This is only an ambiguity hardening step. The short-lived child exit race and lack of kernel-enforced memory cap remain unresolved; /proc cannot recover peak after process exit. Next: verify exact-head CI and design a cgroup v2 or cooperative child completion protocol with deterministic synthetic regression before 512 MB boundary test.
- Outstanding: preview publish, private 512 MB triple boundary, independent expert ROI votes/adjudication, verified constructor/physical scale/print method, ICC/spot, verified family holdout, private PDF --all, anonymized 404/MV3 reference_state. No client data or keys uploaded; production untouched; PR not merged; training_ready=false, production_approved=false, unknown => MANUAL.

## M3.10 — synthetic streaming boundary and same-length SHA regression (2026-11-22)

- Before change PR #4 OPEN, draft=true, merged=false, source HEAD `df7d983689512c87ef231c2da683c14d41756857`. GitHub Actions exact-head UI smoke [44734919976](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44734919976), raster safety [44734920042](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44734920042), rules/dataset safety [44734919821](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44734919821) all SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on that SHA unconfirmed.
- Commit `62ba92c0d63b4788627cdceaffeda428bf93bda5`: added synthetic-only three-pass tests for streamed 16,000,000-byte equality/16,000,001-byte refusal and for equal-length source substitution with SHA-256 mismatch. This exercises the actual streaming path at the minimum supported cap. **It does not test the full 512,000,000-byte maximum**, nor prove bounded peak memory.
- New-head CI and independent local execution NOT confirmed at writing. No PASS claimed for new tests. The next task is a resource-budgeted optional 511,999,999/512,000,000/512,000,001-byte sparse-file boundary suite, measured peak RSS and triple repetition, without CI disk exhaustion.
- Outstanding: 404/MV3 anonymized reference_state, preview publish, independent ROI/adjudication/PDF/Chromium triple cycles, real expert ROI pair, verified constructor/print method/physical scale, ICC/spot and family holdout. `training_ready=false`, `production_approved=false`; unknown => MANUAL. No customer files, SHA, private keys, or source names published. No production edits or PR merge.

## M3.65 — generic HTTP auth/rate-limit fail-closed regression (2026-11-20)

- Verified pre-change PR #4: OPEN, draft=true, merged=false, HEAD `3fba348a2d2d55f19a8fa473de76f797996ed1b1`. Compared with `6ce0b37e`: 20 commits ahead, 0 behind. Existing CI on exact source HEAD: UI smoke [44694527192](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44694527192), raster safety [44694527123](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44694527123), rules/dataset safety [44694527255](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44694527255) all SUCCESS; CircleCI `vision-contract` and `vision-raster` success. Preview publish on this SHA not independently confirmed.
- `04c2e4941df74d9c234efda4a3f356c25349f976`: fixed `vision/orders/approval-network-control.mjs` so generic `MANUAL_ORDER_HTTP_STATUS` 401/403 maps to auth halt, 429 maps to rate-limit halt; 408 and 5xx remain transient. This closes a fail-open case where an HTTP error was treated as an ordinary `other` result and scanning could continue.
- `936d1a9f97ceb883d03859065ac3d4758af72da5`: added synthetic Node regression covering 401, 403, 429, one probe only, halt reason, no retry and no response-body leak into network health. No customer data or network requests in fixtures.
- CI for the new code/test HEAD was not available immediately after the commits; no PASS claimed for these new tests. Local checkout still blocked by DNS `Could not resolve host: github.com`; triple independent ROI/PDF/private-stage runs not performed. Preview publish remains unconfirmed. PR #4 confirmed draft=true, merged=false after the test commit.
- Next: verify exact-head GitHub/CircleCI results, run independent three-pass synthetic ROI/adjudication, PDF `--all`, private staging (including 512 MiB limits), Chromium 404/MV3 `reference_state`, and verify isolated preview publish. Real-world accuracy, verified constructor/print method/physical scale, ICC/spot, two real independent expert ROI votes and verified family holdout remain blocked. `training_ready=false`, `production_approved=false`, unknown => MANUAL. No production edits, no PR merge, no private corpus upload.

## M3.60 — verified CI for M3.59; regression execution boundary (2026-11-20)

- Before change HEAD: `e156b7827ab7ecd15254f5248aae506093e107b0`; branch comparison against this SHA: identical (ahead=0, behind=0). PR #4: OPEN, draft=true, merged=false.
- GitHub Actions on exact source HEAD: [UI smoke 44660054515](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44660054515), [raster safety 44660054442](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44660054442), [rules/dataset safety 44660054430](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44660054430) — completed SUCCESS. The rules/dataset job reports successful steps for cyclic offline ROI/PDF/expert-consensus/privacy, private staging and grouped holdout checks; UI job reports successful blinded two-reviewer smoke. These are CI workflow results, not independently verified three local runs.
- CircleCI statuses on source SHA: `ci/circleci: vision-contract` SUCCESS and `ci/circleci: vision-raster` SUCCESS. Preview publish on this SHA not confirmed; no preview publishing action taken.
- Reviewed `tools/vision_roi_review.py`, `tests/test_vision_roi_review.py`, `tests/test_vision_pdf_audit.py`, `tests/test_vision_private_corpus_stage.py` and research contract. Synthetic same-size source replacement between independent reviews is covered by the prior test commit; no new test run outside CI claimed.
- Local checkout and three independent local regression runs blocked by DNS failure resolving github.com (`git ls-remote` failed). No speculative code edit or customer-data processing was performed. This cycle records independently fetched CI evidence only.
- Next bounded task: obtain reproducible local checkout, execute ROI/PDF/private-stage synthetic tests three times with per-run exit codes and check Chromium 404/MV3 anonymized reference_state; only then introduce a minimal regression fix if a failure is reproduced. Keep any real ROI, keys, source SHA, filenames and client documents entirely private.
- Outstanding: preview publish, actual anonymized 404 reference_state, independently verified real ROI votes/adjudication, verified constructor/print method/physical scale, ICC/spot and verified family holdout. `training_ready=false`, `production_approved=false`, unknown => MANUAL.

## M3.35 — ограничение распаковки вложений ZIP (2026-11-19)

- Исходный HEAD: `6f7353288fede1e686bee27d30904c806e3fa06f`; PR #4 до изменения: OPEN, draft=true, merged=false.
- Исходный CI: UI smoke [44411760812](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44411760812), raster [44411760782](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44411760782), rules/dataset [44411760770](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44411760770) — SUCCESS. CircleCI vision-contract и vision-raster — SUCCESS. Preview publish для исходного SHA не подтверждён.
- `674b413bd7580ca9a22c8f1420b53eec62101417`: экспериментальный конструктор ограничивает размер распакованного вложения 16 МиБ по метаданным ZIP и фактически прочитанным байтам. Чтение блоками до 1 МиБ; превышение вызывает `PRIVATE_ATTACHMENT_SIZE_LIMIT`. Это промежуточная защита, **не** полноценное потоковое сохранение: `byte_lookup` и проверка существующих файлов ещё могут удерживать данные в памяти.
- `5ae1a1da7ad0a5c7df617ee2620facbaa9a6e0e4`, `3a0e5fa3afe6949e38918847ef40d8eb570eeb4b`: синтетические тесты на разрешённое вложение и отказ при превышении лимита. Тест с искусственно изменённым ZipInfo удалён, поскольку поведение стандартного декодера ZIP при подмене метаданных не даёт стабильного кода отказа.
- Тесты локально **не выполнялись**: контейнер не разрешает github.com, checkout недоступен. Новые GitHub/CircleCI результаты ожидают отдельной проверки; никаких утверждений о PASS на новых SHA.
- Остаточный риск: до завершения извлечения могут остаться частичные файлы локального корпуса. Следующий шаг — потоковое извлечение в приватные временные файлы, общий бюджет распаковки, атомарная публикация только после полной валидации, тесты rollback и повторных вложений.
- Статус: `training_ready=false`, `production_approved=false`; реальные два ROI, аджудикация, связь с конструктором/техпроцессом, доказанный масштаб, ICC/spot, verified family holdout, 404/MV3 и реальная точность не подтверждены. Клиентские данные в GitHub не передавались.

## M3.58 — same-size ROI source substitution regression (2026-11-20)

- Before change HEAD: `d2b7e321f545cc18701dda15d49f92c36be5e0b2`; PR #4 OPEN, draft=true, merged=false.
- GitHub Actions on previous HEAD: UI smoke [44644849799](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44644849799), raster safety [44644849658](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44644849658), rules/dataset safety [44644849616](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44644849616) — SUCCESS. CircleCI vision-contract and vision-raster — success. Preview publish on this HEAD not confirmed.
- `1cfc1bda9f671427f4530894afc9f7a5263e079e`: added synthetic regression for byte-for-byte *same-length* source replacement after two disagreeing independent ROI votes, before adjudication. Requires `SOURCE_SHA256_MISMATCH`, no adjudication, no training approval, and refusal to propose from the modified source. No customer data.
- Local test execution unavailable: container DNS cannot resolve github.com; CI for the new commit not yet confirmed. Do not claim three independent local cycles or real-world accuracy.
- Remaining: Chromium 404/MV3 reference_state, triple ROI/PDF/private-stage regressions, preview publish, two verified real expert ROI votes, verified constructor/print process/physical scale, ICC/spot, verified family holdout. `training_ready=false`, `production_approved=false`; unknown => MANUAL.

## M3.59 — equal-length source substitution before second ROI vote (2026-11-20)

- Before change HEAD: `cc072e4923c63f8d01195d603de87dacd21d9e12` (branch comparison identical); PR #4 OPEN, title Draft, API draft flag not independently available through issue endpoint.
- Previous HEAD GitHub Actions: UI smoke [44652593703](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44652593703), raster safety [44652593680](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44652593680), rules/dataset safety [44652593695](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44652593695) — SUCCESS. CircleCI vision-contract and vision-raster — success. Preview publish not confirmed.
- `4524e87b085a395e6dcec1d84b672c3f30900089`: added synthetic regression rejecting same-byte-length original replacement between first and second independent ROI votes. Expected SOURCE_SHA256_MISMATCH, one retained vote, no second vote, no training approval. Test fixture contains no customer content.
- Local triple regressions not executed; new-head CI not yet confirmed at the time of this log entry. No claims about real-world accuracy.
- Remaining: independent triple ROI/PDF/private-stage/Chromium 404/MV3 checks, anonymized reference_state, preview publish, two verified real ROI reviews, verified constructor/print process/physical scale, ICC/spot and verified family holdout. `training_ready=false`, `production_approved=false`, unknown => MANUAL. No production files or customer material changed.

## Правила ведения и контроля

1. Перед изменением: зафиксировать источники, дату, точное требование, целевой модуль, версию и известные риски.
2. Менять только исследовательскую ветку; продуктовые экспорт/заказы/редакторы не затрагивать без самостоятельных тестов.
3. Для каждого численного правила хранить источник, числовую величину и единицы, условия применимости и интерпретацию.
4. После изменения: сделать отдельный тест границы (ниже/равно/выше), сценарий ложного срабатывания и сценарий неизвестного контекста.
5. Не считать автоматические ошибки старого PrintCheck экспертной истиной.
6. Любое сомнение / ошибка источника / неопределённость масштаба => MANUAL, а не «макет годен».
7. В каждом цикле описать обнаруженные сбои и как они устранялись; результаты тестов должны быть подтверждены логами CI.
8. Не публиковать пользовательские PDF, ZIP, токены, исходные имена файлов и номера заказов в публичный GitHub.
9. Без массового автоматического merge/release; rollback = откат отдельного коммита в PR или переключение назад на исходную ветку.
10. Новый цикл — только после фиксации результата предыдущего и записанных открытых блокеров.

## C0 — Изолированная экспериментальная «Макетная»

Дата: 2026-11-16.
Источник: gifts-layout-workbench-mockups-source.
Предыдущая проверенная работа: UI drawer, текстовая сводка старого PrintCheck, локальный canvas-preview; отдельный экспериментальный Vision Studio для специалистов.
CI: в предыдущем цикле GitHub Actions smoke desktop/mobile прошёл.
Ограничение: нейросети и измерения мм в Vision UI нет. Не утверждать обратное.
Точка отката: gifts-layout-workbench-mockups-source.
Публикация: https://tohaa28.github.io/gifts-layout-workbench-vision/ (отдельный каталог; не продуктовая «Макетная»).

## C1 — Формализация официальных правил Gifts.ru

Дата: 2026-11-16.
Задача: отказаться от расплывчатых чисел в тексте, построить проверяемую основу для будущего зрения.

Вход:
- https://gifts.ru/maket-problems — официальный индекс 30 проблем;
- https://gifts.ru/nanesenie-logotipa/specifications — пороги по технологиям;
- https://gifts.ru/news/10004826 — историческое изменение допустимых минимумов 17.03.2025;
- старый PrintCheck, который нельзя считать источником объективных экспертных labels.

Изменения:
- d1444a4575df057a58e3d36bc3ecceff05ce06a4: 30 уникальных PC-001…PC-030, источник каждого, сведения о контексте, статус implementation=planned.
- fefe3533c1c5f9f978b6d862ac09ab7f1a4dc366: технологический JSON v1, 37 строк с материалами, покрытиями и явными исключениями.
- 18b9e80889de38febb1960c2fa575f9fd1763863: чистый JS-resolver без сети, подготовки заказа или ML. Приоритет заказ > конструктор > технология; без экспертного approval — MANUAL.
- 8adf2d95d9bc2765d46feb6627ccfb077f085adb: 20 детерминированных тестов Node.
- c85ccbd696f5338da61eca4494573eafbd95115a: документ docs/RULES_SOURCES.md.

Контроли:
- experimental ruleset запрещает производственную оценку, если не указан research_mode.
- Нет scale_proven/geometry_proven => MANUAL.
- Условное требование (Soft Touch, подложка, бумага/картон) неизвестно => MANUAL.
- Результаты чужой модели не могут менять геометрический ERROR на OK.
- Конфликт 15% / 25% для палитры деколи зафиксирован, автоматическая проверка заблокирована.
- Все источники содержат date/url, но body_sha256 ещё null. Не выдумывать SHA.
- Полный алгоритм извлечения линии/ширины из PDF ещё не реализован; нельзя выдавать эту часть за готовую.

Независимая предварительная проверка: 6 прямых JS-вызовов resolver из полученных GitHub файлов: 6/6 корректно. После добавления тестов отдельный CI-run 43930327681 подтвердил Node 20/20, Python inventory 5/6 (ошибка только в синтетической проверке коэффициента сжатия). См. C2.

Критерий Done: полнота 30 категорий, машинно-читаемые пороги, fail-closed резолвер и тесты. Технологическая аттестация всех порогов и приёмка по реальным заказам — не пройдена, C1 не означает production approval.

## C2 — Приватная инвентаризация старых архивов (без обучения на неверных метках)

Дата: 2026-11-16.
Задача: подготовить инструмент для извлечения статистики из старых диагностических ZIP без передачи изображений в GitHub.

Изменения:
- 8b5399ad4a8197a803af7731819f9abf2d949a18: vision/dataset/inventory.py. Python stdlib, потоковый SHA-256 файлов внутри ZIP, точная дедупликация, ограничения размера/отношения сжатия, запрет traversal/symlink/nested ZIP, агрегация расширений, приватная опциональная хеш-манифестация.
- d14b7c6a852307845830923111e7d59be09c457e: tests/test_printcheck_vision_inventory.py; только синтетические ZIP и искусственные названия заказов.
- 6716538b7828dad1e1490bf8799c720a2e3f4c2c и 2d4392439397c9af08f4ad87d2eeba74367a0900: отдельный CI, корректный путь Python-тестов.
- e6ea6c7799d1dcc7f8249de1f7562cf494ba9fab: воспроизведён и исправлен слишком слабый тест компрессии: вместо 15 000 повторов использован синтетический буфер 500 000 байт, чтобы действительно пересечь порог защиты ZIP (требование не ослаблялось).

Ключевая ошибка первого CI: run 43930327681, Python test_suspicious_ratio_and_total_limits ожидал блокировку 15KB файла при коэффициенте >500. Реальный коэффициент был ниже порога. Исправление затронуло исключительно fixture. Политика 500:1 не снижена.

Гарантии:
- Реальные архивы и исходные пользовательские макеты в публичный репозиторий не отправлялись.
- В стандартной JSON статистике нет путей, имён файлов, заказов и контента.
- По умолчанию все файлы label=unreviewed, а не bad/good.
- Хеш-манифест формируется только с явным --include-hashes и должен оставаться приватным.
- ZIP не извлекаются на диск, обрабатываются только потоково.

Граница ответственности: ни один архив ещё не конвертирован в экспертную разметку, train/validation/test не выделены. Перед этим нужны разрешение на обработку клиентских данных, группы исходных логотипов и верификация специалистами.

## C3 — Следующий незакрытый цикл

Цель: получить первые строго измеряемые физические признаки из PDF/SVG, не трогая продуктовый редактор:
1. На синтетических PDF/SVG с заданными мм сделать доказуемую калибровку.
2. Отдельно определить минимальную ширину позитивных контуров и негативных пробелов, сохранив острые концы букв и контекст формы.
3. Передавать документированный объект геометрического измерения в resolver.
4. Для неточного растра/текста без масштаба возвращать MANUAL.
5. Подключать к Vision UI только после независимых испытаний — без обещаний, что макет уже проверен нейросетью.
6. Внести в этот журнал номер CI, SHA, контрольные результаты и блокеры.

## Текущее положение и стоп-условия

Код остаётся экспериментальным, модель не обучена. Никакой автоматической публикации «годен» в пользовательской Макетной, пока алгоритм геометрии и экспертный контроль не завершены. Рабочая версия и её доставка не менялись. Review PR #4 остаётся draft.

Последующее приложение к журналу должно содержать CI результатов C1/C2 **после прохождения нового запуска**; не вписывать зелёный статус заранее.


## C2 — независимая проверка данных и подтверждение CI (дополнение)

Дата: 2026-11-16.
- GitHub Actions run **43930999550**: rules + ZIP safety SUCCESS; 20 JS-тестов и 6 Python-тестов прошли после исправления тестового сжатия.
- Прочитаны **только локально, без извлечения и сетевой передачи**, метаданные четырёх доступных старых ZIP из пользовательской библиотеки. Независимая инвентаризация: архивы содержат в сумме **54 PDF и 31 PNG**, множество JSON/HTML/XML служебных данных. Число точных дубликатов по SHA-256 среди доступных распакованных записей — **5**, небезопасных путей — **0**, ошибок чтения — **0**. Эти числа относятся только к четырём реально доступным архивам, а не ко всем чатам.
- В первом основном ZIP 23 PDF и 24 PNG, в основном диагностическом ZIP 31 PDF и 7 PNG; остальные два ZIP — XML/BIN/IDX тестовые артефакты, не готовые макеты.
- В публичный GitHub не помещены ни сами ZIP/PDF/PNG, ни имена или ID реальных заказов, ни внутренние хеши. Уровень доверия к старым verdict остаётся UNREVIEWED.
- Реальные изображения не анализировались экспертно и не включались в обучение. Следующий шаг — разметить контрольные зоны с физической калибровкой и разделить независимые семейства заказов.


## C3A — Локальное зрение: связность объектов и отверстия (без производственного вердикта)

Дата: 2026-11-16.
Задача: первая реально работающая и тестируемая стадия визуально-геометрического конвейера; использовать только заранее подготовленную бинарную маску одной печатной краски. Не подменять ею окончательное нахождение тонких линий или нейросеть.

Изменения:
- 08fd6b2a28d348e9f13c756ca0a02c96926e106a: vision/geometry/mask-components.mjs — полный локальный проход без рекурсии, 8-связность позитивных объектов / 4-связность негативных пробелов, координаты и площади, предел пикселей и компонентов, режим INCOMPLETE при переполнении.
- 4fe7acb56d0bca0c57f3fcafe1fe0f3b11f8f0cf: tests/printcheck-vision-topology.test.mjs — 8 синтетических сценариев (изолированные буквы, отверстие, диагональный контакт, пустая маска, калибровка, невалидный растр, лимиты).
- abfb1040d0351cd7e8ffc5e4cb550044f9b85aef: расширение CI.
- GitHub Actions run 43931671913: SUCCESS, JS 28/28 и Python 6/6, всего 34 теста.

Гарантии: модуль всегда возвращает CANDIDATES_ONLY, INCOMPLETE или MANUAL, но не финальный OK/ERROR. Векторный контур и минимальная ширина линии здесь не измеряются. BBox-калибровка в мм доступна только при scale_proven=true и явном шаге пикселя; geometry_proven остаётся false, поэтому цифровой нормативный движок не сможет ошибочно принять эти площади как доказанную толщину линии.

Ограничение: генератор бинарных масок из PDF/SVG, алгоритм настоящей минимальной ширины/негативного зазора и проверка порогов на реальных эталонах всё ещё не готовы. Нельзя автоматически помечать одиночные буквы и отверстия как дефекты.

Следующий завершённый шаг: C3B — получить подтверждённую шкалу мм из PDF/SVG и отделить линии/пробелы от допустимых острых углов при анализе локальных кадров. Продолжать раздельную приёмку и не менять рабочую Макетную.


## C3B.1 — Физические единицы SVG: только координаты документа

Дата: 2026-11-16.

Задача: первый строго ограниченный блок определения масштаба из SVG, с раздельной семантикой масштаба самого SVG-документа и реального масштаба размещения в Макетной.

Коммиты:
- fb8b06da2df136b10d9402893812c813e99711d4: vision/geometry/svg-viewport.mjs — проверка физической ширины/высоты (mm/cm/in/pt), viewBox и отношения масштабов. Не принимает проценты, px или значения без единиц, CSS-размеры, трансформации root, анизотропную геометрию и неаттестованные параметры preserveAspectRatio.
- 89c0cff73d916a3dc50b29295e899575fd54b5d0: tests/printcheck-vision-svg-viewport.test.mjs — шесть синтетических граничных сценариев.
- e13cb09737f0b6b7b11b4bd2527247aaf1739b0c: интеграция проверки в CI; run 43932360357: SUCCESS — 20 нормативных + 8 топологических + 6 SVG + 6 Python = **40 тестов**.

Обязательная перестраховка: даже успешный результат имеет статус DOCUMENT_COORDINATES_ONLY и print_scale_proven=false. Если заказ/размещение масштабируют логотип относительно исходного SVG, технологический размер нельзя определять из исходного viewBox. Дальнейшая цепочка обязана независимо доказать масштаб размещения, реальную геометрию контура и измерение.

Следующие блокеры: обобщённый PDF-transform, кривые Безье, растровые маски с подтверждённой DPI, граница между художественным острым концом и недопустимой перемычкой, подтверждение всех технологических параметров специалистом, разделение архивных групп на train/test. Нейросетевой алгоритм по-прежнему не включён в пользовательский интерфейс.


## C3B.2 — Измерение локальных векторных линий и пробелов SVG/PDF

Дата: 2026-11-16. Рабочая ветка: feature/printcheck-vision-copy-v01. PR #4 остаётся DRAFT, MERGE ЗАПРЕЩЁН до аттестации.

### Цель
Получить воспроизводимые геометрические измерения непосредственно по векторным контурам, а не по bbox изображения или экранным пикселям. Учесть аффинное преобразование конечного размещения и исключить выдуманные минимумы на острых засечках. Честно разграничить результаты локального алгоритма и доказательство пригодности всего макета.
### Входы / проверенные первоисточники
- W3C SVG Paths: https://www.w3.org/TR/SVG2/paths.html
- W3C SVG Coordinate Systems / viewBox: https://www.w3.org/TR/SVG/coords.html
- Существующий неизменённый импортёр Макетной assets/logo-pdf-import.js, поддерживающий PDF.js 5.x operator list.
- Ранее утверждённые в проекте требования к безопасному исследованию, реестр Gifts, resolver и журнал C0–C3B.1.

### Шаги разработки
1. **3512b2c78edcb0df008ad03a6dc955d7a9735d77:** добавлен ограниченный парсер закрытых SVG M/L/H/V/C/Q/Z, абсолютных и относительных команд с адаптивным преобразованием Безье в отрезки. Неизвестная команда/открытая обводка -> MANUAL.
2. **882eddad8fb432417a58f5bd2c8888098afb5b94:** обнаружена потенциальная ошибка аппроксимации: коллинеарные контрольные точки могут выступать за хорду, несмотря на нулевое расстояние до бесконечной прямой. Добавлен защитный критерий.
3. **e080e3b84038bcaaa38955cbaec13f3d9ad9e89c:** локальный аналитический поиск пар параллельных границ, геометрия в мм через матрицу, различение позитива/негатива по заполненности, отбрасывание сужающихся границ и кривых недостаточной достоверности. Данные возвращаются как RESEARCH_CANDIDATES_ONLY.
4. **cb6f5c859dfb7ba343019e251bbe00342c1bebe6:** 17 новых синтетических сценариев, включая масштабирование при размещении, поворот, разные прямые сегменты, отверстия, острые углы букв, Bezier и блокировку недоказанной проверки.
5. **a42c253ef8d710ad21958aeb9860dfba20d71f9b:** подключена проверка к GitHub Actions.

### Реальный цикл «сбой → анализ → исправление → повторный тест»
- Первый прогон GitHub Actions **43933679974: FAILURE**, 49 из 51 JS-тестов прошло.
- Ошибка 1: CURVE_FLATTEN_DEPTH_EXCEEDED на коллинеарной кубической кривой с выбросом. Причина: добавленная защита отклоняла любые контрольные точки вне проекции хорды даже при пренебрежимо малом физическом выбросе, что приводило к бесконечному дроблению около экстремума.
- Исправление **64630b6f44e7b6b3e85df80ebeac4c02823591d8**: не отвергать внепроекционные точки безусловно, а измерять расстояние до **конечного отрезка**, используя свойство выпуклой оболочки кривой Безье. Это даёт конечный верхний предел ошибки и учитывает коллинеарный выброс.
- Ошибка 2: тест ожидал UNSUPPORTED_SVG_COMMAND на синтаксически неполной паре координат. Парсер корректно возвращал MISSING_PATH_ARGUMENT. Исправлена неверная тестовая предпосылка **78f270874af2b6171e1f5a7b10744260fed90a80**, саму обработку ошибок не ослабляли.
- Повторный GitHub Actions **43933867886: SUCCESS** — 51/51 JS и 6/6 Python. Браузерные UI smoke также SUCCESS.

### PDF, связь с существующей программой
6. **a02699ca5e1e95ef5338a527572aba27371c562d:** pdfjs-vector-bridge.mjs; принимает полностью сконвертированный объект из существующего импортёра, вычитает pdfjs viewport из матрицы отображения, применяет явный перевод координат страницы PDF в мм; поддерживает только одиночный закрашенный путь без неподтверждённых эффектов.
7. **7aa176f6e58fda73defd7e4f68b180be986ae102:** первые 10 синтетических тестов PDF (0.4pt -> мм, CTM, масштаб размещения, поворот, заполненные отверстия, неподдерживаемая геометрия/графика).
8. **0db029237be66f1442e33915e48a7ea7cdd95d00:** расширение CI на PDF vector bridge.
9. **da994d74f25c47c24c80906b12b951ac45ab47e2:** два интеграционных теста реального импортёра assets/logo-pdf-import.js через синтетическую PDF.js 5.x operator-list, включая отказ при несведённых в кривые текстовых объектах.
10. **d7c2e9d6350df8b9201563278f5917de93d95315:** договорённости и ограничения изложены в docs/GEOMETRY_MEASUREMENT_CONTRACT.md.

### Итог приёмки
- GitHub Actions **43934368207: SUCCESS**: 63/63 JavaScript и 6/6 Python = 69 тестов; тесты SVG/PDF, технологических порогов, топологии и безопасности архивов. Браузерный UI smoke **43934368140: SUCCESS**.
- Реальные приватные PDF из архивов в публичный CI НЕ добавлялись. Синтетические tests являются регрессиями, а не доказательством качества на реальных логотипах.
- Существующий экспорт/редактор/PrintCheck/производственная Макетная в данном цикле НЕ редактировались.
- Никакие находки не помечаются ERROR/OK в пользовательском интерфейсе: недостаточно подтверждений масштаба и полного охвата объектов.

### Критерии Done: ограниченный C3B.2, а не весь vision engine
Готово: ограниченное извлечение контуров SVG и PDF.js, локальные оценки параллельных стенок в мм, проверка матрицы, регрессии и журнал.
Не готово: промышленные PDF со множественными объектами, сложные SVG arc/group/stroke, физически заверенная связь размещения с заказом, 100% обнаружение узких элементов произвольной формы и кривизны, экспертный датасет, нормирование ошибочных/правильных примеров, trained CPU model.

### C3B.3 — следующая изолированная задача
Получить подписанный контекст конкретного заказа + макета + поля (допуски mm и полный transform); ввести реальную нормализацию PDF multi-paint/SVG stroke/group/arc без потери объектов; расширить обнаружение узких областей beyond parallel walls; сравнить на закрытой экспертной выборке. Только после этого переходить к автоматическому вердикту в PrintCheck Vision и соблюдать отдельный release gate.


## C3B.3 / цикл A — сопоставление полей заказа и PDF с несколькими заливками

Дата: 2026-11-16. Задача: https://github.com/tohaa28/tohaa28.github.io/issues/5
Статус: **завершён исследовательский подцикл A**, задача C3B.3 в целом НЕ завершена.

### Цель и безопасность
Проверить согласованность привязки заказа, артикула, конструктора, поля и макета, сохранив реальные миллиметры и предупреждение о недоверенном клиентском контексте. Не терять отдельные PDF-заливки, когда их объединение доказуемо безопасно. Результат не должен заменять экспертное решение.

### Реализация
1. 0d9147c0fe593dbb93feddd340c17cc423ce5fa6: новый vision/geometry/placement-context.mjs. Проверяет идентичность order_id, sku, constructor_id, print_slot_id, technology_code, SHA-256 макета, ревизии, ref официального источника, физических размеров поля и размеров в единицах PDF. Строит аффинную матрицу из нормированного размещения, поворота, исходных размеров страницы и мм поля; отвергает деформации, выход за границы, неизвестные размеры.
2. 9cbc26ecb2ea0ac456e9f03136b717a8020dd8a6: перестраховка в проверке источника. Исправлено сравнение SHA-256 ревизии с обеих сторон: недостаточно просто проверить формат одного SHA.
3. b5ba27ba4df0689bf8d9887fbb351a6ffd2e0a59: 11 тестов размещения, включая поворот 90°/180°, конфликт mm размеров, неправильные коды, разные SHA, неравномерное масштабирование и поворот за поле.
4. a4fc318d3dd7c01a9bdb01ff6f4cfde62a81717b: расширен vision/geometry/pdfjs-vector-bridge.mjs на последовательные независимые заливки PDF **одной краски**, с индивидуальными CTM. Несовпадающие цвета, неизвестные свойства, касания или пересечения габаритных прямоугольников объектов → MANUAL. Это консервативное правило; некоторые безопасные геометрии также будут направлены на ручную проверку.
5. cb8100e840e91282f38b8ade8b178189347b99cb: 6 новых PDF-проверок, включая отрицательный промежуток между заливками, разные краски, смешанные эффекты, касание, пересечение и реальные PDF.js 5.x operator-list команды существующего импортёра.
6. b9d8d32212f0d3efe6f1a786c6e88eb811c92cb8: обновление CI, запуск Node на всех новых тестах.

### Фактические проверки
GitHub Actions: run **43935972239** — SUCCESS; **80/80 тестов JS** (включая 11 новых placement и 6 PDF), **6/6 Python** тестов приватной инвентаризации. UI smoke run **43935969345** — SUCCESS.
Продуктовый редактор, исходные архивы заказов, рабочий PrintCheck, текущая публичная «Макетная» и её релизы не изменены.

### Граница доверия (важно)
- Два совпадающих набора данных на клиенте НЕ являются подписанным источником заказа. SHA-256 лишь проверяется по формату и совпадению, а не вычисляется из байтов заказа/PDF внутри данного модуля.
- Результат placement = CONTEXT_CROSSCHECKED_ONLY; print_scale_proven=false; geometry_proven=false. Не создавать скрытых допусков «печать разрешена» на основании этого результата.
- Для PDF поддержаны несколько заливок только с доказуемо непересекающимися прямоугольниками и одинаковым RGB; это не полноценная композитная семантика PDF и не разделение печатных цветов.
- Отсутствует доверенная серверная аттестация gifts.ru, полное восстановление SVG/PDF и топологически достоверное измерение минимальных элементов произвольной формы.
- Конфликтующие метки старой диагностики по-прежнему не ground truth. Реальные данные в публичный GitHub не отправлялись.

### Следующий подцикл B
Расширить поддержку настоящих SVG-кривых/групп без утраты семантики заливки, затем добавить адаптер доверенной аттестации заказа и ограниченное тестирование на экспертно утверждённой закрытой выборке. Глобальные ERROR/OK в производственном PrintCheck всё ещё заблокированы.


## C3B.3 / цикл B — расширение SVG: S/T, эллиптические дуги и вложенные группы

Дата: 2026-11-16. Основная задача: https://github.com/tohaa28/tohaa28.github.io/issues/5
Статус: **исследовательский подцикл B завершён**. Полный C3B.3 не закрывать до независимой аттестации масштаба и оценки на реальных макетах.

### Цель
Избавиться от пропуска плавных кривых и дуг, добавить строгую обработку вложенных трансформаций SVG. Никакое расширение не должно изменять рабочий редактор, публиковать клиентские PDF/ZIP или позволять неподтверждённой форме получать автоматический OK.

### Файлы и коммиты
1. 38c2ddf940a01eb7b305719417303294b57c6d7a: SVG path parser — отражение контрольных точек S/s и T/t с верным сбросом после линейного сегмента; продолжаем возвращать MANUAL для неизвестных команд.
2. 0a9c0bbf7bac545c96a23c99977e0e25b4ddee3a: интеграционные тесты непрерывности S/T, относительных вариантов и сброса состояния после L/H/V.
3. 4a286be4d73feeaec6a4f33903aa15ce05fe655a: разбор дуг A/a из endpoint-параметров в центр эллипса и адаптивная дискретизация с консервативным пределом отклонения по максимальному радиусу. Нулевая дуга/некорректные флаги/лимит сегментов не игнорируются.
4. ad4c44db73afef0925c07b9d588a807b30d42b98: тесты относительных дуг, поворота эллипса, большой дуги, явной ошибки аппроксимации и запрещённых вырожденных параметров.
5. aae4f85e7a46221cf8c01d859eabe2ec131d3e5b: новый vision/geometry/svg-dom-vector-bridge.mjs с вложенными группами, матричными transform/translate/scale/rotate, inherited fill, только explicit hex colors, непрерывным fail-closed обходом DOM.
6. 805224b6204db7192b170ed6c6764bfe04f41905: 10 синтетических тестов SVG DOM (включая групповое преобразование, масштаб, негативный пробел, CSS, stroke, неизвестные элементы и collision).
7. 3d4e1144edd80e02585bfa87254865cffc9c82f4: дополнительный глобальный предел 768 узлов-сегментов в SVG DOM перед тяжёлой попарной геометрией.
8. 5e0bc0eb0812873dd024dda16ffa92617e03f62e: CI включает новую SVG DOM группу и проверку синтаксиса.
9. dc800c91fd4dad59e31e9f79050a7092b259bd26: дополнен docs/GEOMETRY_MEASUREMENT_CONTRACT.md.

### Воспроизводимая ошибка и исправление
Первый прогон после расширения path A/a — GitHub run **43936880199: FAILURE**: PDF-тест прежнего конвейера всё ещё ожидал отказа для любой SVG-дуги, но расширенный парсер теперь корректно поддерживает геометрически валидные дуги. Проблема была в устаревшей предпосылке теста, не в ослаблении защиты. Коммит **5fa11098b737c8a4573a97f277eacb2e39f2cc39** заменил тест на реально невалидный флаг дуги (2 вместо 0/1). Повтор: run **43936988688: SUCCESS**, Node 87/87 и Python 6/6.

### Окончательная проверка подцикла
GitHub Actions **43937579086: SUCCESS** — **97/97 JS и 6/6 Python**; UI smoke run **43937579056** (проверяется отдельно в публикационном контуре). Все реальные тестовые объекты синтетические. Модули сохраняют status RESEARCH_CANDIDATES_ONLY, geometry_proven=false, print_scale_proven=false. Самоподтверждение масштаба невозможно.

### Ограничения, блокеры, откат
- Полнота SVG2 не заявляется: root CSS/style, foreignObject, use, text, stroke, изображения и любые неизвестные атрибуты приводят к MANUAL.
- Пользовательские изображения/диагностика в публичный GitHub не выгружались.
- Нет реального доверенного источника заказа с криптографическим подтверждением; сопоставление клиентских объектов остаётся исследовательским.
- Нет измерения глобальной минимальной толщины произвольных кривых и тестирования на независимых размеченных логотипах.
- Rollback — откат точных коммитов внутри экспериментального PR; source branch gifts-layout-workbench-mockups-source не тронута, рабочее приложение не заменено.

### Следующий подцикл C
Построить отдельный доверенный интерфейс получения данных заказа и реальной матрицы поля (с проверкой SHA-256 исходного макета), затем расширить математический анализ непараллельных кривых и проверить на закрытом эталонном наборе хороших/плохих макетов. Ни один общий вывод о пригодности макета не выдавать до прохождения этих gates.


## C4 — Запуск PrintCheck Vision поверх авторизованной страницы Gifts.ru

Дата: 2026-11-16. Запрос: запускать тестовую копию так же, как основную Макетную, в уже авторизованной сессии gifts.ru. Цель — не менять рабочую версию и сохранять полный контроль отката.

### Диагностика
Основная Макетная использует browser bookmarklet: он на gifts.ru загружает из GitHub Pages launcher.js и создаёт iframe.srcdoc на origin gifts.ru с привязкой fetch к parent.fetch. Экспериментальная копия уже имела такой же build-launcher с WORKBENCH_BASE, но её стартовая index.html вела главной кнопкой на ./editor.html (другой origin, вне авторизованной сессии). Пользователь закономерно не получал привычный запуск внутри gifts.ru.

### Коммиты и результаты
1. 305050eba99ab131cddbd5ed5f5fa7a33fa010d0 — стартовая index.html: отдельная drag-to-bookmarks закладка «Макетная Vision», копирование кода, резервный вариант через выделяемое поле, инструкции переключения на авторизованную gifts.ru. Прямой ./editor.html удалён из основного сценария.
2. 3c66431a6db53b581d04dfaa10f8b883fd44fcde — tools/build-launcher.mjs: видимый заголовок Vision, data-gwb-variant=vision, защита от закрытия уже открытой основной Макетной и toggle только своей Vision-панели. Исходную основную сборку не меняли.
3. 49df69d956dfb96a8baa5c314b1e68e99e434761 — tests/printcheck-vision-session-launch.browser.mjs: точный код закладки и реальный собранный launcher.js проверяются на синтетическом https://gifts.ru/ через Playwright. Проверены desktop/mobile, наследование gifts origin в iframe.srcdoc, test-only HttpOnly cookie через same-origin fetch, сохранение исходной страницы, повторное закрытие Vision и защита открытой основной Макетной. Реальные данные Gifts не используются, сеть полностью перехвачена.
4. d621ee4cd8cd24a308e31ac5f94d40a1188b841e — workflow publish-printcheck-vision-preview.yml: сборка изолированного launcher и новый браузерный тест выполняются перед шагом публикации. Публикуется только gifts-layout-workbench-vision/; другие каталоги не затрагиваются.
5. 9e7823b86de895c9613ad108e1912e4604b54902 — обновлено VISION_COPY_README.md: пошаговая установка закладки, авторизованная работа, границы доверия и тестирование.

### Проверки доставки
- GitHub ref main: опубликованный gifts-layout-workbench-vision/index.html действительно содержит visionBookmarklet, а опубликованный gifts-layout-workbench-vision/launcher.js — data variant и условие gifts.ru. Проверено прямым GitHub fetch_file в текущем цикле, а не только наличием source-коммитов.
- Publish commit c9b2dea34715eef13cb55558d6eac4a21db408da: изменены только gifts-layout-workbench-vision/index.html и launcher.js.
- Publish commit 80caee8a66d7c1101ca09f34d8f3d457e4624b94: изменены только gifts-layout-workbench-vision/editor.html и launcher.js. Изолированность подтверждена fetch_commit.
- Новый тест является обязательным шагом publish workflow перед записью в main. Эти commits доказывают прохождение публикационного этапа. Отдельные UI/rules CI остаются независимыми страховками.

### Перестраховки
- У браузера нет разрешённого автоматического API для установки закладки. Пользователь должен один раз перетащить кнопку на панель закладок или вставить код вручную, а затем нажать на неё в текущей вкладке gifts.ru.
- CI не использует реальный аккаунт, не читает содержимое заказов и не подтверждает доступность реальных gifts.ru API. Настоящую сессию надо проверить вручную пользователю.
- Внедрённый через bookmarklet код исполняется с правами текущей страницы gifts.ru; использовать только из доверенного каталога проекта. Не выкладывать данные заказов/токены.
- Если открыта основная Макетная, Vision предупреждает о необходимости сохранить и закрыть её, не удаляя автоматически.
- Вопрос допуска макета по реальной геометрии не менялся; производственный статус PrintCheck Vision остаётся MANUAL до отдельной аттестации.

### Done / Rollback / последующий цикл
Done: отдельный запуск Vision на origin авторизованной gifts.ru по той же схеме, что у основной Макетной; опубликованный изолированный launcher и веб-инструкция; synthetic browser auth-smoke, сохранение основной сборки. Откат — возврат отдельного gifts-layout-workbench-vision/ к предыдущему publish commit без изменения существующих production directories. Следующий шаг — ручной smoke пользователя на реальной авторизованной gifts.ru: отобразить корзину, открыть конструктор/PDF и проверить закрытие/повторное открытие.


## C3B.3.C — CPU-ускорение геометрии без потери тонких элементов

Дата: 2026-11-16. Сохранён контекст Issue #5 / draft PR #4. Подцикл **завершён на синтетических данных**, производственное применение всё ещё заблокировано.

### Обоснование
Исходный vector-corridors.mjs всегда выполнял O(N²) проверок пересечений и параллельных границ; внутри кандидатов по нескольку раз сканировал все контуры ради evenodd. Это привело бы к чрезмерной нагрузке при сложных многообъектных макетах. Требование: ускорение без снижения точности и без k-nearest/лимита соседей.

### Коммиты
- 27756e89e5c5b6f3e1443393fce036ec707475a4 — добавлена точная AABB grid broad phase для ребер в мм, ограничение ячеек/ссылок, полный fallback на reference, счётчики изученных пар.
- 4ef7ee5636c85a7b573b350c468a72b2cb456043 — параметр бюджета индексных ссылок для проверки отката в full reference.
- e9ea9552d76106be479dcb123d40eedd02c1d054 — 8 новых тестов: 80 отдельных линий, отрицательные пробелы, вращение/отражение/анизотропный transform, касания, пересечения, микрозазоры, seeded-random макет и падение обратно на полный перебор.- eabc301fbf6bf195d436626ba66ce2f07ba8c169 — CI включает новый suite.
- e05dbc4b898ed85d8580185a34a1e44a4c0b27c9 — отдельный benchmark с медианами, чередованием порядка методов и проверкой полной идентичности кандидатов.
- 05395f4fc815a46e5d091ea74281bd83a3c7affc — benchmark включён в GitHub Actions без нестабильного жёсткого порога по времени.

### Первый измеренный результат и следующая исправленная гипотеза
CI run 43942532212: 105/105 JS + 6/6 Python, SUCCESS. Измерения после одного AABB-индекса: 80 разнесённых объектов 11,911 / 8,932 мс (1,33x); 60 объектов 15,108 / 13,175 мс (1,15x). Значение было значительно ниже ожидаемого несмотря на сокращение геометрических пар; выявлен узкий участок: point-in-polygon сканировал каждый контур при каждой промежуточной пробе.

### Вторая оптимизация
- b1394dd0eef1d5d5c7cd1aedde52c27f5a871f30 — вычисление bbox каждого кольца и отказ от point-in-polygon только если точка строго вне bbox. Вблизи границы +1e-9 остаётся исходный точный тест. Входное изображение и геометрические предикаты не менялись.
- CI run 43942731826: SUCCESS. 105/105 JavaScript и 6/6 Python. Повтор benchmark:
  - 80 разнесённых тонких линий: полный перебор 10,580 мс; пространственный индекс 2,294 мс; **4,61x**; пар коридоров 51 040 → 400.
  - 60 отдельных элементов: полный перебор 7,130 мс; пространственный индекс 2,383 мс; **2,99x**; пар коридоров 28 680 → 855.
- UI smoke run 43942731760: SUCCESS (действующие редакторы не тронуты).
- af2f346edaafb89fe2a524bd9e08643e05261309 — подробный docs/PERFORMANCE_C3B3_C.md с методикой измерения, исходными значениями, ограничениями и URL CI.

### Приёмка и ограничения
**Done (исследовательский подцикл):** многократное подтверждённое структурное сокращение числа пар и измеренное ускорение на двух синтетических сценариях; точное совпадение результатов индексного и полного алгоритмов по кандидатам, координатам, размерам, погрешностям и состояниям на тестах; отдельная воспроизводимая CPU-диагностика в GitHub Actions; не было изменений редактора Gifts, макетных данных и релизов.

**Не Done (производственный PrintCheck):** нет доказательства полного глобального минимума на кривых/острых переходах, экспертной оценки заказных PDF, проверенной конечной матрицы заказа и полноты многокрасочного PDF. Текущий измеритель сохраняет RESEARCH_CANDIDATES_ONLY, print_scale_proven=false, geometry_proven=false. Обе цифры ускорения — synthetic microbench, а не гарантия на любых реальных макетах.

**Rollback:** откат отдельных оптимизационных коммитов в feature/printcheck-vision-copy-v01; доступен режим pair_index=reference для воспроизведения предыдущей попарной геометрии. Черновой PR #4 не сливать.

**Следующая задача C3B.3.D:** независимый эталон для сложных кривых, сравнение на закрытых хороших/плохих архивах и утверждение реальной шкалы миллиметров через доверенные данные заказа.


## C3B.3.D — Криволинейные локальные измерения и приватная экспертная оценка

Дата: 2026-11-16. Issue #5 остаётся OPEN, PR #4 остаётся DRAFT.

### Требование
Повысить полноту обнаружения узких позитивных элементов и негативных промежутков на кривых. Отбрасывать ложные ошибки на допустимых острых вершинах/засечках, не приписывать локальному измерению глобальную полноту. Подготовить верифицируемую и приватную оценку на архивных макетах только с экспертными метками.

### Методологический поиск
Сверены современные подходы: medial axis / skeletonization, local feature size, векторные границы и требования SVG. Медиация между локальным нормальным сечением и настоящим medial axis критична: нормальное сечение даёт лишь отдельный геометрический *кандидат*. Источники и границы отражены в docs/C3B3_D_CURVED_EVALUATION.md.

### Реализованные циклы и коммиты
1. 7a68c734e3c9275eb6714a7d0ea412f175ed86a9 — vision/geometry/curved-normal-probes.mjs: независимое нормальное сечение противоположной границы по трём соседним участкам с угловыми, топологическими и метрическими ограничениями; препроверка через существующий inspector. Острые вершины, касательные/вершинные пересечения, самопересечения, непостоянная ширина или неизвестная шкала → отвергнуть. Всегда RESEARCH_CANDIDATES_ONLY, либо MANUAL; ни единой production-оценки.
2. 446ad7344a18732e57cc89f71869256061e6abb8 — 10 синтетических тестов: концентрические кольца толщиной около 0.18 мм, синусоидальная векторная лента, отрицательные зазоры кривых, масштаб, острые уголки, топологические сбои, лимиты и отсутствие ложного одобрения.
3. fc1fbd3dfedd8f820bc659d39f18cfac46c698bb — тесты добавлены в CI. Run 43945183827: 115/115 Node + 6/6 Python, SUCCESS.
4. 02fa3cede74f0eeca41d2ba12128934ee56b2aa9 — vision/dataset/evaluate.py: строго локальный оценщик **региональной** разметки, блокировка пересечения train/test по artwork и family хешам, недоверенных labels и дублей, учёт MANUAL, вычисление aggregate precision/recall/FPR без имён и ID.
5. ab2a6177553102ffc2e877bea325cb2dbce22ce7 — 11 Python synthetic tests: FP/FN, abstention, групповая утечка, отсутствие экспертного provenance, приватность и защита от перезаписи.
6. 281149a9057d7a7c7668d84d54f9872079474da0 — новый оценщик включён в CI. Run 43945732991: 115 JS + 6 inventory + 11 evaluation Python = 132 tests, SUCCESS.
7. 005353d56c919c157828a59702d237ed11a80b38 и 27140f028ee1fbe80fa53cadded8af608c497cf1 — исследовательский режим include_curved_probes в SVG DOM и PDF.js векторных адаптерах, строго opt-in и без изменения старых результатов.
8. 24ff7afac8e3960d6ebcf967118daade3ca1cb2d и fec8967cc42b39b7f0e04221abe7acb9d39a674e — синтетические интеграционные тесты SVG/PDF концентрического кольца с передачей дополнительного, но не утверждённого измерения.
9. a559e14cda2c3e2ee95d72e0a5adbb8206c187c3 — 4-кратный бенчмарк круговых полос 48/96/192/384 сегмента; равная воспроизводимая геометрия, без жёсткого нестабильного тайминг-gate.
10. a9017bf079c0403f2140926f9f1956d3134ff807 — benchmark включён в GitHub Actions. Run 43946512910: 117 JS + 6 inventory + 11 evaluation Python, SUCCESS.
11. 7321956f57050639634d30e46a800c4cca9c1ad7 — docs/C3B3_D_CURVED_EVALUATION.md: алгоритм, доказательства и открытые технологические ограничения.

### Числовые испытания CPU (НЕ заказные макеты)
GitHub Actions [run 43946512910](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43946512910), Node 22, Ubuntu, синтетические концентрические круги:

| Сегментов (в обоих контурах) | Стабильных локальных кандидатов | Медиана CPU |
|---:|---:|---:|
| 48 | 48 | 3,206 мс |
| 96 | 96 | 7,750 мс |
| 192 | 192 | 20,603 мс |
| 384 | 384 | 67,071 мс |

Значения показывают расходы собственного normal-probing, НЕ ускорение/регрессию относительно неизвестного production benchmark. До получения материалов от технологов и реальных профильных PDF производительный SLA задавать нельзя. Текущая сложность включает полный перебор границ и topology preflight; в следующем цикле целесообразно переиспользовать spatial broad phase для ray intersections.

### Реальная локальная инвентаризация пользовательских архивов, без публикации
В этом цикле найдены и обработаны метаданные **только четырёх доступных ZIP** в приватном runtime; 167 записей, 162 уникальных SHA-256 содержимого, 5 точных дубликатов, 55 048 723 байта, опасных путей — 0. По форматам найдено 54 PDF и 31 PNG, остальные файлы — служебные.
Логов эксперта или достоверных ground-truth регионов по содержимому не подтверждено. Поэтому **на этих реальных ZIP нельзя законно сообщать precision/recall**, и тесты не используют их в публичном GitHub. ZIP, макеты, реальные имена/ID, SHA заказов и токены не загружены в PR.

### Итог независимой CI-проверки
- GitHub Actions [43946135431](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43946135431): **117/117 JavaScript + 6/6 inventory Python + 11/11 evaluation Python = 134/134 PASS**; opt-in SVG/PDF bridge включён в тесты.
- GitHub Actions [43946698931](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43946698931): SUCCESS, включая CPU benchmark.
- UI smoke [43946699017](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43946699017): SUCCESS. Главные HTML/editor и production GitHub Pages не менялись.

### Риск и завершение
**Done (C3B.3.D, исследовательский):** локальное измерение действительно кривых с требованием стабильной поддержки и защиты от заострений, мосты PDF/SVG opt-in, синтетические интеграционные тесты, бенчмарк CPU, приватная оценочная схема с blocked leakage, аудит доступных ZIP и актуализированный подробный журнал.

**Не Done:** реальная точность обнаружения по размеченным макетам неизвестна; normal ray не равен точному medial axis; могут остаться пропущенные микроперемычки между дискретными выборками; технологически допустимые детали могут выглядеть тонкими. Физическая привязка к реальному заказу не удостоверена, полноценная многокрасочная/сложная PDF геометрия не доказана. Производственный вывод OK/ERROR и любые попытки подменить эксперта запрещены.

**Rollback:** новая функциональность выключена по умолчанию; можно отказаться от include_curved_probes либо откатить отдельные коммиты в feature/printcheck-vision-copy-v01; draft PR #4 не сливать.

**Следующий этап C3B.3.E:** получить экспертно подтверждённые региональные labels в приватной среде, привязать оригинал artwork/технологию/масштаб, провести слепую проверку FP/FN, сравнить vector normal-probes vs точный сегментный distance transform и исключать допустимые острые точки. Не вводить модель в производство до полноты покрытия и верификации матрицы поля.


## C3B.3.E — слепой экспертный протокол и сравнение детекторов на идентичных областях

Дата: 2026-11-16. Основная ветка изменений: feature/printcheck-vision-copy-v01. PR #4 — DRAFT; Issue #5 — OPEN. Главное требование: измерять не только скорость, но и настоящие ошибки обнаружения в независимой разметке; не превращать старые автоматические диагнозы PrintCheck в ground truth.

### Диагностика предыдущего этапа
- Vision Studio экспортировала прямоугольники с типом области и комментариями подготовителя, но не предоставляла двум экспертам идентичного неизменяемого слепого задания.
- Существующий evaluation script вычислял метрики на отдельно оформленных подтверждённых метках, однако не было механизма получить согласованные экспертные ответы с предварительным статусом.
- Возможность назвать область «нормальным острым углом» могла подсказывать рецензенту ожидаемую оценку. В новом задании тип подготовителя намеренно отсутствует.
- Группировка исходных заказов и независимая верификация физических размеров пока недостаточны для настоящих метрик на архивных PDF. Не объявлять хороших/плохих заказов без технолога.

### Коммиты рабочего контура
1. a74dbada439f9b81764a835713a5bd9381381f85 — vision/dataset/review-task.mjs: фиксированные ROI с криптохешем source+geometry, формат независимых ответов, запрет автоматического превращения consensus в verified.
2. 903b033f085d84de5c5de625acb0c77286d71ca6 — 10 JS synthetic tests на неизменяемость заданий, отказ по дублям, несоответствующим SHA, совпадающим рецензентам, расхождениям и отсутствие ложной аттестации.
3. e954fb36c9714ec71f6fa8f69fb7c68740071e13 — vision-studio.html: новый экспорт слепых заданий по нормализованным областям, опциональные хеши family/artwork и код технологии. Экспорт не содержит исходного изображения, файлового имени или комментариев.
4. 3d6a59e9ce7a8a23fa84aa8f590bfe3b382a982b — vision-review.html: отдельная локальная слепая проверка, 1:1 SHA изображения, выбор номера ROI, увеличенный фрагмент без сглаживания, три состояния оценки, экспорт локального ответа и ограничения размеров.
5. c13c93483f333c7a4a7f07d32dcf6e8dc8b1cc44 — browser smoke двух независимых специалистов на синтетической PNG, проверки no-network и отказ по неправильному изображению.
6. 75afdde522adde6da0467924fc79d104d9949cf5 — browser smoke Vision Studio теперь проверяет исходное содержимое слепого задания.
7. f1eeeb1f3ca17b8d08ea673b798436fcd3887185 и dcbd47c2ad0e3370bc2c4d0e9604f08497b595ec — независимые CI-gates, выпуск отдельного preview/vision-review.html и единственного публичного JS-контракта.
8. **42c22a080a03d776fec8aecb17a8f06829029d2a** — важное исправление потенциальной утечки подсказок: в task больше НЕ включается поле type, только нейтральные ROI; source/context whitelist также закрыт от случайных полей с именами заказов.
9. 4db24ff7000604c318f81dbd32398459d84b6584, c1386dd0dac3a8e72ad6be829613b8b1f8063c6e, 117a075ff42a4a76d2e30d3c5767c117dcf34e38 — интерфейс и тесты переведены на полностью нейтральный ROI, номер без названия дефекта.
10. 613f2a84cd0a8c95d678cd6faa1a503c950f3710 и beb3db3f090a639545c3437b29454ac0dbf6c3bc — приватный Node CLI compare-reviews.mjs: SHA неизменяемого задания, два разных reviewer_ref, агрегированное stdout без IDs, спорные области требуют пересмотра, локальный 0600 JSON без перезаписи, размеры входов проверяются до readFile.
11. c5be3f6b627942b4ae7976a09a14d484c421f40c — 4 synthetic CLI-теста (права, отказ от перезаписи, SHA mismatch, независимые идентификаторы).
12. 0d1d8ad30d6d261b8ed05b54f4947c7c2c7926f1 — compare-region-methods.mjs: research-only результаты на одних и тех же прямоугольниках по явному преобразованию мм → нормализованный растр. Разделяет candidate/none/manual; при неопределённом пороге/геометрии/масштабе выдаёт ручной статус, никакого production OK.
13. 68db9d3765293e53502fb182becb221831691646 — 9 synthetic тестов сравнения алгоритмов на идентичных ROI.
14. eaeee080eabf7ea0c72a3c429f4113eda10fab13 — end-to-end проверка реальных экспериментальных vector-corridors и curved-normal-probes на одном синтетическом кольце/ROI (не подставные массивы кандидатов).
15. 8888bade68b017117a90e00b1c42b7cd1da5bd10, eedb0c43cc844fbe49f9c9cede4973b1b25cb4e6, 60db24796574a362c9ff2fdacd5d71a65bbf7178 — обновления Node CI-gate.
16. 9c6bd63941b2e8b7a4326a73af4d4e2b8580108a — отдельные ссылки на экспертную Studio и Vision Review добавлены на стартовую страницу копии.
17. daf6173754e3abfe1e418682163879a0505814aa — подробный протокол docs/C3B3_E_EXPERT_PROTOCOL.md с инвариантами, источниками, правилами самоутверждения, технологическими ограничениями.
18. 29c70264ad16c433ad08a22c9793b8c72359010a — актуализирован VISION_COPY_README.md.

### CI на реальных исходниках GitHub
- [Rules and dataset safety run 43952444330](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43952444330): SUCCESS, **141/141 Node tests + 6/6 Python ZIP + 11/11 Python evaluation = 158/158**. В Node включён end-to-end реальных геометрических инспекторов; исходные файлы клиентских заказов не использовались.
- [Experimental UI smoke run 43952444418](https://github.com/tohaa28/tohaa28.github.io/actions/runs/43952444418): SUCCESS, включая независимую review page и основную Vision Studio. В тестах только generated.png размером 1×1 и синтетические JSON, все запросы к внешней сети блокированы.
- До изменения schema был отдельный успех на чистом CI; затем исправлены подсказки типа и повторно подтверждена зелёная приёмка.

### Обнаруженный блокер публикации и обход без нарушения production
В GitHub ref main **не оказалось файла** .github/workflows/publish-printcheck-vision-preview.yml (и UI smoke workflow), поэтому автоматическая публикация из экспериментальной ветки была не подтверждена. На main отсутствовали новая review page и JS, хотя ветка прошла тесты.

Для восстановления непосредственного доступа вручную опубликованы только четыре файла внутри изолированного каталога gifts-layout-workbench-vision:
- 8c2dd18df2e8cd5afc88bacf648f1afe4f41b7f9 — vision/dataset/review-task.mjs;
- 2d290e6245661022fc91644bd1ddf7b2bc7cde03 — vision-review.html;
- 2eb40bee0643269fdc0ff936e3b1c1dd81fd8784 — vision-studio.html;
- bce40d23dd8cddec135e7a6a4455373b8cfb6106 — index.html.

Независимой сверкой fetch_file на ref main подтверждено **побайтно одинаковое содержимое** всех четырёх файлов с экспериментальным источником. Ни один путь вне gifts-layout-workbench-vision не изменён этими коммитами. Базовый рабочий исходник Макетной не модифицирован. Доступность URL GitHub Pages после CDN-публикации отдельным реальным HTTP тестом в этом цикле не утверждается.

Автопубликация для следующего цикла требует отдельно зарегистрированного и безопасно изолированного default-branch workflow; пока ограничиваться ручной проверенной публикацией каталога.

### Состояние и следующая задача
Done: структурированный слепой процесс двух рецензентов, одинаковые области, контроль source SHA, исключение возможных подсказок, локальное согласование с adjudication, измерение алгоритмов на одинаковых ROI в экспериментальном режиме, 158 автоматических проверок, доступная в main структура сайта.

Blocked: аутентификация рецензентов, независимое утверждение реальных меток по исходному PDF/SVG, подлинная матрица мм на поле нанесения, выборка настоящих good/bad логотипов с контролем train/test leakage и near duplicates, надёжный автодеплой. Промышленный PrintCheck не получает новую геометрию и не делает OK/ERROR. Issue #5 оставить OPEN; PR #4 DRAFT.

Rollback: отменить 4 изолированных source→preview коммита main для страниц экспертной студии, вернуть previous preview source из истории; эксперименты в PR #4 откатываются отдельно, действующие подарочные страницы не затрагиваются.

Следующий цикл C3B.3.F — запуск настоящего закрытого двухэкспертного пилота, adjudication по конфликтам, независимая проверка source image ↔ artwork ↔ family ↔ technology ↔ scale, слепой подсчёт региональных TP/FP/FN/TN; пользовательские ZIP ни при каких обстоятельствах не переносить в публичный GitHub.


## C3B.3.F — Закрытый пилот с криптографической приёмкой двух экспертных ответов

Дата: **2026-11-17**. Ветка feature/printcheck-vision-copy-v01, draft PR #4, Issue #5. Цель — связать экспертные региональные метки с исходными байтами заказа и получить строго подписанный отдельный исследовательский набор для каждого геометрического метода без публикации клиентских данных.

### Источники и исходный риск
- C3B.3.E давал только JSON двух независимых рецензентов. Хеши их идентификаторов были самоутверждением; сырая строка SHA-256 и метка verified не обеспечивали настоящей подлинности.
- Node.js crypto Ed25519 поддерживает подписи и проверку по переданным raw data и trust key: https://nodejs.org/api/crypto.html.
- Режимы consensus и независимой ground-truth разметки: https://docs.cvat.ai/docs/qa-analytics/consensus/ и https://docs.cvat.ai/docs/qa-analytics/quality-control/.
- Нормы Gifts.ru: https://gifts.ru/maket-problems и https://gifts.ru/nanesenie-logotipa/specifications.
- Реальных удостоверенных экспертных решений и подписанных оригиналов в текущем цикле не получено. Тесты используют только синтетические байты и временные ключи.

### Выполненные коммиты
1. fd88b92f37043d83ba26bfc2983ac81ebd89790e — vision/dataset/pilot-attestation.mjs: отдельная offline-проверка двух независимых отзывов, подписи аудитора Ed25519 и SHA исходников/результатов, проверка закрытия каждого конфликта и границ доверия. Открытый ключ должен иметь заранее независимо закреплённый SHA-256 DER SPKI.2. 4f116b6daa20d1b1b45aae2ea9c9c346d64af26a — исправлена ошибка возможного смешения методов с одинаковым номером revision: каждому алгоритму соответствует отдельный набор региональных predictions для Python.
3. 5893511a7ed070095905d907598790ef220b8413 — 10 security/regression тестов: подмена исходного изображения, другого оригинального вектора, подписи/публичного ключа/pin, удаление/дубли ROI, конфликт экспертов, неверный технологический код, неопределённые результаты.
4. 52bf22200faa065259c5451f5b3ad584a23f70fe — Node CI; первый успешный run 44016723934, 151 JS + 6 ZIP Python + 11 evaluation Python.
5. ea0b1e2e72538f2147d4d2f45b90d353cb52865b — приватная запись результатов: только в заранее созданную закрытую папку, отдельный файл на метод, 0600 для файла и 0700 для каталога на POSIX, без перезаписи, без идентификаторов в stdout.
6. b0ef1e790b8570e6533f18f841bb4a4f09642473 — тесты экспорта, отсутствия перезаписи, исключения неопределённых областей; run 44016874172 SUCCESS.
7. f34484e24ec4cf25abb43474607287a97baa29d3 — вместо фиктивного доверия к строкам SHA запрашиваются фактические локальные байты source snapshot, calibration evidence и sampling plan; digest сверяется с signed attestation.
8. a4237f587cfbd6ecb44ecc42d05f7264f33568fe — дополнительные тесты подмены всех трёх доказательных файлов.
9. 39e9ba798c4875d75672424488f06454276bf8ed — prepare-pilot-signoff.mjs создаёт только UNSIGNED_AUDIT_DRAFT_ONLY: четыре внешние проверки false, незакрытые конфликты остаются manual, нет автоматической аттестации.
10. b48346aa9e84c9e9396ebb47da2f03358878320a — тест подписания черновика без настоящей приёмки: корректно отказано; независимый аудит и закрытие конфликтов включаются только после явной проверки.
11. 816231478501aaf73e4a95885fcc08b062e40940 — CI проверяет синтаксис и логику подготовки unsigned draft.
12. 12fd719f6d59e775d2af3186f7de7e86e5bb6091 — реальный синтетический end-to-end: два экспертных ответа, офлайн-аудит, подписанный Ed25519 final JSON, проверки исходных байтов, два отдельных output JSON с правами 0600, Python evaluate.py для каждого.
13. 4f580251ed5e668510c397748f3ae743e5e8e75c — полный Node→Python E2E gate в Actions после setup-python.
14. 6e8e082671d74222500e84b08e655d83d390dff4 — docs/C3B3_F_SIGNED_PILOT.md: операторская инструкция, порядок секретов, OpenSSL/Node подписи и доверенного pin, независимый holdout.
15. f86b6109fb4c0e1582b1e3336bf79492d5a07f16 — усилена слепота экспертных ответов: любые дополнительные поля с подсказками от предиктора или неизвестными свойствами приводят к отказу.
16. b4179f8ad17b6c0607b8c4d86e61f1f23f5e0cdc — тест отказа при prediction_hint и confidence_from_model, скрытых внутри ответов рецензентов.
17. 1c29e16d046a3d6bd8a7fb64b6ccba906f851c89 — README дополнен ссылкой на закрытый пилот.

### Фактические проверки
- GitHub Actions run 44017343898: SUCCESS, **156/156 JavaScript + 6/6 ZIP Python + 11/11 Python evaluator**, также отдельный успешный end-to-end Node→Python (вывод: Signed synthetic pilot -> segregated private files -> Python research metrics: PASS).
- В локальном чистом временном каталоге OpenSSL 3.5.5 была создана синтетическая Ed25519 пара и подписан test-only JSON: Node crypto.verify вернул true, длина подписи 64 байта. Реальные ключи аудитора не создавались и не размещались в GitHub.
- После добавления защиты от hidden predictor hints запускается повторный CI; окончательный статус должен проверяться на HEAD feature branch. UI smoke не менялся.

### Инварианты
- Изменения только в экспериментальной ветке; рабочую Макетную и реальные пользовательские заказы не изменяли.
- Система проверяет факт соответствия байтов цифровой подписи и SHA. Реальную подлинность Gifts.ru, размеры на изделии, независимость рецензентов, sampling fairness и применимость технологии должен удостоверить внешний технолог-аудитор. Подпись — криптографическая связь и ответственность, не волшебное доказательство фабричного допуска.
- Нельзя принять подпись с ключом, SPKI SHA которого не закреплён заранее. Нельзя автоматически подтвердить незакрытые конфликты.
- Каждый метод получает отдельный исследовательский dataset, а abstention эксперта не подменяется на acceptable. Не доверять утверждению отсутствия локального кандидата как одобрению макета.
- Python evaluate.py по-прежнему не проверяет подпись отдельно; запускать только после signed-pilot verifier. Он блокирует прямой family/artwork train/test leakage, но визуальные near duplicates разных заказов остаются отдельным исследовательским риском.
- В публичные файлы не передавались реальные ZIP/PDF/PNG, клиентские хеши, подписанные ответы или закрытые ключи.

### Done и блокеры
**Инфраструктура C3B.3.F готова:** исполнимый локальный подписной конвейер, строгие SHA исходника и доказательств, Ed25519 с pin, отказ при незакрытых конфликтах, защищённый экспорт по отдельным алгоритмам, сквозной тест Node+Python и руководство для оператора.

**Реальная контрольная выборка и производственная точность не готовы:** пока нет двух независимо удостоверенных экспертных разметок настоящих заказов, подтверждённых исходных PDF/SVG и физических миллиметров, подписанного подтверждения аудитора. Реальные FP/FN/recall не измерялись. Production OK/ERROR не разрешён.

**Следующий цикл C3B.3.G:** приватный первый пилот с доверенными экспертизами; дедупликация визуально одинаковых макетов между источниками, предрегистрация sampling plan, blind test-holdout с контрольными непредложенными алгоритмом ROI, сверка физического placement. Сохранять draft PR #4; слияние запрещено до независимой приёмки.


### Финальная приёмка C3B.3.F на усиленном контракте

2026-11-17. Последний независимый GitHub Actions [run 44017680177](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44017680177) — **SUCCESS: 157/157 JavaScript, 6/6 Python inventory, 11/11 Python evaluation = 174/174**, плюс отдельный проход synthetic Node/Ed25519 → закрытые файлы → реальный Python evaluator (PASS). Независимый browser smoke [run 44017679621](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44017679621) — SUCCESS. Дополнительно протестированы запрет предикторных подсказок в ответах и отказ от подписания черновика без явной приёмки.

Приёмка касается **только синтетической инфраструктуры**, а не результатов реальных заказов. Следующий цикл не должен маркировать реальную точность без подписанных оригинальных доказательств, реального физического масштаба и независимых экспертных решений.


## C3B.3.H — реальный контроль покрытия слепых ROI независимо от алгоритма

Дата: 2026-11-17. Issue #5 OPEN, PR #4 DRAFT, исходная рабочая ветка gifts-layout-workbench-mockups-source неизменна. Резервный CI CircleCI vision-contract подключён и возвращает внешний GitHub commit status.

### Задача
В C3B.3.G были введены подписанный holdout и поиск near duplicates. Однако предыдущий locked-pilot-gate проверял только байты произвольного samplingEvidence, не пересчитывал независимые контрольные регионы и мог разрешить исследовательскую оценку набора, где каждый экспертный ROI предложен самим алгоритмом. Это затрудняет выявление пропусков (FN) и оценку полноты.

### Изменения
1. e746fb57b48fbc4e0d7d3d8c8564a9cdd768c6d2 — vision/dataset/blind-sampling-plan.mjs. HMAC-SHA256 ранжирование ячеек сетки с доменным разделением source image SHA+grid. До 4096 ячеек, 250 контролей, O(G log G). Зафиксированная нормализованная геометрия в той же 8-значной точности и те же SHA region ID, что создаёт Vision Studio. Независимый пересчёт всех ROI по конкретным байтам plan и SHA подписанного cohort, контроль источника и отсутствие переклассификации.
2. cabe936aadaccdc954d6fd22a171efea09814db2 — vision/dataset/locked-pilot-gate.mjs обязательно проверяет контрольные регионы, не допускает метрики без надёжного плана и сообщает количество control/candidate ROIs. Не выдаёт manufacturing approval.
3. ac7d95d752008e881e708944f5d4f761f956b811 — прежний синтетический signed locked-pilot фикстур теперь содержит настоящий детерминированный control ROI и plan exact bytes вместо произвольной строки «sampling plan».
4. feda29e53e324deeaa217c5e745fb2498e93f83e — 11 новых adversarial тестов: повторяемость, изменение seed/source, неподписанный байтовый план, подмена геометрии, исключение части контрольных зон, переклассификация ROI, минимум 25%, строгое соответствие технологии, неизвестные поля.
5. d6fbda4c2951d10c45672cfad9975adfe644c4ad — правила GitHub Actions дополнены новыми проверками. Резервный CircleCI автоматически запускает все tests/printcheck-vision-*.test.mjs. Проверка CircleCI к этому коммиту: SUCCESS, https://app.circleci.com/workflow/3e887b5a-1a0d-4bcb-86d8-d3b30ee7b4e0/job/b3bab6eb-8a25-460d-b467-ae900cb49393.
6. 077a5b2908341f61979a3581b7bc8608a9deba0d — vision/dataset/prepare-blind-control-task.mjs: операторский Node CLI. На основе предварительного задания от Vision Studio формирует новый унифицированный blind-task и отдельный приватный seed-based plan. Никогда не передаёт seed экспертам, не меняет исходное задание. Ограничения на размер, защитные хеши, проверка 25% контролей. Пишет только 2 файла в уже существующую закрытую директорию, 0600 на POSIX, без перезаписи.
7. f144bb937871137fef8b87891f9768ca06f1027e — 6 дополнительных тестов подготовки, приватной записи и взаимодействия с нейтральным экспертным task.
8. 29b61bd48732f50921b95e48021802213a96e7e9 — новые тесты и JS syntax включены в GitHub Actions workflow. Независимый CircleCI vision-contract после изменений: SUCCESS, https://app.circleci.com/workflow/8f0c0441-9a3b-4fad-b848-b31dbc0e4ac8/job/04f95c22-26f0-45c2-8571-9f05a3f3cfc5.
9. e7891c2b840eba9567ba3abab1440878fa438a6b — docs/C3B3_H_BLIND_CONTROLS.md, подробный протокол локального оператора, требования к seed, пути приватных файлов, точные признаки покрытия и ограничения исследовательской выборки.
10. c9441d117a793f53ffb054bfa82aeb9dbc42916d — актуализирован VISION_COPY_README.md с независимыми контрольными ROI.

### Приёмка и ограничения
Готово: проверяемые воспроизводимые контрольные ROI; офлайн-подготовка и бинарное совпадение подписанного плана, запрет исследовательского evaluation_allowed без 25% независимых контролей; Node-прогон в CircleCI подтверждён зелёным внешним статусом. Никаких исходных клиентских файлов или подписей в CI не загружено, использовались только искусственные данные.

Не готово: проверка настоящего времени фиксации seed до подбора модели, случайный/репрезентативный отбор целых заказов, независимое удостоверение происхождения PNG/RGB fingerprint, сравнение с экспертно размеченными реальными заказами и глобальная проверка всех тонких элементов. 25% является минимальной инженерной квотой, а не статистически обоснованной мощностью исследования. Нельзя публиковать real-data precision/recall или делать автоматический production OK/ERROR.

Rollback: изменения только в экспериментальной feature ветке; новые control план и CLI отдельно удаляются, locked-pilot-gate можно вернуть к исходному безопасному MANUAL (не разрешать исследование без плана), PR #4 не сливать.

### Следующая задача C3B.3.I
Сверять извлечённые visual fingerprints signed cohort с **самими локальными байтами исходных превью**, учитывать разрешение, сложные фоны и цвет, блокировать подмену самоутверждённого fingerprint, затем провести закрытый pilot с двумя реальными экспертами и подтверждённой физической шкалой заказа.


## C3B.3.I — перестать доверять визуальным отпечаткам без исходных пикселей PNG

Дата: **2026-11-17**, PR #4 DRAFT, Issue #5 OPEN. Ветка feature/printcheck-vision-copy-v01. Отдельная работа над проверкой byte provenance signed cohort; production Макетная не менялась.

### Проблема
Предыдущие C3B.3.G/H проверяли SHA, подпись Ed25519 frozen cohort и cross-split perceptual-distance, но **visual fingerprints внутри подписанного JSON не пересчитывались из оригинальных PNG**. Подписанное необоснованное значение могло изменить screening или дать ложную «чистоту». Также не был доступен защищённый локальный инструмент, который проверял бы большой подписанный cohort по файлам последовательно.

### Реализованные изменения
1. **a1dd0105a3b5de1a4e5e9f7be27415b2b4c6d3bc** — vision/dataset/strict-png-decoder.mjs. Строгое subset PNG с полной CRC-32 проверкой chunk, обязательными IHDR/IDAT/IEND, порядком данных, фильтрами PNG 0–4, пределами размера и декомпрессии через Node zlib maxOutputLength. Вход 8-bit noninterlaced RGB/RGBA/gray/gray+alpha, без цветового управления. Неизвестное/неподдерживаемое — MANUAL, никакой автоматической «коррекции».
2. **49680b66513708ad36e6284c507a9239b5e9e88e** — vision/dataset/cohort-image-provenance.mjs: проверка полной coverage всех entries signed cohort, SHA исходных compressed PNG, пересчёт fingerprintRgba из независимого decoded RGBA, сравнение всей детерминированной структуры (bbox, dims, ink_fraction, 8× silhouette+gradient). Одного SHA изображения или подписанного JSON недостаточно.
3. **ff422dcd188ca3f6c274e10508749e1f8b00e678** — vision/dataset/locked-pilot-gate.mjs: обязательный cohortImageBytes со всеми исходными изображениями; только после независимой проверки PNG допускает исследования по подписанному двум экспертам pilot и control sampling plan; без PNG — MANUAL/evaluation_allowed=false.
4. **44a79dc603ca00f5e7f4092abc689a364013c211** — тестовый генератор PNG, строгие binary-only synthetic fixtures (не пользовательские файлы).
5. **605aebfccab189f539d1ed9616df686c8ad7dfc5** — 10 PNG тестов: все пять W3C scanline filters, grayscale/RGB/RGBA, split IDAT, CRC corruption, palette/profile/APNG, interlace, oversize, decompression bomb, CRITICAL-chunk и trailing bytes.
6. **2591380b76d05c8d90d5c6fc6d79c3ee3c197684** — 8 security проверок подмены signed fingerprint при действительной подписи, перестановки оригинальных PNG, JPEG и повреждённых источников; также явная граница доверия SVG/physical mm.
7. **178f7b6c4dadce653c4436d07b5c87a72ba00508**, **8e8da9b27ebc6d07e6d514e46762ada5a67b929c** — интеграционные signed locked-pilot тесты переведены на настоящие искусственные PNG и пересчёт каждого fingerprint; доказано, что отсутствие PNG или подмена gradient отказывают даже при переподписанном JSON.
8. **752f96aa129e056dfc22ce46fc49faf8ebfa4545** — новые тесты и syntax подключены в GitHub Actions; CircleCI исполняет все tests/printcheck-vision-*.test.mjs автоматически. Первый прогон обнаружил ровно 1 ошибку **в тестовой фикстуре**, не в декодере: один adversarial-тест добавлял extra поле к разделяемому объекту fingerprints, загрязняя следующий testcase. GitHub Actions run 44027780474: 216 PASS / 1 FAIL.
9. **8d45d7a4176a123ef8b2be0904b107ca027241fa** — исправлен shared object test mutation через structuredClone() на каждом entry. CircleCI vision-contract снова SUCCESS, отдельная успешная GitHub Actions rules проверка.
10. **99b07c998387933ab984723fd487ce9ce5a709e9** — vision/dataset/verify-cohort-images.mjs: локальная проверка signed cohort по файлам последовательно, с lstat, запретом symlinks и byte SHA, повторным PNG-декодированием, fingerprint rebuild и полностью обезличенным stdout. Предусмотрен закрытый список файлов, упорядоченный точно как cohort.entries. Никакой передачи байтов заказа или имён в CI/GitHub.
11. **734015d41d39cc0fbc705483d8ab20653a30a780** — 8 тестов последовательного signed cohort audit, permuted files, source modification, manually altered fingerprint, invalid JPG, отсутствия файлов/symlink, cross-split family и подписи.
12. **b433c85444a1587dbbb03b7251d26c1ba2f9969a** — CLI-тесты в GitHub Actions gate. GitHub Actions [run 44028315663](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44028315663): **225/225 Node tests**, **6/6 ZIP Python**, **11/11 Python evaluation** = **242/242**, плюс отдельный signed synthetic Node→Python E2E **PASS**. CircleCI [vision-contract run 872a295f](https://app.circleci.com/workflow/872a295f-7eb8-4121-9540-507afdc63a2d/job/489d6def-f752-4310-b3c5-4586dbb16ed4) **SUCCESS**.
13. **2b0f186307ad5d391e70bc11e4420bccf8b5b395** — docs/C3B3_I_IMAGE_BYTE_PROVENANCE.md: полный private CLI операторский протокол с exact trust pin, JSON paths, ограничениями PNG и различением изначального PDF и предпросмотра.
14. **fe3cc232a0d6c1f1c5c67351f1dd26864642bf99** — VISION_COPY_README.md: краткая инструкция по исходным PNG, ручным сложным форматам и private audit. CircleCI [run 4b078072](https://app.circleci.com/workflow/4b078072-c8d3-4483-8266-928d7ac0187b/job/b9f5dae8-150c-4e0b-8982-3a67bed8ecfd) — **SUCCESS**.

### Границы приёмки
- На данном этапе криптографически и численно подтверждается целостность **конкретных PNG байтов** относительно подписанного cohort. Это не независимая проверка первичного происхождения заказа Gifts.ru: оба исходника могут быть сфабрикованы до подписи. Авторизованный источник заказа и physical mm должны подписываться отдельным аудитором по C3B.3.F.
- Strict decoder поддерживает только заданное subset PNG; JPEG/WEBP и profiled/interlaced/indexed PNG → MANUAL до внедрения единой цветоуправляемой raster pipeline. В реальных макетах таких случаев много.
- Перцептивные distance по силуэту и градиентам — эвристика для candidate near-duplicates, не доказательство, что два разных изображения идентичны или уникальны. Логотипы с произвольными поворотами/фоном/плохим разрешением всё ещё требуют экспертного аудита.
- Полный signed locked-pilot принимает in-memory cohortImageBytes; отдельный private sequential CLI позволяет проверить большой подписанный архив без удержания всех PNG одновременно в RAM. Тот же upstream file binding и privilege containment должны учитываться при реальном пилоте.
- Внешний CircleCI выполнил тесты без реальных клиентских данных. Новые public previews и production код Gifts.ru не публиковались. Путь отката — только экспериментальные коммиты и отдельные изолированные modules.

### Следующий цикл C3B.3.J
Единый доверенный rasterizer для PDF/SVG/PNG/JPEG с Color Management и доказательством origin PDF/SVG → preview, калибровка фактического размещения на изделии (mm), независимая двухэкспертная разметка на закрытом реальном пилоте и group-aware test holdout. Без этих этапов real-data precision/recall и production OK/ERROR **не заявлять**.


## C3B.3.J — подписная проверка исходного PDF/SVG → PNG → мм

Дата: **2026-11-17**. Рабочая ветка feature/printcheck-vision-copy-v01, PR #4 DRAFT / Issue #5 OPEN. Production Макетная, исходная ветка gifts-layout-workbench-mockups-source и публичные страницы не изменены.

### Проблема
Предыдущий цикл C3B.3.I независимо пересчитывал подписанные PNG fingerprints из локальных байтов и проверял train/test leakage, но ещё **не требовал** точного соответствия подписанного renderer receipt исходному PDF/SVG, PNG, доказательствам заказа и координатам мм. Достаточно было самостоятельных утверждений о масштабе. Это опасно для вывода о минимальных толщине/пробелах.

### Реализовано и опубликовано в экспериментальной ветке

1. **35cbee9e98a7afb338951a2bdf4e3049a8f6415e** — vision/dataset/render-calibration-attestation.mjs. Отдельная криптографическая Ed25519 проверка receipt со строго закреплённым SHA-256 DER SPKI доверенного ключа. Требует настоящие sourceBytes PDF/SVG, previewPngBytes, orderEvidenceBytes, signed JSON и signature. Валидирует SHA exact bytes, строгий PNG, заявленные renderer/ICC metadata, SVG root viewBox + physical units из исходника, PDF viewport/rotation/UserUnit из метаданных отчёта, 2 матрицы, >=5 контрольных точек, площади охвата, no shear/nonuniform/mirror without authorization и вписывание 4 углов страницы в физическое поле.
2. **d1ce82e522c91895306837c3d41e9c14007b7c76** — tests/printcheck-vision-render-calibration.test.mjs: 12 synthetic тестов с позитивными PDF/SVG, повреждением подписи, SHA оригиналов, подменой поля, UserUnit, rotated viewport, зеркалированием, масштабом, погрешностью контрольных точек и unsupported PNG/color.
3. **f8d809411221a6a02701977fab32bd13e1f62743** — Node/GitHub Actions gates обновлены; baseline CircleCI [vision-contract 1195a6ee](https://app.circleci.com/workflow/1195a6ee-8e95-4570-be2c-3a098d66bebe/job/37313010-cbac-4a05-a3a1-1e8cc958fa5c) SUCCESS.
4. **d286e348d37846e892ece11873860b1a8b74acc5** — vision/dataset/locked-pilot-gate.mjs: новый обязательный renderCalibrationInput; он не должен ссылаться на другие source/preview/order байты, чем подписанный pilotInput. Отсутствует подписной receipt или получены чужие байты — MANUAL/evaluation_allowed=false.
5. **534adead4b0c114e637c136afc4ae4b28a4faa61** — изменён интеграционный fixture tests/printcheck-vision-locked-pilot.test.mjs, добавлена третья Ed25519 подпись renderer-аудитора и 3 отрицательных теста на отсутствующий receipt, иной PNG и неверную подпись. После commit GitHub Actions [rules 44030661190](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44030661190) SUCCESS; UI smoke [44030661208](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44030661208) SUCCESS. CircleCI [vision-contract 3f55edad](https://app.circleci.com/workflow/3f55edad-a729-4af2-a35b-e5c37d3fe23c/job/8ded45dc-81d4-4770-bb7e-a05873222169) SUCCESS.
6. **dd11d35b7b5bb793f181eaa33c76be799d36300b** — vision/dataset/verify-render-files.mjs: локальный private CLI для 6 источников без сетевых запросов, с запретом symlink, ограничениями размеров и redacted stdout/stderr.
7. **a3fbd90b492e392d3d0d71a79591055189900011** — tests/printcheck-vision-render-files.test.mjs: 5 E2E тестов локальных файлов, подписи, изменённого order evidence, неверного pin, symlink, отсутствующих и больших файлов; секретные пути не попадают в stdout.
8. **57a9c15de3be561c79d8d8c1c9f9512cb6811822** — новый CLI зарегистрирован в тестовом GH workflow; [rules 44030835058](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44030835058) SUCCESS, **245/245 JavaScript tests + 6/6 ZIP Python + 11/11 Python evaluation = 262/262**, также синтетический signed Node→Python pilot PASS. [UI smoke 44030835054](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44030835054) SUCCESS. Резервный [CircleCI vision-contract 4e775485](https://app.circleci.com/workflow/4e775485-c601-408b-bbd2-e593235bad04/job/364f892e-8d6e-4ff4-af38-91bd96f65e51) SUCCESS.
9. **0215edd80116c7d1ccb492ba7c195562dd349921** — operator manual docs/C3B3_J_RENDER_CALIBRATION.md с требованиями источника, криптографической подписью, геометрическими допусками и строгой границей color management.
10. **e9c356d48b1a8f63bf1340fadd154c13822114cf** — VISION_COPY_README.md расширен указанием подписной цепочки source/PNG/field mm.

### Вывод и границы безопасности

Успех новой функции называется SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY, не «полностью доказанный рендер». Код не реализует independent rasterizer/PDF painter, не парсит полный PDF page dictionary и не удостоверяет полномочия сервиса Gifts.ru; поэтому поля print_scale_proven, visual_render_equivalence_proven, gifts_order_evidence_authenticity_proven, production_approved ВСЕГДА false. Заявленный ICC/CMYK/spot profile digest подписан, но настоящая цветовая конверсия и декомпозиция спотов не проверяются.

Необходимо сохранить fail-closed поведение на PDF transparency, сложных SVG/CSS, профилированных PNG, неизвестных координатах полей, реальных заказах без независимых evidence; не заявлять production OK или real-data precision/recall.

### Источники алгоритма

- W3C SVG2 viewport/viewBox: https://www.w3.org/TR/SVG/coords.html
- W3C PNG 3 color spaces: https://www.w3.org/TR/png-3/
- Mozilla PDF.js viewport and page rotation: https://mozilla.github.io/pdf.js/examples/
- PDF Reference 1.7 CropBox/UserUnit: https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.7old.pdf

### Следующая задача C3B.3.K

Настоящий независимо закреплённый offline renderer (MuPDF/PDF.js/Resvg) с повторным рендером и pixel-domain comparison; независимое ICC (LittleCMS) / DeviceCMYK/spot-проверка и доверенная авторизованная привязка геометрии к заказу. Затем закрытый пилот двух технологов на реальных макетах без перемешивания семей исходников между train/test. GitHub PR #4 оставить черновым; Issue #5 открытым.


## C3B.3.K — независимый реальный PDF/SVG рендер, точное RGBA, закрытая research приёмка

Дата 2026-11-17. Изолированная ветка feature/printcheck-vision-copy-v01, PR #4 DRAFT, Issue #5 OPEN. Производственная «Макетная» и исходная ветка gifts-layout-workbench-mockups-source НЕ менялись. Реальные клиентские файлы, приватные подписи, рецензии и seed НЕ передавались в публичный GitHub/CircleCI.
### Цель, реальная проблема, поисковые решения
- C3B.3.J подписывал original/PNG/order/mm, но не доказывал, что содержимое PNG получено именно из векторного исходника. Самоутверждённый отчёт мог связать любой PDF с произвольным PNG.
- Рассмотрены Rust/resvg-js 2.6.2 (MPL-2.0), Mozilla pdfjs-dist 6.5.438 (Apache-2.0), Skia @napi-rs/canvas 1.0.9 (MIT). Не выбран MuPDF AGPL, чтобы без обсуждения не вносить лицензионные обязательства в репозиторий. Пакеты живут исключительно в экспериментальном подпроекте.
- PDF.js нормализует CMYK в RGB при построении operator list; одного проверки уже интерпретированного цвета нельзя считать достоверным распознаванием печатной краски. Во время CI этот сценарий действительно прошёл исходный фильтр и был исправлен строгим raw-stream барьером.

### Реализовано
1. **065f2fd9a32d279560773cb3eb9d1379a9ade6d8** — vision/dataset/exact-pixel-replay.mjs: точное byte-by-byte RGBA, включая alpha, no implicit tolerance, ограничение 12Mpx, число отличий и максимальная delta, всегда no production/color approval. **484f580a9510249f7ab912cd8c17b83c5e0b1017** — 5 unit tests.
2. **d1344d50702c6df2bc877bd5a537984abbcfc360** — vision/raster/replay-engines.mjs: реальный Rust Resvg без внешних SVG-ресурсов, no fonts/style/image/use; реальный PDF.js+@napi-rs/canvas с проверкой metadata page.view/rotate/userUnit, минимальным допустимым набором fill ops, без размытых PDF pixel claims. **254edce8a5dcf61f1b5615ac63e25b64ec9d4770** — vision/raster/package.json версии pinned.
3. **0d059a2a3b6f4f302874d66e9934a7a98cece158** — vision/raster/verify-independent-replay.mjs: заново требует старую Ed25519 signed source/preview/order/mm, strict decodes PNG, рендерит самостоятельно, сравнивает полный RGBA. Только EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY, если все пиксели равны и поддерживаемый RGB subset. ICC/spot/physical print scale всегда false.
4. **0e9778b4bc68be07156b587e523de49488c9b114** — vision/dataset/locked-pilot-gate.mjs: legacy sync verifyLockedPilot перестал разрешать research metrics (PENDING_RASTER_REPLAY, evaluation_allowed=false); async verifyLockedPilotWithReplay делает полную signed crosscheck/blind controls и ACTUAL rerender до возможного evaluation_allowed=true только RESEARCH. **b0f0db1a2c349b7c715651057a57036a1790a227** — синхронные тесты актуализированы.
5. **e138ab4a342c9c1e8fb12f5b43f20ee4c1c50f5a** — детерминированный корректный PDF xref-test-fixture. **33de723a5b17cbac7aa480715ff4e0b1ce6b0dd1** — настоящие интеграционные тесты независимых resvg/PDF.js/Skia движков, изменённый PNG при валидной переподписи, PDF UserUnit/page-box, SVG external refs, invalid ICC, CMYK. **992e2d2277d11e45813a4ce4d24aa0e956475137** — сквозной тест всех 3 независимых Ed25519 подписей, слепого cohort и живого Rust resvg до research-gate.
6. **08a6797ba3e2fe87349ebd5cb10a9603e25ca42f** — отдельный CircleCI vision-raster job. **845b71275cf1da1445e450b22fedd56fc2796ca8** — чистые быстрые контрактные GitHub тесты. **64b5759f82afe30d8dad77cf2661595ea815c1a8** / **eb2f5752efc618e40ee1239d49ad94389f140774** — временная GitHub raster job для технических логов.
7. **86ff15b965b9238ca7a0397f25b22630b8747f02** — исправлена реальная PDF.js 6.5 несовместимость: CanvasFactory.getNoAlphaContext, обнаруженная failure CI. После исправления PDFJS действительно отрендерил тестовый PDF, но CMYK test выявил, что нормализованная RGB операторная семантика не показывает источник CMYK.
8. **954489da73e096e68a7d69364d5103f6587183e5** — добавлен checkReplayPdfRgbSubset по НЕРАСКОДИРОВАННЫМ raw bytes. Автоматическая проверка PDF сознательно допускает лишь один uncompressed ASCII stream, одну чёрную DeviceRGB прямоугольную заливку; любой CMYK, DeviceN/Separation, ICC, masks, image/fonts, compressed/multiple streams — MANUAL. **9013ba932f34616c58221360d10689cf4fdac4b9** — тест CMYK исправлен на раннюю причину отказа. **5d7c83b0f12a6a4f7ab67b42b6c40d5ceac61955** — 5 дополнительных негативных raw PDF tests.
9. **89e9af8e0fe3538950aa788257d27b3e9437301d** — приватный CLI source→rerender→RGBA без сетевых запросов, с lstat и защитой от symlink, без customer path/SHA stdout. **2399524a23125249cea31c8880e3184cf1e8e008** — тест реального CLI на PNG/SVG/symlink/отсутствие утечек.
10. **3d508e2408b0c09d34de2c4b20c0a8d8b5d7b8b4**, **9ce27b92b038c2b15168827cc719ace5c6b90695**, **4001f3e6e5e8be01a3f758b0d6bdb6e2832bceab** — все новые интеграционные тесты gated в CircleCI и GitHub Actions.
11. **aa5891bfba092ceb7770e296fe331dca5682ffaa** — сохранён полный npm package-lock v3, реально полученный из зелёного runner, включая 39 pinned packages. **e03f125c6871b3642e6e48516a6ffb00c8eb9b90**, **dc1938d5a4bdd3fb6f299f61d7cfe88dd98028a0**, **cde3bf438a4954b7e936076948087c399002502e** — CircleCI/GitHub переведены на воспроизводимый npm ci; дублирующее GH диагностическое задание удалено, оставлена одна отдельная raster workflow.
12. **15c4f812f7bdc8b0019330e65e6eee579a432684** — docs/C3B3_K_INDEPENDENT_RASTER.md, полный протокол, лицензии и строгие границы доверия. **0d0f21d57cac56e017140e5a3a57dc4b25645108** — краткий README.

### Проверяемые результаты на этапе K
- GitHub Actions rules **255/255 JS + 6/6 ZIP Python + 11/11 eval Python = 272/272**; отдельный synthetic signed Node→Python E2E прошёл.
- Отдельные реальные raster tests: **8/8** (actual resvg, actual PDF.js+Skia, CRC PNG, real CLI, CMYK и ICC negatives), ещё **3/3** signed frozen cohort + expert + exact SVG resvg end-to-end.
- Итог на сохранённом lock: CircleCI [vision-raster](https://app.circleci.com/workflow/6635f7b0-6757-480c-9778-f11ba6b5048f/job/3ae1901a-2e47-494c-b8c4-dd2e7d9789ba) SUCCESS и [vision-contract](https://app.circleci.com/workflow/a0872340-637a-4569-9368-4b51d9246cf1/job/bf9cbf10-d38a-429c-a8c4-d70f5983adc8) SUCCESS. GitHub Actions independent raster PR 44037393027 SUCCESS, rules 44037393026 SUCCESS.
- До исправлений CI дважды реально обнаруживал несовместимость CanvasFactory и потенциальный **ложный CMYK approval**. Исправления не основаны на ослаблении численных допусков и защищены новыми тестами.

### Не завершено и строгие инварианты
- Это НЕ полноценный PDF renderer в смысле поддержки всех PDF-разновидностей: хотя PDF.js действительно запускается, *автоматический выбор допустимых документов* сведен к единственной несложной uncompressed DeviceRGB-заливке, остальные MANUAL.
- Нет independent ICC conversion / ΔE, CMYK+spot mapping, proofing, проверенного порядка красок, масштабирования документа в реальном заказе Gifts.ru, двух подписанных реальных независимых экспертных выборок и оценки real-data recall/false positives. Никаких production OK/ERROR, все связанные с цветом и физической печатью флаги false.
- SVG renderer ограничен однотонными inline <path/> без внешнего ресурса. Не поддерживаются CSS/clip/fonts/images/masks и неопределённые профили.
- Для опасных исходных PDF/ SVG запускать вне клиентской среды: OS sandbox, ограничения времени/CPU/RAM, без сетевого доступа. Локальный инструмент сам по себе не заменяет OS isolation.
- Все изменения только в экспериментальной ветке, отдельный подпроект vision/raster. Никаких production UI/макетов не изменено; PR #4 draft и Issue #5 открыты.

### Следующая задача C3B.3.L
Расширить исходный PDF color-space analyzer с настоящей проверкой operators/ColorSpace, не теряя CMYK при нормализации; внедрить в отдельном изолированном worker проверяемый ICC/LittleCMS ΔE и полноценный closed-source provenance документа заказа, затем провести real-data blinded pilot; не увеличивать перечень автоматически допускаемых PDF без отрицательных тестов.

## C3B.3.L1 — PDF raw-source gate: escaping, revisions, stream binding

Дата: 2026-11-17. Ветка `feature/printcheck-vision-copy-v01`. Основа — C3B.3.K, PR #4 остаётся DRAFT, Issue #5 остаётся OPEN. Изменения не касаются рабочей «Макетной» или публикации клиентских изображений.

### Изменение

1. `a974d828ba4dee42cdf6951a38461ae77c9e4502` — до запуска PDF.js/raw RGB subset запрещены PDF-имена с `#XX`-экранированием. Это закрывает обход простого текстового поиска запрещённых /ColorSpace, /DeviceCMYK, /ExtGState и других структур за счёт разрешённого в синтаксисе PDF кодирования имён.
2. PDF с неоднозначными `xref` / `startxref` / `%%EOF` (включая incremental update), с неизвестными ресурсами страницы, неединственной page-структурой или противоречивой `/Length` stream теперь `MANUAL`. Проверка фокусируется на честном отказе, а не восстановлении сложного PDF.
3. `4d1c0042ae347a52a9e54de098d015cd07fa4d25` — 3 синтетических регрессионных теста: маскированные цветовые имена, разные ревизии PDF, изменённый stream length и неожиданный page resource.

### Статус и пределы доверия

Этот малый защитный этап НЕ является полным PDF lexer/parser, независимым ICC/LittleCMS, DeviceCMYK→RGB преобразованием или выделением spot-форм. Даже одобренный K-subset остаётся только узким независимым RGBA rerender для ИССЛЕДОВАНИЙ. Нельзя заявлять доказанный источник заказа, подлинный ICC, color ΔE, реальные нормы печати или production OK. Следующий шаг L2: настоящая лексическая декомпозиция операторов и ColorSpace по байтам с сохранением исходной CMYK/spot-семантики, в строго изолированном worker; без расширения автодопусков, пока нет позитивных и негативных синтетических тестов.

CI: проверка новых commit SHA выполняется автоматически; результаты фиксировать отдельно только по фактическим run URL, не выводить PASS из одного факта публикации коммитов.


## C3B.3.L2–M3 — исходные цвета PDF, действующий нейросетевой сканер, Worker и экспорт

Дата 2026-11-17. Все исходники только на \`feature/printcheck-vision-copy-v01\`. PR #4 **DRAFT**, Issue #5 OPEN. Никакие производственные модули (Maketnaya, PrintCheck PDF, Editor, Mockups) не были изменены или объединены с PR #4.

### L2: Diagnostic original PDF source color spaces
- \`c8d33219\` — \`vision/raster/pdf-source-color-audit.mjs\`, безопасный ограниченный разбор original PDF ASCII content operators до PDF.js RGB conversion. Обнаруживает DeviceRGB/Gray/CMYK и именованные цветовые пространства. PDF \`#20\`-escaped names, комментарии и числовые operands. Неопределённые конструкции требуют MANUAL. Диагностический результат не есть печатное approval.
- \`d15eacaf\` — отдельные 6 Node regression tests. Первые CI failures выявили ошибочный запрет корректного PDF \`#20\` в имени и некорректную синтетическую no-paint fixture. Исправлено \`e1cc21de\`, \`7f7ae529\`. Инвариант source_structure_verified=false, production_approved=false сохраняется.
- \`3d77dcc\`, \`78133afe\` — CI test discovery включён в CircleCI и GitHub rules.

### M0: настоящий небольшой neural inference, synthetic-only
- Обучена компактная 8→12→1 tanh/sigmoid MLP на синтетических патчах 9×9. Frozen weights: \`vision/ai/synthetic-feature-model.mjs\`, commit \`17626ac0\`. Синтетический 3000-patch validation accuracy 0.99733, precision threshold .75 0.99921, recall 0.99219. **НЕ переносить на реальные изображения!** Нормативная годность, физические размеры и real precision/recall не доказаны.
- \`168662ee\` — отдельный \`vision-ai.html\`: локальная загрузка PNG/JPEG/WEBP, сегментация по alpha/color picker, 9×9 neural patch scan, overlay red/yellow, отказ MANUAL при плохой маске, JSON координат и обязательные поля production_approved=false. До 700×700 px, 20 MB; не проверяет полноту векторного PDF.
- \`076b9123\` — unit tests synthetic line, tiny gap, thick circle, arbitrary ink color, invalid raster. \`5684c6b6\` — actual Chromium desktop/mobile E2E.
- \`facba09c\` — ссылка с экспериментальной стартовой страницы; \`b4bdbe25\` и последующие — безопасная отдельная публикация.

### M1: отдельный Worker и интеграция с панелью
- \`60770111\` — \`vision/ai/scan-worker.mjs\` с bounded image contract, без прямого чтения заказа, сетевых операций или передачи cookies.
- \`da41ed86\` — parity/memory/no-image-echo Node tests; \`8c43158d\` — Worker, отмена stale jobs и 15 s timeout в браузере; \`093f5aff\` — Chromium worker integration.
- \`c7c8cccc\` — кнопка запуска отдельного AI-анализатора в Vision-панели, открывает новый origin строго по пользовательскому клику, **без передачи изображений**; основная Макетная не меняется.
- \`c56158f9\` — исправлен тест реальной same-origin srcdoc capability, вместо неверного \`about:srcdoc location.origin\`. Отдельно добавлена UTF-8 charset в mocked JS response \`0e36800e\`. Реальный launcher не ослаблялся.
- GitHub [publish 44044957182](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44044957182) SUCCESS: валидный Worker, Playwright AI и bookmarklet, изолированная публикация в main.

### M2: локальный annotated PNG и успешная публикация
- \`4a780aa8\` — PNG с наложением результатов, только браузерный download, без сети; \`43d5d61b\` — полноценный Playwright test скачанного PNG и JSON без raw RGBA.
- GitHub [publish 44045300377](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44045300377) **SUCCESS**: 2 Worker unit tests, 6 synthetic MLP tests, реальное Chromium desktop/mobile AI inference, PNG/JSON download, bookmarklet same-origin PASS; main only \`gifts-layout-workbench-vision/\` обновлён до preview commit \`8f1a3fb\`. CI [rules 44045069047](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44045069047) 272/272 Node, 6/6 ZIP Python, 11/11 evaluation Python, synthetic signed pilot PASS. Растровый replay engine не расширялся.
- Прямая ссылка на экспериментальный анализатор: https://tohaa28.github.io/gifts-layout-workbench-vision/vision-ai.html . Проверено наличие файла и Worker на GitHub Pages исходной ветке \`main\`. Актуальная загрузка конечным пользователем зависит от кэша GitHub Pages.

### M3: следующий training cycle начат
- \`ccb97572\` — отдельный \`vision/ai/train_synthetic_reference.py\` с синтетической генерацией, 8→12→1 PyTorch training/validation и экспортом NEW UNAPPROVED checkpoint. Локальный прототип запущен: holdout 3000, accuracy_0_5 0.99667, precision_0_75 1.0, recall_0_75 0.99219 (только на синтетике). Файл не подключён к production и не заменяет M0 без независимой оценки.
- Дальше: signed expert ROI dataset от двух технологов на реальных разрешённых макетах, исключить family leakage, выверить mm/placement/ICC/spot и потребовать независимую quality gate. Держать PR #4 в DRAFT до завершения real-data QA. Скриншоты, оригиналы заказов и приватные ключи не коммитить.

Граница доверия: эта работа даёт **работающий исследовательский neural inference**, но НЕ обученную на реальных заказах и НЕ производственно утверждённую нейросетевую систему. Любое пустое сканирование не является признаком годности. Пользовательский отчёт — candidates only.


## C3B.3.N — vector-first SVG research (2026-11-17)

**User priority**: print artwork is mainly vector SVG/PDF; raster is supported but secondary. Therefore do NOT downsample vector art to 700 px for physical thickness/gap measurements. Geometric candidates must be computed from source paths and transformations in document mm; only then may an optional raster ML complement the result. This rule must survive every following task/automation.

**Committed to isolated branch only:**
- \`8f56de23\`: \`vision/geometry/svg-local-vector.mjs\`, strictly validated local SVG XML -> existing SVG tree/Bezier/arc corridor analysis, document-mm candidate report. Identity document→mm transform is a diagnostic assumption, **not authenticated placement into the actual order**. Unsupported SVG components refuse as MANUAL.
- \`cf2b0207\`: \`vision-vector.html\` with local SVG input, demo, vector Path2D preview, list of local thickness/gap candidates and two downloads: a JSON report with NO raw path bytes and an annotated SVG copy that DOES contain original vector geometry.
- \`68dbb0e7\`: actual Chromium desktop/mobile regression test, 0.12 mm synthetic vector gap, image-free report, editable SVG output, script/DOCTYPE/external-image/stroke/CSS/font hard-refusals, zero external network requests.
- \`f1ef2f63\`, \`3df0c3a8\`, \`9729a516\`: landing and Vision panel navigation prioritizes vector-first; raster MLP remains accessible separately.
- \`2686ee4c\`: experimental-only preview workflow copies all required geometry modules and runs new browser test.
- \`c1169375\`: \`docs/C3B3_N_VECTOR_FIRST.md\` full scope, trust boundary and next PDF/multicolor tasks.
- Initial publish run [44047761975](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44047761975) discovered that a URL-blocking preflight rejected the *mandatory* SVG \`http://www.w3.org/2000/svg\` namespace URI. Not a renderer issue, but incorrect allowlist preflight.
- \`2b6a3edd\`: permit only the exact canonical XML namespace attribute while preserving refusal of any other external URL; \`a3e65488\`: browser smoke now reports exact MANUAL reason rather than timing out. Re-evaluate latest CI; do not claim PASS until an actual successful workflow is seen.

**Safety**: No customer art, order files, confidential keys or learning labels stored in public repository. The full real SVG2 and multi-color PDF are NOT supported; complex constructs and untrusted placement → MANUAL. All print_scale_proven/production_approved remain false, and a list without candidates means nothing about print suitability.

**Next N2/P1**: verified per-color SVG geometry without silently combining inks; independent robust PDF vector extraction including actual multi-paint operators/ColorSpace/CTM and signed order-scale evidence; then blind real-data expert acceptance. Release PR #4 only after full QA.


## C3B.3.N2 — safe disjoint colors, published SVG-first inspector (2026-11-17)

**Actual browser-verified publish**: [GitHub Actions 44048194153](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44048194153) SUCCESS for first source-vector SVG inspector after fixing standard namespace filtering. Chromium desktop/mobile: exact 0.12 mm local gap, annotated SVG download, JSON without path bytes, no external requests, synthetic session/bookmarklet passed. HTML and 6 geometry modules published only under \`main/gifts-layout-workbench-vision/\`. The initial failed run was [44047761975](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44047761975); \`2b6a3edd\` corrected overly broad URI guard, \`a3e65488\` made test reason visible.

**N2 independent inking**:
- \`1cdf4f3a\` — \`vision/geometry/svg-ink-forms.mjs\`: bounded, independent geometric analysis of ≤8 different \`#RRGGBB\` fills only if *all different-color path AABBs are strictly disjoint*. For each ink clone the validated XML tree, select its source paths, and run the known SVG geometry bridge. Never merge different colors in one evenodd fill or infer actual spot/CMYK separation from RGB.
- \`ce0e3939\` — \`svg-local-vector.mjs\` extends only the exact former multi-ink rejection branch, preserving unsupported-feature refusal and returning source RGB per candidate, group summary and \`inks_verified_as_print_spots:false\`.
- \`1f1c2424\`, \`47b920ed\` — true Chromium tests assert two different disjoint inks remain independent and overlapping different-color paths => MANUAL, alongside the original thin line/gap and SVG injection/security tests.
- \`36b4f1e6\` — publication/test workflow copies/validates new module; \`8283c11b\` — interface shows color provenance clearly without treating RGB as printing spot.
- [GitHub Actions 44048792512](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44048792512) **SUCCESS**: vector+AI browser desktop/mobile smoke and session launcher passed; commit \`c6e879a\` published to isolated GitHub Pages folder, new \`svg-ink-forms.mjs\` and updated \`vision-vector.html\` verified in main.
- Earlier N2 job failure [44048608420](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44048608420) was because newly imported helper was absent from the old browser test routing. The standalone browser harness and publish workflow were updated before the green run; no test thresholds were weakened.

**No production approval.** Physically authenticated placement is unknown; multi-color overlaps, overprint/knockout, strokes, fonts, external effects and most complex SVG/PDF require MANUAL. Synthetic raster MLP is a separate, secondary path. Real vector PDFs need verified complete paint-operator coverage and source ColorSpace before geometry can be treated as research evidence; do not infer print fitness from a PDF.js image.

**Next vector-first stage P1**: actual PDF object/page/paint interpretation with original source bytes and color spaces; support verified path primitives and transforms without dropping unsupported objects, then connect evidence to order/artwork/field millimeters. Keep PR #4 DRAFT, Issue #5 OPEN until blinded real-data acceptance.


## C3B.3.O/O2 — local test orders overlay, synthetic verified and private expert dataset (2026-11-17)

**User-authorized test environment**: \`http://testgifts.local/\` with order table \`http://psk.testgifts.local/devorders?status=140\`, accessible only over their **own LAN**. User explicitly permits test artwork downloads/inspections/training. This is a temporary testing adapter and must not modify or replace original gifts.ru production Maketnaya. **The developer environment and GitHub CI cannot verify real LAN access or the actual DOM of this private site**. All tests and data used in public repo are synthetic.

### O — active per-order browser overlay
- \`76a88c77\` \`vision/orders/row-scanner.mjs\`: exact host/protocol/path guard, DOM discovery for table rows / data-order-id nodes, same-origin link selection, bounded GET with original session credentials, redirects denied, streaming cap 16MB per file, 15s timeout, max 32 files in a batch.
- SVG: reuse vector-first \`inspectLocalSvgVector\` to measure local mm candidates without rasterization. PNG/JPEG/WEBP: existing *synthetic-only* MLP on 300px proxy; real-data accuracy unknown. PDF: recognize file and force \`MANUAL: PDF_VECTOR_PAINT_PIPELINE_NOT_VERIFIED\` (no partial path approvals); CDR/EPS/AI and unsupported files also MANUAL. No production pass/fail, no modification of order status.
- \`703f38da\` \`vision/orders/overlay-entry.mjs\`: optional on-page control with a result column appended to recognized order rows and explicit row/batch scan. Expert labels kept in memory, local anonymized JSON downloadable. No server POST, telemetry, cookies export, persistent storage or original bytes in JSON. Closing overlay removes extra cells.
- \`8f0025d0\` \`vision-local-orders.html\` provides a drag-to-bookmarks launcher only for \`http://psk.testgifts.local/devorders\`; loads a single classic ESBuild bundle from isolated GitHub Pages preview. If test-site CSP blocks external script, do not bypass security; use a locally installed/approved extension or local script. Source code is public, but test orders remain local.
- \`4ccb918f\` Node safety tests: rejected off-origin/artifact spoofing, HTML login/mismatched signature, PDF refusal, bounded download; \`c3e482bc\` true Chromium synthetic same-origin browser: SVG 0.12mm, raster MLP, PDF MANUAL, off-origin link not fetched, row statuses, expert JSON, closing cleanly. \`7443b25c\` workflow creates/publishes isolated classic bundle after tests. \`2faa1f40\` entry from Vision landing.
- **CI verified** [publish 44050726019](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44050726019) SUCCESS; browser log: \`Local orders overlay: LAN origin guard, SVG vector, PDF MANUAL, raster MLP, per-row UI, expert JSON, no external fetch PASS\`. Code published only inside \`main/gifts-layout-workbench-vision/\`.
- \`1a563051\`: extensionless same-origin SVG attachment URLs can be detected by explicit \`image/svg+xml\` content type; still require full strict XML validation.
- \`526aba24\`, \`75ae4a87\`, \`9628b10b\`: **anonymous table DOM diagnostics** (counts only: tables, links, link types, rows; no original HTML, order IDs, URLs or customer text). Button \`Диагностика таблицы\` helps calibrate to the real private UI without publishing orders. [publish 44051084563](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44051084563) SUCCESS with desktop/mobile browser.
- \`1b926cc9\`: full local setup and threat model \`docs/C3B3_O_LAN_ORDERS.md\`.

### O2 — explicitly downloadable local test training source ZIP
- \`b3941317\`: extraction of the same restricted same-origin byte fetching contract for both inspection and local-only export; no extra domains allowed.
- \`ac6c7bd3\`: \`vision/orders/local-training-zip.mjs\`, pure JS ZIP store/CRC32 with anonymous \`samples/0001.ext\` names and manifest; 16 labeled files max, 4MB each, 24MB total, no order URLs or order IDs in archive manifest; optional source SHA256 only if browser WebCrypto available. **The ZIP does contain real test artwork and is downloaded only to the user's own device after explicit click and browser confirmation.**
- \`19a1189f\`: overlay button \`Локальные примеры ZIP\` enabled after expert row labels, no automatic upload or training.
- \`749a4f61\`: Node ZIP writer/guard tests; \`cfaeb47c\`: Chromium synthetic ZIP export with user-confirmed dialog, verifies only the labeled source SVG re-fetched, original SVG included, no external network, \`training_ready:false\`; \`2d86cc4e\`: workflow runs archive safety checks.
- **CI verified** [publish 44051709907](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44051709907) SUCCESS: all ZIP test suites + browser SVG/PDF/raster/ZIP smoke and bookmarklet.
- \`7acaf813\`: additional independent Python stdlib ZIP decoder verification: [publish 44052018776](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44052018776) **SUCCESS**. Logs confirm independent stdlib ZIP decode, local test orders Chromium smoke and same-origin bookmarklet; preview deployed only to the isolated GitHub Pages folder.
- \`ab844ca2\`, \`f920c322\`, \`4896b287\`: installer, O2 contract and README extended. Sources only in experimental branch + the separately published isolated preview folder; PR #4 remains DRAFT.

### Mandatory next steps
1. **Actual browser validation inside the user's LAN** at \`psk.testgifts.local\` by running the bookmarklet. A synthetic test cannot prove real row structure, authentication, CORS, that attachments live on same origin or CSP. If necessary use anonymous \`Диагностика таблицы\` to update DOM adapter; never copy actual customer HTML or files to public GitHub. Remote cloud environment has no proven LAN route.
2. **Vector PDF P1**: extract all source path/CTM/ColorSpace and printed forms, do not accept incomplete vector traversal or PDF.js-converted RGB as original spot proof. Unknown operations -> MANUAL.3. **Real training**: ZIP is only locally collected **source files plus coarse row labels**, with explicit \`training_ready:false\`. Add private local ROI geometry annotations and print requirements, signed source provenance, SHA256 when available, source-family-separated holdout and independent reviewer labels before any ML training/evaluation. No synthetic-score claim on real data and no automatic hidden model update.
4. Local-only result storage in test orders requires a verified test API and explicit permission. Current code does not write into local server database; statuses are temporary DOM decorations and downloaded local files only.

Do not merge experimental PR #4 or deploy production checking logic based on these synthetic results.


## C3B.3.P — order-card-first LAN adapter and offline Windows D lab (2026-11-17)

**User correction and priority**: \`psk.testgifts.local/devorders?status=140\` table rows link to **order detail pages**, not directly to artwork attachments. Exact trusted Maketnaya code \`direct-mode.js\` confirms \`GET /private/order/{orderNumber}\` → \`#j_cart_host[data-orderid]\` (or \`.cart-order\` / \`.j_add_maket\`) → \`GET /ajax/gifts/order?action=makets_popup&oid={internalId}\` (JSON \`html\`) → \`a[data-maket=true]\` \`/cart/act/mda?oid=...&id=...\` (customer originals). \`/drawing?action=getOrderItemPdf&orderitemid=...\` is a constructor/reference, **not training artwork**; must not conflate.

- \`f7624899\`, \`97ec7a3f\` — \`vision/orders/order-page-discovery.mjs\`: read-only LAN order navigation; only explicitly approved test hosts \`psk.testgifts.local\` and \`testgifts.local\`; static href/data-href/onclick and unambiguous numeric order ID, no click simulation, GET order + popup, verify matching internal \`oid\` and attachment \`id\`, discriminate constructors, no production requests, no uploads/deletes, CORS/auth refusal.
- \`166949c8\` — preserve actual \`filename\` from popup so \`/cart/act/mda\` files without URL extension can still be recognized as SVG/PDF/bitmap.
- \`8308cf72\` — Vision row overlay prioritizes the actual order detail, attaches source artwork candidate results to the corresponding table row, shows count of customer uploads versus reference constructors, leaves full-artwork PASS unproven and never changes source order status.
- \`e11877dd\` — explicit expert ZIP collection now uses the **validated client attachments from the order detail**, not template PDFs; branch still supports legacy direct-file listings where present.
- \`f04db92b\`, \`a432b49e\` — Node and real Chromium synthetic fixtures of order page→popup→client SVG/PDF, unrelated oid rejection, reference exclusion, CORS failures. No real private LAN files entered public CI.
- \`58553cb4\`, \`0d4cbbd4\`, \`f1e93922\` — fixed legacy direct-file listing compatibility: numerical table cells only infer order targets if there is no obvious direct artwork link, including off-origin links that are not allowed to download.
- \`eb8aaf9b\`, \`8b24ebd0\` — fixed real clickable \`TR onclick\` propagation: inline Vision actions and expert labels must NEVER click through and navigate away from the order list. Regression adds explicit URL-stability assertion.
- \`2a68f964\`, \`1370f4cf\` — test found permitted cross-host second popup GET; browser mock updated to deny **that exact popup** in CORS/auth failure tests instead of falsely considering the follow-up on the authorized second test host an offsite leak.
- \`ffccc4f9\` — anonymous structural diagnostics now report how order rows navigate (href, static onclick, numeric first-cell), without storing IDs, links or HTML.
- \`0f227552\`, \`ddbbe2ed\` — \`tools/vision_local_lab.py\`: stand-alone Python 3 + SQLite + zipfile/hashlib/http.server, offline bounded import of user-confirmed locally downloaded test originals, SHA256 signature/ZIP path traversal validation, per-sample provenance, manually entered ROI labels, private read-only localhost panel, no automatic model retraining or network upload. Python imports are initially \`training_ready:false\` and not approved for training.
- \`1e5b816e\` — \`tools/install-vision-local-lab.ps1\`: a Windows **user-run** installer targeting \`D:\\VisionCheckLab\`, checks D drive and Python launcher, creates private dirs/SQLite and scripts; no remote execution or automatic launch. **The current ChatGPT environment cannot directly create files on the user's own D drive**, so present the installer ZIP and exact user execution instructions without falsely claiming installation.
- \`aa01ff62\` — \`tests/test_vision_local_lab.py\`: Python synthetic ZIP import, hash integrity, no unsafe zip paths/DTD, no auto-approved training, manual ROI, PDF parser not proven.
- \`a6f1710b\`, \`4f0fd348\` — full D drive install instructions and recovered order route contract.
- \`a8393f1d\` — GitHub Actions validates node/browser/Python, then packages the private Windows installation source as \`vision-local-lab.zip\` **containing code/docs only** under the isolated public preview path; test order files remain local. Do not claim publish until actual CI success.

**Data-quality gate:** Test order attachments may be suitable for expert ROI annotation but no real sample has been inspected from the LAN. Raw customer art and verified label evidence remain unavailable to cloud CI. A row-level assessment cannot train an object-level defect detector. Physical placement, source family holdout, independent two-expert labels and real PDF/source ink parsing must come before production acceptance.

**HARD constraints going forward:** vector-first, keep genuine source Bezier/PDF/spot geometry, never substitute low-resolution raster for original contours, preserve template/client distinction, no writes to test orders, no public art uploads, no production Maketnaya modifications; PR #4 DRAFT. Next necessary step: user-run LAN integration check and test sample import into D, then review on actual test data.


### C3B.3.P acceptance gate — green

[GitHub Actions 44055649722](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44055649722) **SUCCESS** on code commit \`1370f4cf\`:
- Source-order Browser smoke: \`Order-detail first: row -> Maketnaya internal-id/popup -> original customer files, skip constructor, CORS MANUAL, private ZIP PASS\`.
- Legacy direct-row and old Vision UI smoke PASS; SVG original geometry, synthetic raster AI, reviewer UI, session launcher PASS.
- Node order-detail + local-only security tests and Python ZIP import tests all passed.
- Independent Python stdlib ZIP round-trip passed and \`vision-local-lab.zip\` packaging independently validated.
- Publish to **only** \`main/gifts-layout-workbench-vision/\` success (commit \`000cc6b\`). GitHub contents verified public \`vision-local-lab.zip\` 11,480 bytes, \`vision-local-orders.html\` 10,068 bytes, \`vision-order-overlay.js\` 130,333 bytes. No original test files in any public artifact.
- On latest documentation HEAD \`64c798fc\`, CircleCI \`vision-raster\` and \`vision-contract\` both SUCCESS; PR #4 remains DRAFT and unmerged.
- Not real LAN acceptance: live test page, internal CORS/CSP, authenticated attachment endpoints and user's real D: drive still unverified/unavailable to current cloud environment. Never claim installed on D from CI alone. Next user action: run published installer ZIP locally on Windows, run bookmarklet on test order page, inspect anonymous structure diagnostic and import sample ZIP on D; then calibrate URL/DOM and evaluate real training suitability.


## C3B.3.Q — first anonymous live LAN table diagnostic (2026-11-17)

**Source:** User supplied \`vision-local-table-diagnostic (2).json\`, captured 2026-11-17T09:47:42.626Z, **only anonymous structural counts**. One real test order table: \`body_row_count=61\`, \`direct_row_count=62\`, 179 anchors inside table, 211 across page, 488 cells after overlay injection, \`recognized_rows=61\`, \`explicit_order_links=61\`, \`ambiguous=unresolved=0\`, \`data_order_id_elements=0\`. Seven URL/text-based candidate artwork anchors are cross-origin/unsafe and **zero** same-origin direct artwork URLs verified in table. Crucial: these seven candidates are *not evidence of customer artwork*, and no actual order-page HTTP response or artwork was supplied. Only order-card navigation is supported.

**Decision:** preserve recovered Maketnaya order detail \`/private/order/<number>\` -> internal \`data-orderid\` -> \`makets_popup\` -> validated customer \`/cart/act/mda\`; constructors \`/drawing\` are reference files, not training examples. Avoid scraping link-text matches as artwork in listings. Live LAN access for cloud CI still unproven; the attachment alone cannot establish suitability for real model training.

- \`6abea840\`: add \`maxOrdersPerClick=10\` and anonymous \`order_detail_first_required\` indication without embedding actual IDs/URLs.
- \`5e0318b7\`: overlay handles 61 entries in explicit 10-order sequential batches; separate explicit 32-download budget renewal, preserves row scan progress/expert labels, no automatic high-volume crawl.
- \`489af73d\`, \`7d6d9520\`: synthetic 61-row Chromium fixture imitates *aggregate numbers only* (61 explicit order links, 179/211 anchors, 7 off-origin candidates, 488 cells including injected overlay), exercises client SVG file load through individual orders, never requests offsite candidates or constructor PDFs, maintains page without navigation, exports anonymous JSON.
- \`cd360f85\`: existing 4-row browser coverage updated for renamed 10-order button; prior coverage was NOT suppressed.
- \`b810a22b\`: fix partial order on 32-file budget boundary. Preserve verified descriptors, candidate index and already measured results in memory; next explicit file-budget grant resumes remaining file(s), no duplicate HTTP GET and no re-opening completed popup. Report identifies \`analysis_complete\` and \`pending_file_count\` per anonymous row.
- \`a2f68512\`: enhance 61-row synthetic regression with one two-file order crossing 32-download budget: proves a partial row resumes without re-downloading already scanned SVG; all 61 rows finish with 62 assets/61 card opens.
- \`29742760\`: installer accurately describes 61 actual order links, 10-order batch, 32-file renewal, and caution to test one row before bulk scan.
- \`b447f397\`: \`docs/C3B3_Q_ANONYMOUS_LAN_DIAGNOSTIC.md\` stores only aggregated diagnostics; no user's source JSON, order ID, HTML, auth headers or original artwork committed.

**Proven CI:** [isolated preview run 44059955064](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44059955064) **SUCCESS** on \`a2f68512\`. CI log explicitly confirms \`61-order anonymous DOM fixture: 61 explicit links, 7 offsite candidates ignored, 10-order chunks, partial-file resume across 32-file renewal without duplicate GET, JSON privacy PASS\`, plus all four-row, source SVG/raster, order-card/popup and offline Windows Lab tests, independent ZIP decode and isolated Pages publication. Subsequent installer-only update is separately validated by its own preview run; never assert success until run complete.

**Next user-side validation:** Open \`http://psk.testgifts.local/devorders?status=140\`, relaunch current Vision Check bookmarklet, click **Проверить строку** once, download **Отчёт JSON** and review reason/status. If the actual authorized order page returns client artwork, label carefully, download test-only ZIP, import into local \`D:\\VisionCheckLab\`. Only with those original local files and trusted expert ROI labels can actual training suitability be assessed. No production status writes, no PR merge.


## C3B.3.M3.1 — fail-closed split/provenance gate (2026-11-17)

Initial branch HEAD before changes: `473773380cd526860bc42cef6ca06f994e675c7e`, PR #4 DRAFT/unmerged. GitHub Actions experimental UI/rules/raster workflows for this SHA completed SUCCESS; CircleCI `vision-contract` and `vision-raster` both SUCCESS. No production Maketnaya code touched.

**Small research step:** new standard-library-only `vision/ai/training_split_gate.py` checks the *structure* of a proposed local training manifest without reading, publishing, or storing any real files. Enforces nonempty train/validation/test splits; canonical SHA-256-like provenance tokens for source family, source, ROI; forbids any family/source/ROI appearing across different splits; requires explicitly attested two-expert consensus, verified physical scale and color profile for every ROI. Missing or ambiguous evidence => `MANUAL`. Even when all assertions are present, returns `RESEARCH_SPLIT_STRUCTURE_ONLY` with `production_approved:false`, `auto_deploy_allowed:false`, `real_world_accuracy_verified:false` — attestations are not independently verified by this function.

**Tests:** `tests/test_printcheck_vision_training_split.py` (synthetic-only) exercises cross-split family/source/ROI leakage, missing independent expert consensus, unknown scale/ICC, invalid provenance, empty split, privacy of output, and explicit refusal to approve a structurally clean synthetic split. Included in existing CircleCI `python -m unittest discover -s tests -p 'test_printcheck_vision_*.py' -v`. GitHub rules workflow paths updated to trigger on this test. Neither public CI nor repository contains real customer originals, annotations, hashes from actual customer artwork, credentials, or private order identifiers. This gate does NOT train a model, independently verify real expert signatures, confirm ICC transformation or calibrate physical millimetres. The existing frozen browser MLP and `train_synthetic_reference.py` are untouched; no new checkpoint is deployed.

**Next:** read CI for exact new SHA, fix only isolated code/tests if red; then consider a separate offline manifest exporter from `D:\VisionCheckLab` with independently signed expert ROI records, true family provenance, physically verified mm and ICC/spot evidence. Any unknown => MANUAL.


## C3B.3.R — ten LAN card fetch failures; MV3 isolated test-host transport (2026-11-17)

**Real user evidence**: attached anonymous \`vision-local-test-order-review.json\`
(2026-11-17T10:46:19.507Z), 61 order row links, first 10 checked,
**10/10 MANUAL ORDER_DETAIL_FETCH_OR_CORS_FAILURE**, and **0 client
artwork bytes/filenames/constructors verified**. The separate anonymous
\`vision-local-table-diagnostic (3).json\` confirms all 61 explicit
order links, 0 ambiguous, 0 same-origin direct artwork candidates,
7 unrelated cross-origin/unsafe candidates. This does **not** prove CORS:
the original code collapsed both card and popup/network/redirect errors.
Full analysis: \`docs/C3B3_R_LAN_FETCH_AND_MV3.md\`.

**Changes and tests:**

- \`4f4d8a2e\`: precise fail-closed stages \`order_card\` and \`popup\`
  with anonymous origin relation, HTTP status, login/timeout/type and
  generic \`cors_redirect_or_network\` category without blaming CORS
  when browser error is ambiguous; same-origin popup now matches native
  Maketnaya \`x-requested-with: XMLHttpRequest\`.
- \`5d48b2d8\`: anonymous stage/phase/reason in row UI and local JSON
  without any order IDs/URLs/response bytes.
- \`914034f5\`: aggregate allowed order target origin counts in
  \`Диагностика таблицы\` (same_origin versus other_approved_test_origin).
- \`3c5afd0c\`, \`ee861e90\`, \`0ad3ea9a\`: opt-in Chrome MV3 local
  extension, strictly two test HTTP hosts, background GET-only
  allowlist, 3MB HTML / 16MB original, 15sec timeout and chunked
  content script transport; no remote script or telemetry; code
  content script \`vision-order-overlay.js\` bundled at CI.
- \`abce8074\`, \`95db8f40\`, \`638f5b40\`: Node phase and
  security tests, source-specific CORS error regression.
- \`d4882b4a\`, \`cda5eed5\`: Windows Chrome unpacked extension
  installation instructions and visible installer link.
- \`7f700811\`, \`a5ac89d2\`: full headless Chromium persistent-context
  real MV3 background test. Simulated page-origin CORS-unfriendly
  test host redirects via background worker to order card ->
  \`makets_popup\` -> SVG original, with no external network, no
  templates downloaded, no automatic GET, anon JSON.
- **Verified green** [GitHub Actions run 44069420844](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44069420844).
  All earlier 61-order, raster/vector, ZIP/privacy and local-lab
  tests still PASS. Isolated public \`vision-local-lan-extension.zip\`
  verified on \`main/gifts-layout-workbench-vision/\` (size 42,506B).
  Production Maketnaya/branch untouched; PR #4 remains DRAFT.

**Critical remaining test**: This extension is NOT installed on
user's PC by ChatGPT. Real local test domain server authentication,
cookies/session restrictions, source-file access and actual training
sample suitability are still unverified. User needs to install the
published ZIP locally in Chrome (same profile used for LAN test
authentication), check first ONE row, return anonymous diagnostic
JSON. Only actual original client artwork + expert ROI can qualify
samples for local D lab. Do not confuse green synthetic Chromium with
real LAN end-to-end acceptance.


## C3B.3.M3.1a — malformed manifest fail-closed hardening (2026-11-17)

Pre-change PR #4 DRAFT/unmerged head `65ade5bcecb4b00c4bf0027da8734030e5041a94`. CircleCI `vision-raster` and `vision-contract` SUCCESS; GitHub Actions rules/raster SUCCESS; experimental UI smoke still IN_PROGRESS at inspection time. Existing split gate could throw TypeError when an untrusted JSON manifest supplied an array/object for `split` or `region_role` instead of a string. This is an input validation failure, not evidence of real model performance.

- `901974c`: explicitly type-check both fields before membership checks, preserving MANUAL for unknown inputs.
- `ba43a54`: synthetic regression cases for array/object values on both fields; assert MANUAL, no production approval, no auto-deploy.
- No real data, model weights, CI secrets or production Maketnaya code changed. These checks do not validate real-world scale, ICC, independent labels or model accuracy.
- CI for the new head must be checked separately; no CI pass is claimed in this entry before completion.


## C3B.3.M3.1b — contradictory ROI role gate (2026-11-17)

Pre-change draft PR #4 HEAD `900b26809bc17db49a632e0795c02b638d3dbed5`; PR remains DRAFT/unmerged. At inspection, GitHub Actions experimental UI smoke run 44082225546 was QUEUED and CircleCI vision-contract / vision-raster were PENDING. These are observations, **not** CI passes.

- `18036e9`: `vision/ai/training_split_gate.py` now rejects an identical ROI SHA labelled as both `ink` and `gap`, even within the same split. This is a fail-closed structural conflict; status `MANUAL`, reason `ROI_ROLE_CONFLICT`.
- `6508b59`: synthetic regression tests for contradictory ROI roles and same-role duplicate records; no customer data used. Same-role duplicates are permitted structurally, but do not grant production approval.
- The research gate still cannot independently establish expert identity, consent, true family provenance, physical mm, ICC/spot or real-world accuracy. A clean structure remains `RESEARCH_SPLIT_STRUCTURE_ONLY`, `production_approved:false`, `auto_deploy_allowed:false`.
- **CI status for new SHA:** not yet confirmed when this entry was authored. Follow up by checking GitHub Actions and CircleCI for final head and recording exact outcomes; do not infer success from previous runs.
- Rollback: revert only the two isolated gate/test commits. No production Maketnaya files or published model weights changed.

Next: check CI; then design an offline-only expert annotation manifest with verifiable mm/ICC provenance and independent labels. Never upload real originals, signatures, identifiers, hashes, or private files to public GitHub.

## C3B.3.M3.2 — локальная PDF-геометрия, визуальная ROI-разметка, независимая экспертиза и циклы (2026-11-17)

**Частные данные:** пользовательская анонимная диагностика от 17 ноября
показывала 61 обработанный заказ, 164 обнаруженных клиентских файла,
125 PDF-ответов, 37 HTTP 404, 2 ограничения тестового транспорта,
9 заказов без клиентских файлов. Все экспертные метки `unreviewed`.
В репозиторий не помещались оригиналы, имена файлов, заказы или токены.
Эти данные не доказывают качество AI-модели.

**Изменения в экспериментальной ветке (PR #4 остаётся DRAFT):**

- `8271128`: независимый, сохраняемый только локально SQLite-журнал
  предложений ROI, двух экспертов, конфликтов и третьего аджудикатора.
  Повторный голос одного эксперта блокируется, старые ROI не удаляются,
  все решения остаются RESEARCH_ONLY.
- `e31df6a`: тесты конфликтов, консенсуса, единиц, геометрии, приватности.
- `786ed32`: локальный опциональный PDF path audit с координатами pt,
  размерами страниц в мм, счётчиками кривых/путей/изображений/текстовых
  блоков и кандидатами номинально тонких обводок. Никакого PDF-содержимого
  или текста в JSON. PyMuPDF требует отдельной установки и учёта лицензии.
- `900b268`: синтетические тесты PDF и отказов при неверном SHA/источнике.
- `4594561`, `4b72d00`, `45edaa0`: автономный офлайн HTML-редактор SVG
  и растрового ROI, CSP без сети, подтверждение SVG-mm до генерации команды,
  Chromium-тест перетаскивания областей и защиты от неизвестного масштаба.
- `1d3378b`, `b50a4a8`: очередь Active Learning по спорным случаям,
  недостающим независимым голосам и ещё не размеченным исходникам,
  без обучения/развёртывания весов.
- `6522516`, `f329f18`: трёхкратные Python ROI/PDF регрессии и браузерная
  проверка редактора в GitHub Actions, добавление вспомогательных файлов
  в приватный для пользователя локальный установочный ZIP.
- `5b24de8`, `72b0ee7`, `0308a07`: Windows D: установщик устанавливает
  новые офлайн-модули и HTML-редактор, localhost показывает только сводные
  счётчики независимой экспертизы.

**Фактическая CI-проверка:** GitHub Actions
https://github.com/tohaa28/tohaa28.github.io/actions/runs/44083121486
на SHA `739b337` завершился success: 3×(6 тестов разметки + 3 PDF)
и Chromium ROI/mm/CSP тесты PASS, старые тесты таблицы и MV3 PASS.
Новые коммиты проходят собственный CI; статус новых коммитов следует
проверять отдельно, не переносить успех старого SHA автоматически.

**Цикличность:** существующая ежечасная автоматика Vision AI обновлена для
сверки CI, ROI-проверок, необработанных PDF и защит от фиктивного обучения.
Новая дублирующая задача не создавалась.

**Незакрытые блокеры:** 37 HTTP 404 и 2 отказа транспорта в тестовой
локальной сети; реальный разбор PDF paint/текста/ICC/spot и минимальных
просветов не верифицирован; нет независимых ROI с доказанным масштабом
и семейной контрольной выборки. Никаких обещаний auto-training, метрик
реальной точности, production OK или автоматического деплоя.

## M3.1c — ROI boolean geometry hardening (2026-11-17)

- Before change: draft PR #4 open/unmerged, HEAD `1c221253cc58013c8ac655a59e5bd866258e4a38`. Three GitHub Actions checks (UI smoke, raster safety, rules/dataset safety) and two CircleCI checks (vision-contract, vision-raster) reported success for that SHA; preview publish was not confirmed.
- Scope: only `tools/vision_roi_review.py`, `tests/test_vision_roi_review.py`, this devlog. No production Maketnaya changes, no private customer data.
- Defect: `isinstance(True, (int, float))` returns true, allowing boolean ROI x/y/width/height to be accepted as numeric geometry. Replace with exact `type(n) in (int, float)`; retain finite and positive constraints.
- Synthetic regression: test both `True` and `False` for each of four coordinate fields, assert `ROI_NONFINITE` and no cases inserted. Existing NaN, infinity, negative and zero tests remain.
- Commits: `44e521cb8c29da49a341db6807ad0a02f977bbf0` (code), `f5df2a0c749bb054acfee3935a340119f46cd1d6` (tests). CI results for new SHA must be checked independently; no claim of a passing test until confirmed.
- Pending: three independent two-reviewer/adjudicator regression cycles not yet run in this edit; preview publish not confirmed; real ROI expert agreement, calibrated physical mm, PDF color/ICC/spot, technology specification, independent family holdout and real-world accuracy remain unverified. Training/production approval stays disabled; unknown => MANUAL.


## C3B.3.M3.2a — PDF thin-candidate truncation flag (2026-11-17)

Pre-change HEAD `59bef4d405335c6b2fe0a9c51c83eb886a24b462`; PR #4 open/DRAFT/unmerged. At inspection three GitHub Actions checks (UI smoke, raster safety, rules/dataset safety) and both CircleCI statuses (vision-contract, vision-raster) were SUCCESS on that SHA. Preview publish was not confirmed.

- `88955d0`: fix optional offline `tools/vision_pdf_audit.py` summary: `thin_stroke_candidates_truncated` previously compared all stroke paths with the output cap, so 81 thick strokes incorrectly reported truncation. Now count finite, valid-bbox, positive-width strokes below the exploratory threshold; mark truncated only if more than 80 qualifying candidates exist. Zero-width hairlines remain separate and never certify printed geometry.
- `2c79b03`: add synthetic regression boundary cases for 81 thick strokes, exactly 80 thin strokes and 81 thin strokes. Assert no training/production approval. No customer PDFs, filenames, ROI labels, secrets, or model weights included.
- Existing threefold independent two-reviewer/adjudicator workflow is unchanged; not executed locally in this edit. New CI outcomes must be checked on the resulting SHA and not inferred from earlier successes.
- PDF path audit remains RESEARCH_ONLY, with no certified physical scale, gap, ICC/spot, transparency, or print process. Unknown evidence => MANUAL for production; no automatic training/deployment.
- Preview publish remains unverified. Rollback: revert only the two isolated PDF/test commits and this devlog entry.

## C3B.3.M3.2b — strict PDF rectangle coordinate types (2026-11-17)

- Pre-change experimental HEAD: `52e408c85b23526b41d71ad82471618fe2940f62`; PR #4 open/DRAFT/unmerged. Three GitHub Actions workflows and CircleCI vision-contract/vision-raster were successful for this **pre-change SHA**; preview publish was not confirmed.
- In optional offline `tools/vision_pdf_audit.py`, `rect_points` now rejects booleans, numeric strings and non-finite coordinates instead of silently coercing values with `float()`. Added synthetic rectangle and page-box fail-closed regression tests in `tests/test_vision_pdf_audit.py`.
- No customer PDFs, paths, secrets or private expert labels committed. No production files modified. New SHA CI and threefold reviewer/adjudication regression remain to be independently verified; no passing claim is made for this change until checks complete.
- Unresolved: preview publish; real independent ROI evidence, proven physical mm, ICC/spot, PDF paint/transparency, technology-specific gaps, independent family holdout and real-world accuracy. Unknown => MANUAL; training/production approval disabled.


## Vision M3.3 — контроль 404/доступа, узкие PDF-заливки и последовательный PDF-аудит (2026-11-17)

Область изменений: только `feature/printcheck-vision-copy-v01`, PR #4 DRAFT.
Никаких настоящих макетов, секретов, имён файлов и приватных URL не выгружено
в GitHub. Действующая «Макетная» и production не изменялись.

**Источники фактов:** ранее предоставленный анонимный отчёт тестовой таблицы
с 61 обработанным заказом, 164 клиентскими файлами, 125 распознанными PDF,
37 HTTP 404 и 2 сетевыми/авторизационными отказами. Цифры не означают,
что нам удалось устранить 404 или испытать настоящие PDF в GitHub CI.

- `248d7b1`, `05355d2`: после HTTP 404 модуль повторно читает *только*
  авторизованный read-only popup того же заказа. Выполняется один popup
  GET на заказ с ошибкой, а не повторное скачивание файла. Анонимная
  классификация: `STILL_LISTED_IN_POPUP`, `MISSING_FROM_POPUP`,
  `POPUP_RECHECK_UNAVAILABLE`. Ни один другой URL для оригинала не
  подбирается; auth/CORS не обходятся.
- `97c54fa`: тесты безопасного списка допущенных URL, отсутствующей
  ссылки, существующей ссылки и редактирования приватных ошибок.
- `c3b256b`, `6df0701`: фиксированные MV3 коды ошибок скачивания
  теперь показывают категории отказов авторизации, редиректов,
  сетевого подключения и отключения сервиса без копирования браузерной
  строки исключения. Реальная причина двух отказов ещё неизвестна.
- `f20811d`, `77b698e`: локальный исследовательский PDF-аудит
  дополнен узкими bounding-box заполненных векторных путей, с явным
  отрицанием эквивалентности истинной ширине линии и ограничением
  80 кандидатов на страницу. Проверены края, неверные пороги, приватность;
  нет производственного допуска, цветоделения/ICC и оценки минимального gap.
- `3fce181`, `fc19fe5`: локальный `audit_all_samples` обрабатывает
  все импортированные PDF последовательно без общей квоты на количество
  файлов, атомарно записывает приватные JSON в `reports/pdf-audits/`.
  Тест: 20 синтетических PDF из нескольких ZIP-частей, повторный запуск,
  контроль SHA-256/подмены файла, без исходного текста и путей в отчёте.
- `29f1ab0`: Windows инсталлятор создаёт `AUDIT-ALL-PDFS.cmd`.
  Установщик не скачивает PyMuPDF — библиотека является опциональной
  зависимостью с требованиями AGPL/коммерческого лицензирования.
- `ba13681`, `486345c`, `fce6146`: Chromium end-to-end тест двух
  файлов с 404, одним popup recheck и анонимным локальным JSON; новый
  тест первоначально не распознавал собственную одноячеечную фикстуру.
  Добавлена вторая ячейка согласно реальному контракту DOM-адаптера.

**CI:** синтетические JS/Python тесты, UI, raster, rules на промежуточных
SHA завершались успешно. Publication runs 44151652612 и 44151909273
завершались с ошибкой таймаута 404-browser теста из-за фикстуры.
После `fce6146` требуется дождаться и проверить новый публикационный
workflow; прежний SUCCESS не переносить автоматически.

**Следующее:** реальный анонимный JSON после обновления локального
расширения, чтобы выяснить пропавшие ссылочные id vs существующие
404, а также точные классы двух отказов. При получении приватных
PDF вне GitHub провести локальный audit-all и независимую ROI-разметку,
семейный holdout, проверку физического масштаба, spot/ICC, paint-order.
Самообучение остаётся выключенным для неподтверждённых ROI.

## M3.4 — strict PDF path fail-closed (2026-11-18)

- Experimental branch only; draft PR #4 not merged; no production or customer files touched.
- Baseline 582fcd4b966177c9b221d41caf12f1362b4da281: UI smoke, raster safety, rules/dataset safety and CircleCI vision-contract/vision-raster SUCCESS. Preview publish not confirmed.
- 44f61f0568bcb1bc767615d3f1094f0e8fdc99a8: unsupported PDF path types and malformed items return MANUAL with fixed diagnostic codes.
- 4b70347e7af3aa21bb77f63f520130b1d46b594e: synthetic regression covers invalid types, invalid items, no production approval and no private string leakage.
- New SHA CI and threefold independent ROI/adjudication regression remain unverified until independently checked. Do not infer success from baseline.
- Blockers: live anonymous 404 reference_state and MV3 network classification missing; real verified ROI/family holdout, physical mm, ICC/spot, print process and real-world AI accuracy not established. Local PDF --all must not upload inputs or source identifiers. Training and production OK remain disabled.

## M3.5 — PDF item operator allowlist (2026-11-18)

- Pre-change experimental HEAD `7f44701b29fda01e679593a8a2bb63aa13c48736`; PR #4 OPEN/DRAFT/unmerged. GitHub Actions UI smoke, raster safety and rules/dataset safety SUCCESS on this baseline SHA (runs 44168338984, 44168339055, 44168339083); CircleCI vision-contract and vision-raster SUCCESS. Preview publish for this SHA not independently confirmed.
- `a3731eb092943a5859dbd9f30bd8f0ee1925a1db`: optional offline PDF audit rejects unrecognized drawing item operators with fixed `PDF_PATH_ITEMS_UNSUPPORTED` and `MANUAL`; allowlist is `l`, `c`, `re`, `qu`. The PDF path type and item container checks remain fail-closed.
- `e3d4efb2195bed782a849e956bda31a0207253d7`: synthetic tests for unsupported operators, non-disclosure of private marker text and supported operators. No real PDFs or expert labels committed.
- Local git clone/test execution blocked by DNS resolution of github.com. These new tests have NOT been claimed to pass locally; verify new SHA in CI. Three independent ROI reviewer/adjudication cycles, batch PDF --all and Chromium 404 were not executed locally in this edit.
- Unresolved: preview publish, anonymous real 404 reference_state/MV3 category, two verified ROI votes and family holdout, physical mm, ICC/spot and PDF transparency, print process, real-world accuracy. Unknown => MANUAL; no automatic training or production OK. Production modules and PR merge untouched.
## M3.6 — private local PDF batch report directory (2026-11-18)

- Before edit: experimental PR #4 OPEN/DRAFT/unmerged, HEAD `f6e98ba2a482989062f25dddaaca73e039b447bf`. GitHub Actions UI smoke/raster safety/rules-dataset safety SUCCESS (runs 44229726828, 44229726869, 44229726923); CircleCI vision-contract/vision-raster SUCCESS. Preview publish on this SHA not confirmed.
- `a021cc0883d711c947ab9c1ac07addbb39309e09`: optional offline `tools/vision_pdf_audit.py --all` creates new `reports/pdf-audits` with POSIX owner-only mode `0700` (subject to process umask). Existing directory permissions are intentionally not modified; no network or production changes.
- `eb327364610a427c1eb25cbb94ecab1000c1f03f`: synthetic batch PDF test asserts mode `0700` on POSIX, while preserving the 20-sample sequential/atomic report checks. On Windows the POSIX mode assertion is skipped.
- Local clone and direct regression execution blocked by GitHub DNS resolution in this runtime. New HEAD CI, three independent two-reviewer/adjudicator cycles, Chromium 404, and preview publish remain to be verified; do not infer their success from the baseline.
- Still blocked: anonymous live 404 `reference_state`/MV3 failure evidence; two verified expert ROI, family holdout, certified physical scale, ICC/spot, transparency, process tolerances and real-world AI accuracy. Customer source files, filenames, private labels, source hashes and secrets were not uploaded. Unknown => MANUAL; training/production OK disabled.

## M3.7 — fail-closed permissions on existing PDF report directory (2026-11-18)

- Baseline experimental HEAD `be902d11ead9f15b85eef5077c6e1c538e6f493e`; PR #4 OPEN/DRAFT/unmerged. GitHub Actions UI smoke/raster safety/rules-dataset safety SUCCESS (runs 44230114173, 44230114201, 44230114209); CircleCI vision-contract and vision-raster SUCCESS. Preview publish on baseline SHA not confirmed.
- `07118fc14f02fcf2ac80d5ef6abb9197a52613be`: optional offline PDF `--all` returns MANUAL `REPORT_DIRECTORY_PERMISSIONS_UNSAFE` if a pre-existing reports directory permits group/other access on POSIX. No silent chmod; no reports written. Windows ACL validation remains out of scope.
- `025c2b2e8b1792cae4b08acd202478ef5cde7718`: synthetic POSIX regression verifies fail-closed status, unchanged directory mode, no reports, no production approval or training.
- New HEAD CI and three independent ROI/adjudication + Chromium 404 regressions remain unverified at publication time. Do not claim real-world accuracy or infer CI success from baseline.
- Blockers: preview publish, real anonymous 404 reference_state/MV3 category, verified two-reviewer ROI/family holdout, physical scale, ICC/spot, transparency, process tolerances, Windows report ACL assurance. Customer source files and private annotations were not published. Unknown => MANUAL; automatic training and production OK disabled.

## M3.8 — PDF report directory collision fails closed (2026-11-18)

- Pre-change experimental HEAD `ac87feb4a4bae5818631c9b0647803e234ff1b87`; PR #4 OPEN/DRAFT/unmerged. GitHub Actions rules/dataset safety 44236846844, UI smoke 44236846938, raster safety 44236846895 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on this SHA not independently confirmed.
- `8aaa9dfbdee83c38d775a4d72f1718b8d54daa26`: optional offline PDF `--all` returns fixed MANUAL `REPORT_DIRECTORY_UNAVAILABLE` if local report directory cannot be created/stat'ed or is not a directory. Filesystem exception text (possibly containing private paths) is not exposed.
- `1460e7e83a5930493369fe32824e8bf5d1bacf94`: synthetic regression creates a regular file at the report directory location; expects MANUAL, no training/production approval, no private marker leakage or alteration of existing file.
- No customer sources, private labels, source identifiers or secrets committed. New SHA CI and three independent two-reviewer/adjudication, PDF batch and Chromium 404 regressions require separate confirmation; no local pass claim. Preview publish unverified.
- Blockers: live anonymous 404 reference_state/MV3 category, verified ROI/family holdout, physical scale, ICC/spot, PDF transparency, technology tolerances, Windows ACL verification, real-world accuracy. Unknown => MANUAL. Automatic training and production OK disabled.


## M3.9 — private PDF corpus streaming stage and review-only leakage controls (2026-11-18)

- Source basis: two user-uploaded private RAR archives, inspected only in an
  isolated local workdir; **NO** PDF, archive, original filename, order ID,
  source SHA-256, grouping secret or private review CSV was committed.
  Independent offline streaming SHA-256 verification: **97/97** exact matches,
  673,198,383 bytes; 45 filename-derived families, 91 distinct content hashes,
  six duplicate hash groups (6 extra copies), five PDF sources above 16 MB;
  largest 300,971,685 bytes. File openability (133 previously profiled pages)
  does NOT establish print acceptance or a valid ROI.
- Label nuance: **3** duplicate-SHA groups have differing filename-derived
  provisional labels. Precisely 2 are error-claim/unlabeled, 1 is
  clean-claim/unlabeled and **0** are opposing error-claim/clean-claim.
  Therefore this is a *mixed preliminary naming* queue, not three
  proven conflicting expert judgements.
- `d2e946f69e96`: new offline `tools/vision_private_corpus_stage.py`.
  Streams PDF source in 1-MB chunks, limits each file to 512 MB, checks
  exact original SHA-256, byte count and PDF signature. Validates an explicitly
  private manifest and source path. Joins family clusters across identical
  hashes, creates fixed-priority review-only tasks, HMAC-pseudonymous
  sample/family/content tokens and only **candidate** blind review partitions.
  No training, no production approval or remote network calls.
- `349fb528d249`: synthetic tests for cross-family duplicate clustering,
  mixed filename labels, source privacy, >16 MB streaming, tampering,
  path traversal, symlinks, deterministic repeat and never-approved results.
- `7e98bb41872a` / `e706621cbb1f`: three repeated Python regression
  cycles in rules CI plus test and offline-tool inclusion in isolated preview
  Windows Lab ZIP. Source PDF bytes are not present in GitHub CI.
- `5d0e0da72912` / `bb6c1d08324a`: mixed SHA filename claims are
  distinguished from actually opposing clean/error claims.
- `4a295400b8e0`: private queue includes a safe source slot (A#:F####)
  for joining back to a private local manifest without exposing filenames.
- `6609fbed63ca` / `365441ba7dc7`: POSIX grouping-key permissions guard,
  synthetic test of publicly readable 32-byte key and refusal to stage.
  Windows file ACLs require independent local inspection.
- `a004531d7cfc` / `2020d07ce60c` / `5969d8edbe3e`:
  offline instructions, installer integration and Vision test landing-page note.
  `71c74ada6e34`: key permissions documented.
- CI: rules/dataset safety, raster safety and UI smoke for `365441ba7`
  have each completed SUCCESS (runs 44247715367, 44247715392,
  44247715364); the independent 3-cycle rules job 44247708203 also
  SUCCESS. Preview publication must be independently verified on final SHA;
  earlier successful preview `5969d8ed` run 44247490645 is not sufficient
  evidence for future commits.
- Next unresolved steps: direct live test-hardware ROI and technology
  association, application-template/constructor/artwork matching, expert ROI
  adjudication for all uncertain filename claims, verified physical scale,
  official process thresholds, locked family holdout and offline acceptance
  gate. Existing 16-MB browser/ZIP limit remains unchanged intentionally;
  the large-corpus stage is a separate PRIVATE local tool.
  `training_ready=false`, `training_approved_count=0` and unknown=>MANUAL.


## M3.10 — threefold synthetic private corpus regression (2026-11-18)

- Before change: PR #4 OPEN/DRAFT/unmerged; HEAD `157944c510d86b443aadceedbcdec23bea228033`. GitHub Actions UI smoke, raster safety, rules/dataset safety SUCCESS on this SHA; CircleCI vision-contract/vision-raster SUCCESS. Preview publish on this SHA not established.
- `3c49aae5531abf9cf6bad9c1dc1f24acd99b12c4`: added `tests/test_vision_private_corpus_threefold.py` with three isolated synthetic 16 MB+ streaming runs under the configured 512 MB cap; duplicate-content family coalescence, SHA mutation fail-closed, HMAC token agreement, private-output redaction, no training/production approval. This tests the 512 MB *limit setting*, not a full 512 MB fixture.
- Direct local tests unavailable: github.com DNS resolution failed in the execution container. New SHA CI is not yet verified; this is not a PASS assertion. No customer PDFs, original filenames, SHA lists, HMAC keys, ROI answers or private manifests were uploaded.
- Still blocked: real 404 reference_state/MV3 evidence, two independent verified expert ROI, real layout-to-constructor/print-method binding, verified physical mm, ICC/spot, PDF transparency, technology rules, Windows ACL and verified family holdout. Filename claims are not expert conflict labels. Unknown => MANUAL; training and production OK disabled.


## M3.11 — synthetic HMAC namespace/key-rotation regression (2026-11-18)

- Before edit PR #4 was OPEN, draft=true, merged=false; HEAD `2c1c94e5423c5a84719ff1250a724e77a0d3d340`. GitHub Actions UI smoke/raster safety/rules-dataset safety all SUCCESS on baseline (runs 44258194484, 44258194559, 44258194511); CircleCI vision-contract/vision-raster SUCCESS. Preview publish not established for baseline SHA.
- `ead1c64fab23a20990731471bf45f5c757e7e676`: three synthetic iterations assert HMAC family-token determinism with the same key, rotation with a distinct key, family/content namespace separation and absence of synthetic family identifiers or raw key hex in tokens. No customer files or keys were used.
- New HEAD CI and independent local execution are pending verification; do not treat test presence as a PASS. No production changes, PR merge, client data upload or training.
- Still blocked: anonymous real 404 reference_state/MV3 evidence, two verified independent ROI votes/adjudication, artwork-to-constructor/technology association, certified physical scale, ICC/spot/transparency, Windows ACL, verified family holdout and real-world AI accuracy. Filename-derived claims are not expert labels. Unknown => MANUAL; training_ready=false; production OK disabled.


## M3.12 — safe discovery of designer discussions by article (2026-11-18)

- Requirement: when a technical designer finds an issue in a customer's layout,
  they may open an **article-level discussion** in the order card, write an
  explanation and attach a screenshot. Unlike coarse filename-derived labels,
  this is potentially rich supervision **after** verifying which article,
  print method, specific source PDF revision and screenshot ROI were discussed.
  It may also include questions, replies, revised files and personal data.
- Investigation: existing allowed test workflow can obtain a card with a
  read-only GET `/private/order/{order}`. Current public Vision/Maketnaya
  source confirms `makets_popup` for attached artwork, **NOT** a verified
  backend discussion GET. Public product/site search has not identified
  the authenticated article conversation service. Browser tab context was
  unavailable in this execution environment. Therefore no genuine customer
  discussion, screenshot or message was fetched or read.
- `dfe61ec643c8`: passive `vision/orders/discussion-probe.mjs` recognizes
  DOM discussion/comment/chat triggers, article vs order/unresolved scopes,
  previously inlined message and screenshot candidates, and weak fixed
  technology-topic enums (positive/negative elements, field edge, colors,
  text, raster, gradients and constructor alignment). Exports counts/enums,
  never message text, author, order or article identifier, media URL or media.
- `436a6462c6d5`: `inspectOrderDiscussionFromRow` uses **one existing**
  authenticated order-card GET. Does not open the discussion modal,
  follow unknown attachment links, trigger click handlers or guess APIs.
- `81010470104a`: explicit experimental UI controls
  **«Найти обсуждения»** (ordered read-only cards) and
  **«Обсуждения JSON»** (anonymous categorical local download).
  Existing file scanning and 16 MB customer artwork guard unchanged.
- `4e7652a69089` / `74d51eff4b9e`: synthetic Node and Chromium tests:
  preloaded mock discussion text, article marker, media candidate, no
  original personal text/URL in download, no POST, no implicit file request.
- `d53bfe3a4e5a` / `aa6e4424a137`: CI validation and preview browser
  test inclusion. Initial rules/publish CI failed because a synthetic
  fixture accidentally scoped an unscoped control to an article. Fixed in
  `1ad8879ec533`; subsequent fixture selector change initially failed
  its screenshot count assertion until `b115a9ee9a6e`. Do not assert
  every intermediate failing run was green.
- `96e766244671`: icon-only/class-based discussion triggers supported.
  Duplicate <a>/<img> references count as one media candidate.
- `bfa34d6830de`: media/style/script source stripping for order card
  before detached DOMParser to avoid browser resource loads during
  passive HTML analysis. `7252dabf6339` adds synthetic stripping tests.
- `771b576cdc4c`: investigation and privacy/ROI workflow in
  `docs/VISION_ARTICLE_DISCUSSIONS_RU.md`. `9c3b46476...`:
  landing page documents the opt-in buttons.
- Evidence: rules/dataset safety, independent raster safety and UI smoke
  SUCCESS at `9c3b46476` (runs 44269355010, 44269355044 and
  44269355035). Exact final preview deployment must be checked
  separately; Chromium discussion E2E is part of the preview pipeline.
- Next: run updated isolated local extension on an authenticated test orders
  page, collect **only** anonymous `vision-local-discussion-probe.json`,
  verify the actual DOM trigger/item relation and whether messages
  are loaded in existing card HTML or exclusively from a modal.
  Only after independently confirming a safe read-only route, consider
  privacy-filtered local extraction and expert ROI attachment links.
  No real discussion extracted, no training labels approved, no model  training, no production acceptance, no PR merge. Unknown=>MANUAL.

- **M3.12 publication checkpoint:** `5061c87df107af5467c45120c233f02fbee49d56`
  completed the isolated preview workflow **SUCCESS** (run
  44270125975). The Chromium article-discussion E2E passed within that
  browser-smoke step; preceding run 44269347384 had failed only because
  the exported weak-topic order was not canonical. `5061c87d` sorts
  topics alphabetically; the corrected browser run succeeded. Published
  main-branch preview HTML confirms its discussions instructions,
  and deployed `vision-order-overlay.js` contains the probe, button
  and `vision-local-discussion-probe.json` export. Draft PR #4 still
  OPEN/unmerged; production Maketnaya source and original customer
  data unchanged. No real authorized discussion HTML has been inspected.


## M3.13 — repair canonical synthetic corpus paths (2026-11-18)

- Before change: draft PR #4 OPEN/unmerged, branch HEAD `29eeb9361762d24aadeca3d919b9bd465297acdc`. GitHub Actions UI smoke, independent raster safety, rules/dataset safety SUCCESS on that SHA; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on that SHA not established.
- Found in `tests/test_vision_private_corpus_threefold.py`: the threefold fixture used `private_originals/sample1.pdf` and `sample2.pdf`, while `validate_manifest()` only accepts canonical `private_originals/archiveN_fileNNNN.pdf`. Thus the threefold test could fail before exercising streaming, duplicate family merging, SHA mutation and privacy checks. Existing green CI alone does not prove this test was executed.
- Commit `d43bb85ea7e0aff6f372edc64f55cec9e2f8e4d2`: fixed synthetic fixture paths and mutation target; added assertions that both initial files reach `SOURCE_VERIFIED_RESEARCH_ONLY` and that the changed source is rejected as `SOURCE_SIZE_MISMATCH`. No production code, real PDF, private manifest, source filename, original SHA or HMAC key was uploaded.
- Local Python execution was not possible because git clone from github.com failed DNS resolution. New-HEAD CI must be checked independently. This change does NOT establish 512 MB fixture coverage, three independent expert ROI votes, real customer correctness or training readiness.
- Still blocked: verified layout/constructor/print-method association, physical mm, ICC/spot/transparency, two independent expert ROI reviews and adjudication, verified family holdout, anonymous real 404 reference_state/MV3, Windows ACL, preview publish on this HEAD and real-world accuracy. Candidate partitions remain unverified; unknown => MANUAL, `training_ready=false`, production OK disabled.


## M3.13 — article "Согласование макета": confirmed HTML, modal inspector, 18.11.2026

- User clarified the **real** entrypoint: article-row
  `li[data-itemid] a.j_maketadjusting`, titled «Согласование макета».
  Modal contains `#j_maketAdjustingForm` («Проблемы») plus
  `#j_maketadjusting_comments_list` («Обсуждение»).
  This corrects prior logic that excluded all approval/soglаsovanie UI:
  the native article's approval editor IS the wanted discussion source.
- Privately inspected one user-supplied **already-open saved HTML**, locally
  only. It revealed 25 **available** problem checkboxes, 0 checked
  in the saved state, 40 chronological entries composed of 13 human
  replies and 27 audit events (4 add-problem, 4 remove-problem,
  13 status changes, 6 other), plus 6 PDF and 1 PSD attachments.
  The visible 13 badge counts human comments, NOT all 40 events.
  All these are non-identifying aggregated numbers. The saved customer
  HTML, identifiers, participant names, original comments and files
  were not added to GitHub or Actions.
- Confirmed from saved page config: existing action names
  `load_maketadjusting_editor`, `load_maketadjusting_comments` and
  `download_maketadjusting_attachment`. Query parameters of the
  read-only AJAX operations have **not** been independently verified.
  Do not guess them. `save_maketadjusting` and
  `add_maketadjusting_comment` use POST and are forbidden to this probe.
- `bbb1c03caa45` / `b16cc76bfafa`:
  `vision/orders/maket-approval-probe.mjs` parses **already loaded**
  modal DOM. Separates available/currently checked problem options,
  user messages, add/remove events, status events and attachment
  categories. Exports only safe count/weak-topic enums; no source
  content, messages, filenames, authors or item IDs; never training-ready.
- `d4ed0beff059`: article `data-itemid` / exact
  `j_maketadjusting` trigger discovery added to existing
  `discussion-probe.mjs`; avatar images no longer counted as
  comment screenshots when modal is available.
- `1cbb58bcd276` / `1a13380f2591`:
  independent on-page inspector `approval-page-entry.mjs`,
  MV3 v0.1.1 on exactly `http://testgifts.local/private/order/*`.
  The designer/user manually opens the site's native modal,
  then Vision **«Прочитать открытое согласование»** and
  **«Скачать анонимный JSON»**. No GET/POST, downloads of private
  attachments, button clicks, server writes or untrusted URLs.
- `9b5df2674108`: Chromium synthetic regression recreates
  25 options, 40 timeline events, 13 human comments, 6PDF+1PSD,
  verifies a separate selected checkbox, no training, and zero
  personal-data leakage. `806151a79682` bundles new script,
  adds browser regression to isolated preview workflow and packages it
  into extension ZIP. `3e9043304efa` verifies actual MV3 injection
  on a synthetic order page, in addition to existing devorders scan.
- `a9b60052bb96` / `8b02d383ce50` / `da1383bd6098`:
  extension README, research document and preview landing page
  updated with exact workflow and data-safety limits.
- Current status: isolated preview run `44278921326` was pending
  at initial journal entry. Verify its completion before offering the
  updated ZIP as published. Other three CI suites SUCCESS on
  `3e9043304` (rules, independent raster, UI smoke).
- Unknown: actual runtime on authenticated testgifts browser; full
  text/media extraction, attachment-image ROI coordinates, matching
  discussion to historical uploaded PDF revisions, independently
  corroborated defect vs resolution. Those all remain MANUAL.
  `training_ready=false`, `production_approved=false`.
  Draft PR #4 is not merged; no production code altered.

- **M3.13 release verification:** `44278921326` / code SHA
  `3e9043304efa39d1fb0e8fd3809f60d8064c89ba` —
  isolated publication **SUCCESS**, including synthetic native-approval
  Chromium browser test and real MV3 manifest injection.
  Independently checked public `main` preview:
  `gifts-layout-workbench-vision/vision-order-approval.js` exists
  (bundle includes known native form selectors and local anonymous JSON
  export); `vision-local-lan-extension.zip` exists (58,227 bytes),
  landing HTML exists. Draft PR #4 remains unmerged; no private HTML
  or client artifacts in GitHub. Last three standard suites on
  code SHA `3e9043304` also succeeded.


## M3.14 — autonomous native approval traversal by message badge (2026-11-18)

- User request: Vision must **itself** navigate each article's native
  **«Согласование макета»** when the numeric badge is **strictly >1**
  and collect evidence. Previous M3.13 required the user to open
  each approval modal manually, which did NOT meet this requirement.
- `894a4b18ca61` introduced `vision/orders/approval-auto-scan.mjs`:
  exact selector `li[data-itemid] a.j_maketadjusting .gifts-badge`,
  single sequential click per eligible article, skip 0/1/missing
  counters, validate order-item ID `oiid` inside native modal, wait for
  HTML comments, close only matching owned modal, continue. Stop action,
  100-article limit, 16s per modal timeout, bounded private in-memory
  collection (24M chars). This is a per-**open-order-page** collector:
  no cross-order background tab orchestration has been implemented.
- `2371b6ef3e4` modified the on-page extension UI: **«Автообход
  согласований >1»**, **«Остановить обход»**,
  **«Сохранить приватные данные»**, **«Анонимный отчёт обхода»**.
  The private LOCAL JSON contains messages, checked selected problems,
  additional description, chronological add/remove events, article/order
  IDs for future local revision matching and attachment metadata
  (original name, type, local site data-id). It never automatically
  downloads attachment bytes and never sends the file to GitHub.
  The anonymized JSON exposes only fixed status enums and counts.
  Private download requires separate user consent. No print/ML approval.
- `fa2ce8b545d6`: synthetic Chromium case with badges **13,1,2**;
  only 13 and 2 may open. Checks private chronology and selected
  problem extraction, zero network mutation and no IDs/text/names
  in anonymized JSON. `3d3117abe751` adds browser regression to
  isolated CI packaging.
- `221541beb8bf` / `95693d900482`: when native modal loads only
  «Проблемы», the agent clicks **only**
  `label[for=j_ma_comments]` once (known GET-only tab) to populate
  «Обсуждение». The synthetic test requires exactly one native
  discussion-tab click for the lazy-loaded case.
- `d494fee2e291` limits per-order retained private data to
  24,000,000 characters; `d2aaddece7a3` requires 350ms stable
  history length after reaching the declared number of human comments,
  preventing a truncated audit trail.
- `f2307e0d5e5a` increments MV3 extension to v0.1.2.
  `029556bac0c6` / `c1ba60e3dedb` / `b60d0f9aa32` document
  automatic local workflow and privacy separation.
- READ-ONLY safety: only the native editor link and native comments-tab
  label may be clicked; no save/add/edit controls, no POST, no
  attachment link clicks, no unknown backend endpoints.
  Unknown/nonsensical count=>skip; comment/badge/item mismatch=>MANUAL.
  The badge is an opening filter, **not a trusted error label**.
  No source file/version, screenshot bytes or ROI is confirmed.
  Customer/private JSON MUST NOT be published or uploaded to public
  Github/CI; no customer HTML or raw test artwork committed.
- CI & distribution: v0.1.2 preview build must finish
  **successfully on the final implementation commit** before reporting
  a refreshed extension ZIP. Experiments remain on  `feature/printcheck-vision-copy-v01`, draft PR #4 not merged.
  Production Maketnaya not modified, training_ready=false.


- **M3.14 CI/release confirmation:** Release workflow
  `44281844810` **SUCCESS** for source code head
  `2cad24c7a01c9943baad18b817f46587e9f57b3d`.
  It built Chromium synthetic tests, including 13/1/2 badge
  filtering, lazy native Discussion tab, and stale hidden previous
  approval-modal regression. Main isolated preview contains the
  packaged MV3 `vision-local-lan-extension.zip` (63,718 bytes) and
  `vision-order-approval.js` (36,094 bytes) with local-only private and
  anonymous exports. Three independent CI suites (rules/dataset,
  raster safety, experimental UI smoke) also passed on head
  `2cad24c7`. Draft PR #4 remained open/unmerged.
  This is a **synthetic-browser confirmation**, NOT evidence the
  authenticated real test site has successfully processed an
  actual order yet. End-user field trial remains required.


## M3.15 — capture selected designer problems, discussion history and local attachment bytes (2026-11-18)

- User explicitly requested enabling the reading of **designer-selected
  problems, discussions and files attached to these discussions**.
  Previous M3.14 collected selected problem flags, comment text and
  attachment IDs/names but did NOT read the binary content of attachments.
- Reopened the user-supplied **private saved order HTML** locally,
  deliberately did NOT publish the source or customer details. Verified
  `OrderEmployer.config.downloadMaketAdjustingAttachmentUrl` is exactly
  `/ajax/gifts/order?action=download_maketadjusting_attachment`, that
  `OrderEmployer.config.idParam="id"`, and that each original attachment
  anchor has class `j_maketadjusting_attachment` and numeric `data-id`.
  Thus the single narrow candidate read-only route is
  `GET /ajax/gifts/order?action=download_maketadjusting_attachment&id=<id>`.
  **Actual authenticated response semantics are unverified** until
  real browser field testing; no fallback guesses are allowed.
- `90db2c946514`: for each currently checked `ma_problem[]`
  extract problem code/text **plus the associated printing technology
  and application position** from the nearest native modal `.grid`.
  Available, unchecked form options are not defects; the history of
  'Добавлены проблемы'/'Удалены проблемы' remains separate.
- `69e28a3decee` / `c4bbe29078df`:
  `vision/orders/approval-attachments.mjs` performs only exact
  same-origin authenticated GET on `http://testgifts.local`,
  checks status/redirect/URL/content-length/actual byte count,
  denies login HTML and mismatched PDF/PSD/image signatures;
  no POST or unknown endpoints. Original bytes are kept in memory
  briefly, never placed in JSON, sent to GitHub, or logged.
  Bounded by 16MB per file, 64 files/order, 12/ZIP part and
  24MB/part. Unsupported formats or larger originals => MANUAL,
  not inferred negative/positive labels.
- `246bdbd6a93a` extends the existing ZIP writer's **strict**
  allowlist to numbered `attachments/####/####.<allowed-ext>` paths,
  no arbitrary filenames or traversal in ZIP headers. Original
  filenames, article identifier, message sequence, attachment ID and
  SHA-256 **if supported in this browser's secure context** reside in
  PRIVATE per-part `manifest.json`, not public artifacts.
- `a5dfc8996776`: new complete flow in the native-order
  inspector: click **«Автообход согласований >1»**, extract all selected
  defects/text/events then sequentially read attachment bytes and
  automatically offer local
  `vision-private-approval-attachments-part-0001.zip` downloads.
  User saves `vision-private-approval-evidence.json` separately;
  **«Повторить скачивание вложений»** permits retry; anonymous
  JSON still contains only safe fixed status/counter fields.
  Browser may require permission for multiple downloads.
- `7a09c5781ba5`: approval link must refer to the
  **exact current order** on testgifts.local, never just an
  allowed hostname and a different order. Use site's own modal
  close control when exposed; fallback hides only a matching modal.
- `b7a3dbc1384` / `70b0f2c74b08`: synthetic Node safety tests
  for exact GET URL, MIME/signature, malicious paths, redirects,
  oversized bytes, login HTML and local ZIP; synthetic ZIP is
  decoded independently by Python `zipfile` in CI via
  `b56a48cf542d`.
- `0c05f595810d` / `8288cbbcaf9b`: Chromium integration
  simulation intercepts ONLY exact native attachment GET,
  confirms a private ZIP download with PDF/image payload,
  exact selected designer method and placement, and rejects a
  malicious approval link to a different order. Existing 13/1/2
  threshold and no-POST expectations retained.
- `4650546e2db2` / `7b9decea4da4` / `6f4d39fd8474`:
  documented v0.1.3 research/data protection and updated isolated
  preview landing. `9a437af10011` increments MV3 to v0.1.3.
- CURRENT LIMITATIONS: no authenticated test site session available
  inside this execution, so successful real attachment retrieval,
  content type, PDF revision mapping, screenshot ROI and final ML
  eligibility are NOT confirmed. File bytes remain local/private;
  model training is OFF, no production acceptance, no PR #4 merge.
- CI publication status **to be confirmed on final code HEAD**.


- **M3.15 release checkpoint verified:** isolated publishing run
  `44292885181` completed **SUCCESS** for code SHA
  `d63b6983321a6a45f03159716402ff266e42a925`.
  GitHub main-branch isolated preview contains the refreshed
  `gifts-layout-workbench-vision/vision-local-lan-extension.zip`
  (71,711 bytes), `vision-order-approval.js` (61,574 bytes), and
  preview landing HTML. Inspected published bundled JS and confirmed
  exact native attachment GET handling, local ZIP auto-export,
  method/placement extraction, safe anonymous GET status aggregation,
  and truncated-binary detection. Experimental MV3 manifest is v0.1.3.
  Draft PR #4 remains unmerged, production Maketnaya unchanged.
- A prior publication attempt `44291420719` and another
  `44292625827` correctly FAILED the browser integration assertion
  because the synthetic 13+2-article example associated the same
  attachment ID with **two** article discussions; the test had
  incorrectly expected one read. Corrected in
  `d63b6983321a` to preserve both article→message→attachment links
  and expect two GETs, not silently discard repeated references.
  The corrected synthetic Chromium run and Python ZIP decode are
  GREEN in `44292885181`.
- Live first-party test-server delivery of attachment binaries
  is **not** established by CI. First real on-site run should review
  `vision-anonymous-approval-collection.json` for
  `attachment_reads_by_status` and compare counts to collected
  source references. If the server requires another query contract
  or redirects to a different endpoint, remain MANUAL and inspect
  network evidence; do not guess or bypass access control.
## M3.16 — synthetic same-length SHA tamper regression (2026-11-18)

- Pre-change experimental HEAD: `6591f6a7297789afdcadc75a2715989733f4595e`. PR #4 matched GitHub draft search, remained OPEN and unmerged.
- `09548af324eb94d9cc4b08b71fcc8bde8e1f5947`: extend `tests/test_vision_private_corpus_threefold.py` in each of three independent synthetic 16MB+ corpus cycles. Modify one PDF byte while preserving the original byte length and valid PDF signature; require `SOURCE_SHA256_MISMATCH`, exactly one remaining verified file, `automatic_training_enabled=false`, `family_holdout_verified=false`, `production_approved=false`, `training_ready=false`, and no synthetic private names, group identifiers, raw digest or private path in either report. This complements the existing size-mismatch test, not a customer-data evaluation.
- Before change: GitHub Actions UI smoke run `44293748086` IN_PROGRESS; raster run `44293748011` SUCCESS; rules/dataset run `44293747877` SUCCESS; CircleCI vision-contract and vision-raster SUCCESS on `6591f6a`. Isolated preview publish run `44292885181` SUCCESS for earlier code SHA `d63b698`, not for current HEAD.
- Immediately after test commit: no completed GitHub Actions runs yet; CircleCI vision-contract and vision-raster PENDING for `09548af`. No local Python test execution: container git fetch failed DNS resolution of github.com. Do not claim the new test passed.
- Open: verified real constructor/method/physical scale, independent blind ROI votes and adjudication, verified family holdout, ICC/spot/PDF transparency, anonymous real 404 reference_state/MV3 report, Windows ACL and production accuracy. Local private source PDFs/registry/HMAC keys remain outside GitHub. No training or production OK; unknown => MANUAL.


## M3.17 — fail-closed limits for private approval attachments (2026-11-18)

- Parent experimental SHA: `b8188c94a91817772856116536a7ac6b708ca07f`; only `feature/printcheck-vision-copy-v01`, PR #4 remains Draft. No changes to production Maketnaya.
- Corrected `exportNativeApprovalAttachmentParts`: caller-provided `maxFiles` now actually limits the number of eligible attachments rather than silently using the fixed maximum 64.
- All four numeric limits (`maxFiles`, `maxPerFile`, `maxPartBytes`, `maxPartFiles`) must now be integers in their existing permitted ranges. NaN, numeric strings, fractions and other invalid values fail closed as `MANUAL_INVALID_ATTACHMENT_LIMITS` before any GET or ZIP construction.
- New synthetic Node regression tests verify refusal without requests or training approval and the actual split into ZIP parts when `maxPartFiles=1`.
- Local executable tests not run: container cannot resolve github.com, so source checkout is unavailable. CI status must be verified on the resulting commit; do not claim a successful production/browser test.
- Real authorized attachment HTTP responses and physical-PDF revision matching remain unverified; `training_ready=false` and `production_approved=false`.



## M3.18 — SHA-256 provenance without SubtleCrypto on HTTP test pages (2026-11-18)

- Parent `54ee2d55d9087b1a8b8d55ffcccfcb97045eadd5`; draft PR #4, only the isolated experimental branch.
- Found a provenance gap: the authorized `http://testgifts.local` page is not generally a secure context, so `crypto.subtle` may be absent and the existing attachment reader silently recorded `sha256:null` after successful GET.
- Keep native `crypto.subtle.digest('SHA-256', bytes)` when supported; otherwise run the bounded dependency-free SHA-256 implementation from the same module. The software code operates on the already capped 16 MB file bytes. Both paths return the same 64-char hexadecimal digest.
- New tests: NIST standard empty and `abc` vectors, independently computed Node `createHash('sha256')` results for PDF, PSD and 1,000,001-byte binary; plus digest change on same-length mutation. The algorithm was independently prototyped in Node v22 for 0, 3, 1000, 1,000,000 and 16,000,000 bytes: all PASS versus Node crypto; 16 MB software digest measured ~507 ms on the local tool runtime. This prototype is not an end-to-end browser approval test.
- GitHub Actions and CircleCI for this new commit must be checked separately. Unverified live server GET/attachment provenance, PDF revision, designer labels and expert ROI remain MANUAL. Hash equality only detects byte identity, not network provenance or source authenticity. `training_ready=false`, `production_approved=false`.



## M3.19 — Vision Check v0.1.4 release metadata (2026-11-18)

- Prior changes: `54ee2d55` M3.17 strict attachment count/ZIP caps;
  `45d77630` M3.18 portable SHA-256 for HTTP test pages.
- Version bump `20ccdda5`: `vision/orders/extension/manifest.json`
  changed 0.1.3 → 0.1.4.
- Version shown in page panel: `9493915d` changed the header to
  `Vision AI · Согласование макета · v0.1.4`.
- Local extension installation notes: `742ee2d1` appended v0.1.4
  instructions, source-byte integrity caveat and stable isolated ZIP URL.
- The working Maketnaya, production site, Chrome host permissions and
  GET-only site operations have not been modified.
- M3.17 all four GitHub Actions workflows SUCCESS on `54ee2d5`.
  M3.18 rules, raster and UI smoke SUCCESS on `45d7763`;
  isolated preview still IN_PROGRESS at the last check.
- Do not claim v0.1.4 ZIP published until a matching successful isolated
  workflow and manifest version are independently verified.
- Live testgifts.local native attachment bytes and their association
  to designer comments/PDF revisions are NOT proven by synthetic tests.
  Keep `training_ready=false`, `production_approved=false`.


## M3.20 — проверка целостности приватных согласований после скачивания (2026-11-18)

- История чатов подтверждена: экспериментальная копия PrintCheck Vision, рабочая ветка
  feature/printcheck-vision-copy-v01; PR #4 остаётся draft, основная Макетная не меняется.
  Приоритет — данные дизайнера из штатного «Согласование макета», только при
  числе сообщений больше одного, и исходные файлы из разрешённого GET.
- Зафиксирован недостаток: локальные ZIP-части M3.15 содержат SHA-256,
  номер артикула и связь с комментарием, но после сохранения пользователь
  не имел отдельной проверки целостности и полноты относительно приватного
  JSON, в том числе обнаружения подмены исходных байтов того же размера.
- Новый автономный локальный инструмент
  tools/vision_approval_archive_audit.py (9701f3b3, позже 49ae23f7):
  без сети проверяет ZIP_STORED, CRC, SHA-256, безопасные имена путей,
  лимиты ZIP, непрерывность нумерации частей, границы размеров, метаданные,
  флаги невключённого обучения. С --evidence сверяет 1:1 привязку
  «статья/сообщение/вложение» с локальным приватным JSON, проверяет отсутствие
  потерянных успешно загруженных вложений.
- Если не передан --evidence, вывод только LOCAL_PARTS_ONLY_VERIFIED:
  нельзя установить, что пользователь перечислил последнюю часть ZIP.
  Полное сопоставление даёт LOCAL_ARCHIVES_VERIFIED,
  evidence_crosschecked=true. Обе ветки оставляют training_ready=false
  и production_approved=false.
- Добавлены шесть независимых синтетических офлайн-проверок
  tests/test_vision_approval_archive_audit.py (791aa058; дополнение
  2f3d0871), включая подмену байтов того же размера при пересчитанном ZIP CRC,
  ошибочные связи, пропущенные ZIP-части, компрессию, плохие пути и
  публично-безопасный stdout. Локальный Python 3.13: 6/6 PASS.
- CI rule-contract обновлён (cbfc2748): синтетическая проверка выполняется
  на GitHub Actions; полный протокол в docs/VISION_APPROVAL_ARCHIVE_AUDIT_RU.md
  (e53cbf27). На 49ae23f7 три workflow: rules/dataset safety
  44299540454 SUCCESS, raster safety 44299540508 SUCCESS,
  experimental UI smoke 44299540471 SUCCESS. Для итогового SHA после
  журнальной записи проверять CI отдельно.
- Новый инструмент не включён в Chrome MV3 и не меняет клиентскую
  страницу. Никакие реальные заказы, приватные JSON, ZIP, авторы,
  сообщения и клиентские PDF на GitHub не переносились.
- Хеши обеспечивают внутреннюю согласованность файлов, но не удостоверяют
  ответ сервера gifts.ru, исходную версию PDF, тип нанесения, ROI или
  независимые экспертные метки. Реальный authenticated end-to-end тест
  остаётся открытым. Не разрешать обучение и производство.


## M3.21 — согласования с общей страницы заказов, исходные изображения галерей (2026-11-18)

- Получены пользователем два ПРИВАТНЫХ файла: сохранённая карточка
  заказа и обезличенная диагностика (на GitHub НЕ публиковались).
  В локальной копии HTML: один триггер li[data-itemid] a.j_maketadjusting
  с badge=8; 23 записи истории (8 human / 15 system);
  27 вариантов проблем, 2 checked; 4 галереи g-gallery, 5 оригиналов
  изображений внутри OPEN shadowRoot / declarative template. При этом
  ни одной ссылки a.j_maketadjusting_attachment в этой модалке.
  Анонимная диагностика: 61 строка, rows_scanned=0 и NOT_SCANNED.
- Выявлены две основные причины пропуска: (1) прежний M3.14/M3.15
  работал только на открытой странице ОДНОГО заказа, а из /devorders
  была доступна лишь неглубокая структурная диагностика;
  (2) «картинки» в обсуждениях содержатся в g-gallery.shadowRoot,
  старый алгоритм искал только a.j_maketadjusting_attachment.
- Новая версия MV3 0.1.5, только experimental branch
  feature/printcheck-vision-copy-v01, PR #4 остаётся draft.
  На странице psk.testgifts.local/devorders введены кнопки
  «Собрать согласования из всех заказов», «Остановить согласования»,
  «Отчёт согласований JSON». Каждый уникальный явно указанный заказ
  читается последовательно через временную вкладку, штатные кнопки
  2+ открываются внутри неё, записи сохраняются ПО ЗАКАЗУ отдельным
  приватным JSON; оригиналы вложений — локальными ZIP.
- 1d1057bb: vision/orders/approval-inline-images.mjs находит настоящие
  section picture img в Shadow DOM native g-gallery, отбрасывает
  миниатюры/avatar и проверяет exact CDN URL с matching order + item.
  19520236/8ce8fb79: извлечение в хронологию и счётчики. 4aa07800:
  GET оригиналов/ZIP, в приватном JSON сохраняются только метаданные:
  URL изображения хранится как non-enumerable свойство в памяти.
- 7d04093d/2cb8dcdf: worker пропускает только read-only image GET
  http://files.testgifts.local/maketadjusting/<digits>/<order>/<item>/*.<image>
  от расширения конкретного testgifts.local/private/order/<order>.
  Дополнительное host_permission только тестовый files.testgifts.local,
  без production host, POST или произвольных URL. Manifest 0.1.5
  добавляет tabs и content-transport.js на страницу заказа.
- a5efc8d6/21d349a1/9d133520: изолированная последовательная
  очередь заказов из /devorders; автоматическая загрузка полного
  приватного JSON и ZIP, анонимный отчёт из страницы списка.
  4fc5c8d2: уникальные ZIP имена с номером заказа во время batch,
  чтобы не смешать ZIP-части разных заказов.
  Кнопка прекращения списка действует ПОСЛЕ текущего заказа.
- 0222a828/57c2e52d/9fe9e8f6: синтетические проверки gallery DOM,
  отсутствия URL в JSON, сохранения SHA и ограничений worker.
  a0bd75bf: offline ZIP audit понимает источник
  native_approval_gallery с attachment_id=null, но сохраняет
  проверку exact article/message/file/bytes/SHA.
- af3ddc2b/beaae9ab: Chromium end-to-end queue test из /devorders,
  проверка локальных JSON/ZIP, zero POST. Первые CI публикации
  давали FAIL на этапе новой проверки: Playwright page.route не
  перехватывал раннюю навигацию вкладки, созданной из MV3 worker.
  2fa32c4f заменил фикстуру сетевого слоя на локальный
  HTTP-прокси, чтобы тестировать extension-created tabs как настоящий
  HTTP трафик. Код приложения не должен настраивать прокси.
- b31db40b: packaging assertion обновлён для 3 разрешённых
  тестовых хостов и content transport на order page.
  6786be06: изолированные stale preview builds отменяются при
  более новом экспериментальном push; production main / PR merge
  НЕ затрагиваются.
- Не считать реальный сбор доказанным, пока финальный CI и
  authenticated-проверка на тестовой сети не завершены.
  Вся личная информация остаётся локально, без выгрузки в repo/CI.
  Любой неподтверждённый source PDF revision / ROI / масштаб:
  training_ready=false, production_approved=false, MANUAL.


### M3.21 — итог CI и публикация расширения v0.1.5

- Исправленный тестовый прогон на кодовом SHA
  4fbd01804739e6679aba4a701eb44f632f610b3c.
  GitHub Actions Publish isolated PrintCheck Vision preview:
  https://github.com/tohaa28/tohaa28.github.io/actions/runs/44317055363
  SUCCESS. В Chromium MV3 подтверждена полная синтетическая цепочка:
  список заказов, временная вкладка заказа, точная ссылка
  согласования с badge=2, 2 реплики, 1 отмеченная проблема,
  оригинал изображения из Shadow DOM и создание приватных JSON/ZIP.
- Причины промежуточных отказов CI-теста (не production):
  Playwright context.route не перехватывал раннюю навигацию вкладки MV3,
  исправлено локальным тестовым HTTP proxy; автоматические запросы favicon
  отделены от действия расширения; для кириллического HTML
  исправлен заголовок charset=utf-8. Итоговый синтетический тест
  проверяет читаемый кириллический текст в сохранённом приватном JSON.
- Публикация — только изолированный предпросмотр
  https://tohaa28.github.io/gifts-layout-workbench-vision/
  с main preview commit e14a7fad64e913e2722da84018730a830c7aaef6.
  В опубликованном JS подтверждены версия v0.1.5, обработчик
  native_approval_gallery и фоновая команда автообхода заказа.
  Ссылка на ZIP:
  https://tohaa28.github.io/gifts-layout-workbench-vision/vision-local-lan-extension.zip
- Синтетический CI НЕ удостоверяет реальный authenticated-ответ
  тестового сервера. Для проверки в тестовой сети необходимо
  установить MV3 v0.1.5, разрешить tabs и files.testgifts.local,
  включить несколько локальных скачиваний, собрать анонимный JSON.
  Связь с конкретной версией PDF, ROI и обучение не подтверждены:
  training_ready=false, production_approved=false.
- Draft PR #4 остаётся открытым и НЕ слит. Основная Макетная
  вне изолированного preview не затронута. Частные данные не
  передавались в публичный репозиторий.


### M3.26 — регрессия duplicate JSON keys в локальном архивном аудите (2026-11-18)

- Исходный HEAD ветки: `008a48bb6f1698f40a71dd9431640385f46438d4`. Перед записью проверен PR #4: open, draft=true, merged=false.
- Новый тестовый коммит: `cacb03ba8b2763eac763084e77ef1206d63b0c8c`. Изменён **только** `tests/test_vision_approval_archive_audit.py`: два полностью синтетических сценария повторных ключей `training_ready` в ZIP manifest и `order_number` в private evidence. Требуются `DUPLICATE_JSON_KEY`, fail-closed `training_ready=false`, отсутствие путей, имён и синтетических ID в stdout/stderr. Основной аудитор уже использует `object_pairs_hook=unique_pairs`; production-модули не менялись.
- На исходном SHA GitHub Actions: UI smoke run 44317489488 SUCCESS, raster safety 44317489482 SUCCESS, rules/dataset safety 44317489501 SUCCESS; CircleCI vision-contract и vision-raster SUCCESS. Отдельный preview publish на исходном SHA не подтверждён; предыдущая публикация run 44317055363 относится к иному SHA.
- Локальный Git clone/test не состоялся: DNS `github.com` недоступен в рабочем контейнере. Новый тестовый коммит **не объявляется прошедшим CI до фактических результатов**. Следующий цикл должен проверить GitHub Actions/CircleCI на новом HEAD и отдельно preview publish.
- Открыто: реальный анонимный 404/MV3 reference_state, три независимых цикла ROI (два голоса + аджудикация), реальная связка макет/конструктор/технология, подтверждённый физический масштаб, ICC/spot и сложные PDF, verified family holdout, локальная приватность/ACL, реальная точность. Без доказанных ROI, revision, метода нанесения и масштаба: `training_ready=false`, `production_approved=false`, `MANUAL`. Приватные файлы и идентификаторы в GitHub не отправлялись.


### M3.27 — nested duplicate manifest digest regression (2026-11-19)

- Before change PR #4 was OPEN, draft=true, merged=false; branch HEAD `3323a9841f600373cf59b64fae0f71619442de7b`. The previous M3.26 regression was confirmed by GitHub Actions UI smoke 44368594172 SUCCESS, raster safety 44368594311 SUCCESS, rules/dataset safety 44368594329 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on this exact SHA not confirmed.
- Test commit `5482d562e60559d8b0e34b7182dbcec708dc40a8`: synthetic nested duplicate `sha256` in a manifest item must fail with `DUPLICATE_JSON_KEY`, not accept either digest; CLI receipt must keep `training_ready=false` and `production_approved=false`, without exposing private paths, identifiers or hashes. Only `tests/test_vision_approval_archive_audit.py` changed.
- Local Python regression was not executed in this cycle. New SHA CI must be checked independently; no unobserved PASS is claimed. Production code, customer files and private expert labels were not touched.
- Still blocked: authenticated 404/MV3 anonymous reference_state, three independent expert ROI/adjudication cycles, verified PDF revision + constructor + print method + physical scale, ICC/spot and complex PDF color, verified family holdout, private Windows ACL and real-world accuracy. Unknown evidence => MANUAL; training_ready=false; production_approved=false.


### M3.28 — nested private evidence digest duplicate regression (2026-11-19)

- Before test change: PR #4 OPEN, draft=true, merged=false; branch HEAD `d23f8193832f17bf5e4cec5a9beffa6fedd74713`.
- Confirmed on prior HEAD: GitHub Actions UI smoke 44380669696 SUCCESS, raster safety 44380671018 SUCCESS, rules/dataset safety 44380669672 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Isolated preview publish on this exact SHA not established.
- Test-only commit `308410a71cc04e01170bc3b58b80c7ab75c6d83e`: added synthetic nested duplicate `sha256` key inside private evidence attachment. Requires `DUPLICATE_JSON_KEY`, fail-closed `training_ready=false` and `production_approved=false`, and CLI redaction of paths, IDs, and digest. Production modules unchanged.
- Local Git clone / Python execution blocked by DNS resolution of github.com. The new test has NOT been independently executed; new SHA GitHub Actions/CircleCI results remain to be checked. Preview publish not triggered by this test-only change.
- Still open: authenticated 404/MV3 anonymous reference_state, independent 2-voice ROI + adjudication threefold regression, exact constructor/print method/PDF revision/physical scale, ICC/spot and complex PDF, verified family holdout, Windows private ACL and real-world accuracy. Never upload private files, SHA, names, keys or expert labels. Unknown evidence => MANUAL; `training_ready=false`; `production_approved=false`.

### M3.29 — Approval history -> private training candidates (2026-11-18)

- Scope: **experimental** `feature/printcheck-vision-copy-v01` only. No merge into production Maketnaya or PR #4. No real artwork, discussions, filenames, orders or identifiers committed.
- Preserved original discussion DOM identifiers `native_comment_id` and pseudonymous `actor_ref` across articles in the same order, without persisting real author names. The prior links order -> item -> message(sequence/time) -> attachment/data-id/gallery -> downloaded ZIP part/entry/SHA-256 remain intact.
- New `tools/vision_approval_training_corpus.py` builds a local-only evidence graph from all `vision-private-approval-evidence-<order>.json` and matching attachment ZIPs, with convenient `--input-dir`. Strict existing `vision_approval_archive_audit.py` runs before copying data. Output: raw original JSON/ZIP; byte-verified SHA-addressed assets; orders/articles/messages/problems/assets/relations/cases/review_queue JSONL and manifest. POSIX private modes 0700/0600; Windows NTFS ACL pending independent verification.
- Each case remains `training_ready=false`, `production_approved=false`; source PDF revision, print method/physical scale, defect ROI and independent expert verdict are explicitly blocked. Current checked problems are *claims*, not verified label. No network access or upload.
- Added fully synthetic positive, missing-attachment and tampered-ZIP regression `tests/test_vision_approval_training_corpus.py`; included in `.github/workflows/test-printcheck-vision-rules.yml`. GitHub Actions rules/dataset safety run **44393717407 SUCCESS**, including new corpus tests and original archive integrity checks.
- Chrome MV3 version incremented to **0.1.6** in manifest and both visible panels; release publication must be verified separately before claiming the new ZIP is live.
- Privately, a **saved order HTML provided in the chat** was parsed and linked into a separate local candidate dataset (23 chronology entries, eight user comments, five linked screenshot URLs, two active problem checkboxes). Since HTML carries URLs only, **zero image bytes were acquired**. The local private bundle was not uploaded to GitHub, and it is not training ground truth.
- Documentation: `docs/VISION_APPROVAL_TRAINING_PIPELINE_RU.md`. Real authenticated end-to-end GET success across a full live order list remains a manual-on-site check.



### M3.31 — bounded private ZIP copying and post-audit integrity (2026-11-19)

- Starting draft PR #4 OPEN, draft=true, merged=false; HEAD a608749d5a05ff3c5c95c4c798d685b6b5162729. Changed only experimental tools/vision_approval_training_corpus.py and tests/test_vision_approval_training_corpus.py.
- ZIP sources are hashed in 1 MiB chunks with a 512 MiB per-file limit before audit; copying is streamed into private 0600 files and rechecks SHA after audit. On mismatch returns SOURCE_ZIP_CHANGED_AFTER_AUDIT and removes the partial ZIP. New synthetic tests cover oversized source and post-audit mutation.
- GitHub commits: code bf174385560a50f3aacbad6474fcf057c6409866; tests ed87bdcd043dc7940b9dc8eb448b318801fff9c0. Tests and new-head CI were not yet confirmed at journal write; verify independently. Other binary extraction paths still use zipfile.read and require further memory hardening. No customer material uploaded; no real ROI/scale/ICC verification; training_ready=false, production_approved=false, MANUAL.


### M3.38 — aggregate ZIP expansion preflight (2026-11-19)

- Before edits: PR #4 OPEN, draft=true, merged=false, head `909570f235dcbe69916fc6cc739a5774697515bd`. Existing GitHub Actions on that SHA: UI smoke 44443918941 SUCCESS, raster safety 44443919159 SUCCESS, rules/dataset safety 44443918979 SUCCESS. Preview publish on that exact SHA not confirmed.
- Code commit `d27423dc234a3420f2f6379099c932eab98457ff`: experimental corpus builder now rejects ZIP sets with declared aggregate uncompressed size above 512 MiB before creating an output directory. This is metadata preflight, NOT full streaming extraction or protection against source mutation after audit.
- Test commit `67a93407fa04461311b499b9d8c7e4bf2d9954e1`: synthetic over-budget rejection before output and exact-boundary acceptance; both keep training disabled. Local Git/Python execution blocked by github.com DNS. New-head CI has not yet been confirmed; do not claim PASS.
- Remaining work: stream individual attachments to private staging; enforce actual cumulative decompressed byte count, incremental SHA and dedup; transactional rollback on all failures. Recheck four GitHub CI contours and CircleCI. ROI two independent experts/adjudication (three cycles), authenticated 404/MV3 reference_state, PDF/ICC/spot, proven constructor/method/scale, verified family holdout, Windows ACL and real-world accuracy remain unverified. Unknown => MANUAL; training_ready=false; production_approved=false. No customer data or secrets published.


### M3.39 — streaming digest for duplicate private assets (2026-11-19)

- Pre-change HEAD `a79ade37e5d5ede7d11fa5f732e4818c5c8f1062` was identical to experimental branch. Prior HEAD GitHub Actions: UI smoke 44464592649 SUCCESS, raster safety 44464592534 SUCCESS, rules/dataset safety 44464592558 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA unconfirmed.
- Code commit `2064a1cf298e85f61a1a36b97b6f4a385eb87388`: replace `target.read_bytes()` digest of existing SHA-addressed asset with bounded streaming `file_digest(target)`. This avoids a second full-file memory allocation during duplicate asset verification; 512 MiB source digest bound remains. Does NOT resolve in-memory `byte_lookup`, actual aggregate expansion budget, or transactional rollback.
- Synthetic regression commit `a470927f1d1d24112a497b86933f1db7a2403a76`: two ZIP entries with identical bytes must reuse one asset, exercise existing-asset branch without `Path.read_bytes` on assets, and retain `training_ready=false`. The test is NOT yet independently executed; check CI on final HEAD and correct any test-fixture incompatibility only in experimental files.
- Unverified: exact-SHA preview publish, 3 independent ROI/adjudication rounds, real authenticated 404/MV3 reference_state, PDF/ICC/spot and exact physical scale, verified constructor/method/revision, family holdout, Windows ACL, and real accuracy. Unknown => MANUAL, training_ready=false, production_approved=false. No customer data or secrets committed.


### M3.40 — actual cumulative ZIP attachment read budget (2026-11-19)

- Pre-change HEAD `1c1c484c3ea7af42c355f01ae12c798dee23d4ab`; PR #4 OPEN, draft=true, merged=false, head matched experimental branch. GitHub Actions UI smoke 44471994674 SUCCESS, raster safety 44471994537 SUCCESS, rules/dataset safety 44471994578 SUCCESS. CircleCI vision-contract and vision-raster SUCCESS. Exact-SHA preview publish not confirmed.
- Code commit `11b3171fd1563016a1a990a5de6060c1ceb091d4`: in experimental `tools/vision_approval_training_corpus.py`, `bounded_zip_entry` now optionally accumulates *actual* decompressed bytes in a shared budget during extraction, rejects over 512 MiB. Existing declared metadata preflight and per-entry 16 MiB limit remain.
- Test commit `dc9394b01b5772d4bb0781d1622839de0fd3e7b7`: two synthetic unit regressions for second-entry cumulative overflow and exact boundary. New-head CI not yet confirmed at journal write; no unobserved PASS claimed.
- This is incremental hardening, NOT a fully streaming/staged transactional extraction: `byte_lookup` still holds bytes, and failure after output creation can leave partial local output. Next: private staging, streaming digest/dedup, rollback and full threefold independent ROI/adjudication regression. No customer data, identifiers, original filenames, SHA or secrets uploaded. Unknown revision/constructor/method/scale/ICC/ROI => MANUAL; training_ready=false, production_approved=false. Preview publish, authenticated 404/MV3 reference_state, verified family holdout, Windows ACL and real-world accuracy remain unverified.


## 2026-11-19 — M3.23 / Vision Check v0.1.7: переписки+заказы (только эксперимент)

**Проблема в тестовой среде:** пользователю скачивались ZIP с вложениями,
но JSON с перепиской не появлялся. Причина в конструкции: временная
вкладка страницы заказа закрывалась по завершении очереди, а событие
скачивания JSON инициировалось поздним кликом по временной ссылке в
этой вкладке и не проверялось Chrome Downloads. Ранее признак
`private_text_saved=true` выставлялся без подтверждения записи.

**Изменения:** отдельный `approval-order-facts.mjs` собирает
ограниченную структуру из `#j_cart_host` и `li[data-itemid]`:
исходные номера заказа, внутренний ID, дата/клиент/статусы,
оригинальные артикулы/названия, описание,
количество/цены, параметры нанесения и технические требования.
В `approval-auto-scan.mjs` сообщения получили `author_name` и
`author_display_text` вместе с уже существовавшими `actor_ref`,
`native_comment_id`, датой и последовательностью.
Теперь `approval-page-entry.mjs` при обходе со списка инициирует
резервную копию JSON ДО чтения файлов и финальный JSON ПОСЛЕ;
`service-worker.js` строго проверяет источник сообщения/номер заказа,
сохраняет локально через `chrome.downloads.download` и ожидает
`state=complete`. Права только `tabs,downloads`,
запрещены POST и произвольные домены. Значение `private_text_saved`
выставляется только после подтверждения Chrome; UI показывает отдельно
итоговые, резервные и отсутствующие JSON.

Оффлайн-конвертер `tools/vision_approval_training_corpus.py`
переносит сведения о клиенте/заказе, артикуле/нанесении, исходных
именах авторов в отдельные JSONL с реляционными ссылками;
`-raw.json` исключён из автоматического импорта при наличии
финального JSON. Синтетические browser и Python/Node тесты
расширены для проверки двух скачиваний, имен, данных заказа, сведений
артикула, текущих проблем и SHA-256 вложений.

**Безопасность и границы:** исходные тексты, имена и материалы остаются
на локальном ПК; в GitHub добавлен исключительно код/синтетические
фикстуры. PR #4 оставить DRAFT, в production/Макетную не переносить.
Фактический тест авторизованного чтения с тестовых серверов — у
пользователя в Chrome; синтетический CI не заменяет его.
`training_ready=false`, ревизии PDF и экспертные ROI не подтверждены.


### M3.42 — transactional private approval corpus publication (2026-11-19)

- Before changes PR #4 OPEN, draft=true, merged=false, head a32e7c1289f3bcfd5322b252a26d0776264bac2f. Three GitHub Actions (UI smoke, raster safety, rules/dataset safety) SUCCESS and CircleCI vision-contract/raster SUCCESS on that SHA. Exact-SHA preview publish not confirmed.
- Experimental code commit ff6eb9e61f89178f95887f07512dc493d886c65f: transform now builds under a private 0700 temporary sibling directory, renames the completed corpus to the requested destination only after success, and removes staging on exceptions. Refuses pre-existing output and invalid parent. No production modules touched.
- Synthetic regression commit d01ebca03efdb1da222c6ead4f39cdbb9155d95b: late order-facts validation failure after a raw write must leave no published output/staging; successful build must leave only complete corpus. Tests are NOT independently executed yet; CI on d01ebca was absent at initial query. Verify and fix any failures before declaring PASS.
- Remaining risk: ZIP attachment contents still held in byte_lookup; streaming extraction, SHA incremental dedup and Windows ACL verification pending. Preview publish, independent two-expert ROI adjudication x3, real authenticated 404/MV3 reference_state, verified constructor/print method/PDF revision/scale, ICC/spot, verified family holdout and real-world accuracy not confirmed. No real private source/identifiers/SHA/keys uploaded. Unknown => MANUAL; training_ready=false; production_approved=false.



## 2026-11-19 — M3.24: один архив Vision AI вместо множества скачиваний

Причина: Chromium при обходе списка тестовых заказов мог блокировать
многочисленные загрузки ZIP/JSON из быстро закрывающихся вкладок,
даже если исходные сообщения и PDF/изображения были успешно прочитаны.

Новый модуль \`vision/orders/approval-batch-archive.mjs\` содержит
ограниченный подтверждаемый приём двоичных порций, SHA-256/CRC32,
чтение только STORE ZIP-частей из прежнего сборщика и генератор
единого ZIP c путями \`orders/<order>/order.json\`,
\`articles.json\`, \`approvals.json\`, \`threads/<item_id>.json\`,
\`files-index.json\`, \`assets/<sha256>.<ext>\`,
\`source/evidence.json\`, \`source/backup.json\`, \`review.json\`.
Корневой \`manifest.json\` сохраняет статус отсутствующих материалов,
\`training_ready=false\`. Встроенный архив не меняет исходные байты.

\`approval-page-entry.mjs\` больше не скачивает отдельные JSON/ZIP
при запуске **из списка**: результаты по чанкам 48 КБ переходят
\`chrome.runtime.sendMessage\` → строго ограниченный worker
→ исходная вкладка списка, где формируется один ZIP.
Ручное сохранение из открытой карточки заказа оставлено без изменений.
\`overlay-entry.mjs\` удерживает данные сессии до скачивания,
показывает статус и кнопку повторной попытки. Защитный предел 180 МБ;
недостаточная ёмкость не превращается в ложную отметку успеха.

Новый \`tools/vision_approval_batch_import.py\` преобразует один ZIP
в существующий связанный обучающий корпус JSONL с повторной проверкой
SHA-256, не обучая модель и не маскируя имена из тестовой среды.
Добавлены JS-тесты формата, отказов и synthetic Chromium E2E, а также
Python-тесты импорта/защиты от ZIP-slip. Весь код остается только в
\`feature/printcheck-vision-copy-v01\`, PR #4 DRAFT, production
«Макетная» не затронута. Результаты реального списка требуют
проверки в авторизованном Chrome.


### M3.43 — streaming private ZIP entry staging (2026-11-19)

- Pre-change PR #4 OPEN, draft=true, merged=false; starting HEAD a2c7dcb0829fac370f46dfaf3b66a6e729a2961b. On that SHA GitHub Actions UI smoke, raster safety, rules/dataset safety SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Exact-SHA preview publish not confirmed.
- Experimental code commit 3e9ebe1db04f266d3fc35cf95f63d3a331d70ade: ZIP entries now decompress in bounded chunks to private 0600 entry-stage files; cumulative actual uncompressed budget and per-entry 16 MiB enforced while streaming; SHA-256 computed incrementally. The byte_lookup contains staged paths, hashes and sizes instead of in-memory binary data. Unique assets are moved into private assets; residual staging is removed before manifest creation. Existing transactional outer staging cleans failures.
- Synthetic test commit 2d625cb092a36e29f7e10c84311f7bd4bb5a891a: valid corpus must succeed with the old in-memory bounded_zip_entry disabled and leave no entry-stage directory. CI results for this change must be checked; no unobserved PASS claimed.
- Remaining limitations: ZIP manifest is still loaded in memory; source ZIP copies remain on disk; Windows ACL independent verification, triple independent ROI adjudication, authenticated 404/MV3 reference_state, exact PDF/ICC/spot and physical scale, verified family holdout and real-world accuracy not confirmed. No customer data, keys, original identifiers or real SHA published. Unknown => MANUAL, training_ready=false, production_approved=false.


## 2026-11-19 — M3.25 / Vision Check v0.1.9 — диапазон 3.2M–8.2M

**Запрос:** пройти номера от 3200000 до 8200000, проверять
статус «ТЗ УТВЕРЖДЕНО», только у утверждённых читать согласования,
формировать реестр, ZIP по 100 заказов, паузу/стоп/продолжение.

**Источник в сохранённой карточке \`Заказ 8097051.html\`:**
состояние \`input.j_toggle_status[data-id="59"]\` в \`.cart-log\`,
подписи \`.on/.off\` обе содержат «ТЗ утверждено». В
исходном заказе input не отмечен. Проверка **только checked**,
с совпадением номера \`.cart-header-number [data-clipboard-text]\`
и существованием \`#j_cart_host[data-orderid]\`.
Отсутствующий/противоречивый статус — MANUAL, не ложное одобрение.

**Новые файлы:**
\`vision/orders/approval-range-scanner.mjs\` — pure/async
preflight одного order GET, schema checkpoint и ограничения:
3.2M–8.2M, не менее 1000 мс между последовательными карточками.
\`vision/orders/approval-range-controller.mjs\` — UI, очередь,
статусы, Chrome Storage checkpoint, найденные заказы и ZIP-партии
по 100 утверждённых/120 МБ.
Временно полученные данные сохраняются только в памяти страницы
списка. Сканируемая временная вкладка повторно перепроверяет
checked ТЗ до чтения native approval. Chrome Downloads audit
проверяет ZIP complete до сохранения долговременного курсора.
Фонового автономного сканера нет, вкладка должна оставаться открытой.
Прерывание до полного сохранения партии приводит к повторному
обходу от последней безопасной точки — без silent data loss.
Добавлено разрешение Chrome storage; production Gifts исключён.

**Тестирование:** JS unit status 59 (вкл/выкл),
неправильный номер, порог частоты, checkpoint commit; browser
synthetic 3 карточек: approved → native 2+ discussion / unchecked
→ ровно один GET без модалки / HTTP404 → пропуск; проверка
одного ZIP и JSON реестра из Storage, полей автора и вложений.
UI/corpus regression & CI изолированного preview.
Никаких реальных клиентских материалов в GitHub. Только
\`feature/printcheck-vision-copy-v01\`, PR #4 оставить DRAFT.


## 2026-11-19 — M3.26 / Vision Check v0.1.10 — пропуск недоступных карточек

**Запрос:** при ошибке открытия страницы заказа не останавливать
перебор 3200000–8200000; автоматически переходить к следующему номеру.

\`approval-range-scanner.mjs\`: введена явная классификация
\`isRecoverableRangeFailure\`. HTTP 404/410 остаются обычными
несуществующими номерами. HTML без проверяемой карточки, HTTP 5xx,
ошибка GET, неуспешная временная вкладка и неполное чтение
согласования теперь отмечаются \`MANUAL_...\`, но не останавливают
диапазон. HTTP 401/403, 429 и неисправность доверенного транспорта
по-прежнему останавливают сканирование как **общую** проблему
с доступом/лимитами, чтобы не потерять весь диапазон.

\`approval-range-controller.mjs\`: продолжает до следующего номера;
недоступные карточки сохраняет в \`failed_orders\` контрольной точки
и \`failed_pending\` текущей партии, с кодом причины, этапом и
HTTP-статусом при наличии. Отдельные неудачные карточки не считаются
утверждёнными, не попадают в корректный обучающий набор, доступны
для повторного анализа по реестру. Уже подтверждённые ZIP по 100
найденных заказов сохраняются. Контрольная точка двигается при
завершённом ZIP либо на участках без ожидающих архивирования данных.
\`tests/printcheck-vision-approval-range.test.mjs\` проверяет
классификацию, восстановление ошибок и дедупликацию.
\`tests/printcheck-vision-approval-range.browser.mjs\` расширен:
проверка approved → unchecked → HTTP404 → HTTP502 → HTML без
карточки → завершённый ZIP и сохранённый список ошибок.

Изменения в экспериментальной ветке. Production «Макетная»
не изменяется. Реальный проход миллионов заказов не запускался.


## 2026-11-19 — M3.27 / Vision Check v0.1.11: живая задержка

**Причина:** `approval-range-controller.mjs` захватывал
`config.delay_ms` при запуске и использовал его неизменяемым
в `await delay(config.delay_ms)`. Изменение `input` в UI
не обрабатывалось. Кроме того, `exactConfig` сравнивал
`delay_ms` и блокировал продолжение существующего диапазона
после изменения задержки.

**Исправлено:** в `approval-range-scanner.mjs` добавлен
`changeRangeDelay(checkpoint,delayMs)`, который меняет только
конфигурацию времени без потери `committed_next`, реестра и
метаданных ZIP; допустимо 100–60 000 мс. В
`approval-range-controller.mjs` ввод обрабатывается сразу
и обновляет `liveDelayMs`, а `waitDynamicDelay()` перечитывает
его каждые ~100 мс. Сохранённая настройка живёт независимо
от идентичности диапазона (start/end/archive_size) и
записывается вместе с текущей безопасной контрольной точкой.
Записи `chrome.storage.local` сериализованы, чтобы избежать
отката позиции из-за гонок при сохранении. Настройка переживает
перезагрузку вкладки без сброса прогресса.

**Тесты:** обновлены модульные проверки диапазона и реестра;
в `tests/printcheck-vision-approval-range.browser.mjs` измеряются
реальные интервалы между запросами после изменения настроек
1000→2300→1500 мс и отдельно проверяется сохранение 3100 мс
после завершения. Синтетический Chromium PASS до релизного
переименования; требуется подтверждение итоговой сборки v0.1.11.
Экспериментальная ветка, PR #4 DRAFT, production не менялся.


## 2026-11-19 — M3.46 / bounded private ZIP manifest

**HEAD перед изменением:** 9a31761d48c659b84c43d7f0807a817bb9f6d4db; PR #4 OPEN/DRAFT, merged=false.
**Код:** 77ea20b4df2fa8edabb12abced878a3c43d9ad5c — `tools/vision_approval_training_corpus.py`: отдельный лимит manifest.json 1 MiB по ZIP metadata и по фактически прочитанным байтам; чтение через ZipExtFile, отказ до принятия корпуса.
**Синтетические тесты:** ba606e1d4791a88ed1aa31c87494f7a45bd5db45 — границы 1 MiB−1, ровно 1 MiB, 1 MiB+1, повреждённый JSON; превышение и повреждение должны оставлять выход отсутствующим.
**CI до изменения:** GitHub Actions UI smoke/raster safety/rules dataset safety SUCCESS на 1ece012b2885c852c34e65b99fbaa9a3663993fa (runs 44532153534, 44532153445, 44532153427). Preview publish на точном SHA не подтверждён; CircleCI на точном SHA не подтверждён. **Новые тесты:** выполнение на новом SHA ожидает подтверждения CI; локальный git clone недоступен из-за DNS github.com.
**Ограничения:** модуль аудита ZIP имеет собственный MAX_MANIFEST_BYTES=2_000_000; новый 1 MiB лимит применяется только к конструктору корпуса. Независимые реальные ROI/две экспертные оценки/аджудикация, конструктор, метод нанесения, масштаб, PDF ICC/spot и verified family holdout не подтверждены. training_ready=false; production_approved=false; неизвестное → MANUAL. Приватные клиентские данные не выгружались. Production не менялся, PR не сливался.


## 2026-11-19 — M3.49 / bounded independent ZIP archive auditor

**Pre-change HEAD:** dd4efea2636398a6deef3644ba329003558981b6; PR #4 OPEN, draft=true, merged=false. GitHub Actions UI smoke / raster safety / rules-dataset safety SUCCESS; CircleCI vision-contract / vision-raster SUCCESS on that SHA. Preview publish on exact SHA not verified.

**Implementation:** 4cd5b7d5ce7ba837e41fc72348fd874875d68332 updates `tools/vision_approval_archive_audit.py`: `manifest.json` limit aligned to 1 MiB (1048576 bytes), bounded `ZipExtFile.read(limit+1)` plus ZIP metadata guard; reject actual overrun with code-only MANIFEST_TOO_LARGE.

**Synthetic regression:** 5aef5cf6301eddd1bfed68d998a636532136bcd4 updates `tests/test_vision_approval_archive_audit.py`: 1 MiB−1, exactly 1 MiB, 1 MiB+1, malformed JSON and redacted CLI failure. New test execution and CI for changed HEAD are pending verification; do not claim PASS before confirmation.

**Outstanding:** preview publish; triple independent ROI-voice/adjudication regression; Chromium 404/MV3 real anonymous reference_state; PDF ICC/spot; trusted physical mm scale and print process; independent verified ROI/family holdout. No real customer corpus, original names, raw SHA, keys or private images uploaded. No production changes. training_ready=false; production_approved=false; unknown => MANUAL.


## 2026-11-19 — M3.50 / bounded private evidence read (synthetic only)

**Before change:** 5b2343c10145927b8478c7297e9f93b17b4b5cdd; PR #4 OPEN/DRAFT, not merged. GitHub Actions UI smoke, independent raster safety, rules/dataset safety SUCCESS on this SHA; exact-SHA preview publish and CircleCI not independently confirmed in this cycle.

**Implementation:** b78ae2678e1980ad8b977227ca4317e66d69377e — `tools/vision_approval_archive_audit.py` now reads optional local evidence JSON with a 16 MiB + 1 byte cap, rejects larger input as code-only `EVIDENCE_TOO_LARGE`, and does not print evidence path or identifiers. ZIP manifest 1 MiB cap remains unchanged.

**Regression:** b6a3e613a8bfa79c6e72ad13bc91ad8dbd74b545 — synthetic tests for evidence overrun, CLI path redaction and exact-boundary invalid JSON. Test execution on changed HEAD not yet confirmed; CI pending. No customer inputs used.

**Unresolved:** exact-HEAD four GitHub CI and CircleCI confirmation; triple independent ROI voices/adjudication; authenticated 404/MV3 anonymous reference_state; PDF/ICC/spot and exact physical scale; verified print method, constructor and family holdout. `training_ready=false`, `production_approved=false`; all unknowns => MANUAL. No production module changes, no merge or public private-data upload.


## 2026-11-20 — M3.54 / bounded-memory original SHA verification (synthetic)

**Before change:** 5c0bb44fe52c2e5e4d848aac6407f9c32d98d306; PR #4 OPEN, draft=true, merged=false. GitHub Actions UI smoke 44577410086, raster safety 44577410847, rules/dataset safety 44577410089 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS on before-change SHA. Preview publish on exact SHA not verified.

**Implementation:** 42c3746069e94f3f4736ed9777d0838ac482618e — `tools/vision_roi_review.py` now computes original SHA-256 incrementally with 1 MiB chunks, checks the cumulative size against `lab.MAX_FILE`, and maps file I/O errors to a code-only `SOURCE_PATH_UNSAFE`. Existing resolved-path, symlink, file-size and digest guards remain; no customer material processed.

**Synthetic tests:** d179165eba8764c486e87c7b484ca94ba599ea09 — `tests/test_vision_roi_review.py` checks valid SHA, modified source, oversized source, unsafe traversal and path-free errors. Execution of newly added tests, threefold ROI/adjudication regressions and CI on the changed HEAD remain **unverified**; local git clone blocked by DNS resolution of github.com. Do not claim PASS without actual execution.

**Outstanding:** exact-HEAD four-contour CI including preview publish; three independent regression rounds; real anonymous Chromium 404/MV3 reference_state; PDF/ICC/spot, trusted mm scale and print method, two verified independent ROI voices and adjudication, verified family holdout. No real accuracy claim, automatic training, public customer data or production changes. `training_ready=false`, `production_approved=false`; unknown => MANUAL. PR #4 remains draft and must not be merged.


## 2026-11-20 — M3.55 / exact-HEAD CI verification (no model promotion)

**Verified pre-log HEAD:** 6d1297e4616572bc1cd39cf3a46cf3574ae8d3fb; comparison against experimental branch identical (ahead=0, behind=0). PR #4 machine state open, draft=true, merged=false; base gifts-layout-workbench-mockups-source.

**Exact-HEAD GitHub Actions:** UI smoke run 44618128983 SUCCESS; independent raster safety run 44618129040 SUCCESS; rules/dataset safety run 44618129049 SUCCESS. Rule-contract job includes successful steps named 'Cyclic offline ROI, PDF, expert-consensus and privacy safety checks', 'Verify private large-file corpus staging and grouped review safety', and 'Verify private expert-region metrics and grouped holdouts'. UI job includes successful 'Smoke test blinded two-reviewer local workflow'. Step success does not independently prove three full rounds for every requested suite or real-world ROI validation.

**CircleCI commit statuses:** vision-contract SUCCESS (workflow 53f0033e-2f58-4c21-b28c-7e3d8337ec9a); vision-raster SUCCESS (workflow 464f799f-3cf1-4c53-b42e-1e7c392e6ef6). Preview publish on this exact SHA NOT VERIFIED. Browser 404/MV3 anonymous real reference_state NOT OBTAINED. Local independent triple run NOT PERFORMED: github.com DNS resolution unavailable in runner. No new source-code changes or real customer inputs in this checkpoint.

**Gates remain closed:** training_ready=false; production_approved=false; no verified real two-voice ROI/adjudication, constructor/process/physical scale, ICC/spot provenance or verified family holdout. Unknown geometry/color/scale => MANUAL. No private files, SHA, names or keys uploaded; no production change or PR merge.


## 2026-11-20 — M3.57 / ROI source mutation between independent review stages (synthetic regression)

**Pre-change HEAD:** dfb5cc16320844d28acadfbc2f465e100e96df7c; PR #4 OPEN, draft=true, merged=false. GitHub Actions on pre-change HEAD: UI smoke 44627862975 SUCCESS, raster safety 44627863132 SUCCESS, rules/dataset safety 44627863104 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact HEAD not verified.

**Change:** c92d640efc91178d361d56217fe4834ce104a7ff modifies only `tests/test_vision_roi_review.py`. Two synthetic regressions exercise SHA mismatch after first independent reviewer vote and after two disagreeing votes but before independent adjudication. Both require refusal without recording a second vote/adjudication or promoting training. Existing `verify_original()` already guards the relevant paths; production code unchanged.

**Verification at initial post-commit query:** no GitHub Actions runs or CircleCI statuses returned for c92d640e. New tests have NOT been independently executed in this run; local git access failed DNS resolution of github.com. No threefold independent local ROI/PDF/private-stage/Chromium regression run. CI outcome on new SHA is pending, not PASS. No real customer files used.

**Outstanding:** four-contour exact-HEAD CI (including preview publish); independent 3× review/adjudication and private 512 MiB streaming regression; anonymous authenticated 404/MV3 reference_state; PDF/ICC/spot provenance; two verified independent real ROI reviewers, constructor/print method, trusted physical scale, verified family holdout. No automatic training or real-world accuracy claim. `training_ready=false`; `production_approved=false`; unknown => MANUAL. No production changes, customer uploads, PR merge or release.


## 2026-11-20 — M3.69 / exact-HEAD CI and draft-gate checkpoint (no promotion)

**Verified HEAD:** 94dd5a6f93ea8b07ccc6a8dde353f6953a60a846; branch comparison identical (ahead=0, behind=0). PR #4 OPEN, machine draft=true, merged=false; head SHA matches.

**GitHub Actions on exact SHA:** experimental UI smoke [44714754467](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44714754467) SUCCESS; independent raster safety [44714754598](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44714754598) SUCCESS; rules/dataset safety [44714754589](https://github.com/tohaa28/tohaa28.github.io/actions/runs/44714754589) SUCCESS. CircleCI statuses on same SHA: vision-contract SUCCESS (workflow d277ce8e-7fd3-4669-a151-65e575f90c49), vision-raster SUCCESS (workflow 6523e5d0-57ea-4454-959e-b28388258aa2). Exact-SHA preview publish NOT VERIFIED; absence of a publish run from pull-request-filtered results does not prove failure.

**Read-only review:** tools/vision_roi_review.py, tools/vision_pdf_audit.py, tools/vision_private_corpus_stage.py and tests/printcheck-vision-order-404.browser.mjs exist on verified HEAD. No independent 3x local ROI/adjudication, PDF --all, 512 MB private streaming or Chromium 404/MV3 execution in this cycle: local git ls-remote failed DNS resolution of github.com. No real anonymous authenticated reference_state report collected. No source/test code changes in this checkpoint.

**Next bounded implementation:** restore executable checkout; independently run 3x synthetic ROI/two voices/adjudication, PDF audit and private staging, then Chromium 404/MV3 with code-only reference_state (STILL_LISTED_IN_POPUP / MISSING_FROM_POPUP / POPUP_RECHECK_UNAVAILABLE) and network-failure classification; add a regression test only for a reproduced gap. Do not bypass auth or infer alternate download endpoints.

**Closed gates:** training_ready=false; production_approved=false; unknown geometry/physical mm/process/ICC/spot => MANUAL. Two independently verified real ROI voices, adjudication, constructor/process linkage and verified family holdout remain missing. Candidate filename labels are unreviewed, not ground truth. No client files, raw hashes, original names, HMAC keys, secrets or private imagery published; no production modification or PR merge.


## 2026-11-22 — M3.11 / opt-in 512 MB synthetic streaming boundary

**Pre-change HEAD:** 0cd321b3016c3192e24f423d94619a489b593e89; branch compare identical (ahead=0, behind=0). PR #4 OPEN, draft=true, merged=false; head SHA matched. GitHub Actions on pre-change SHA: UI smoke 45007165731 SUCCESS, raster safety 45007165757 SUCCESS, rules/dataset safety 45007165707 SUCCESS. Preview publish not independently confirmed; CircleCI exact-SHA not rechecked in this change.

**Change:** 00d7a22c548c7fe74df4ca14e0a92901497af510 modifies only `tests/test_vision_private_corpus_stage.py`: opt-in `VISION_RUN_512MB_BOUNDARY=1` synthetic sparse PDF test for 511999999 / 512000000 / 512000001 bytes, repeated three times; real streamed SHA-256 is independently calculated, source status, verified count and training gates are checked. Default CI skips this heavy test to avoid unbudgeted disk/time use. The test observes process high-water memory but DOES NOT enforce a portable absolute RAM ceiling; an isolated resource-budget runner is still needed. No customer files are used.

**Verification:** actual 512 MB opt-in execution NOT PERFORMED in this cycle; no performance, RAM ceiling or three-pass PASS claim. Post-change GitHub Actions and CircleCI pending. Review-stage two-voice/adjudication triple run, Chromium 404/MV3 real anonymous reference_state, PDF --all real audit and preview publish remain unverified.

**Gates:** independent verified real ROI, trusted constructor/physical mm scale/print method, PDF ICC/spot and verified family holdout missing. `training_ready=false`, `production_approved=false`; unknown => MANUAL. No private customer files, original names, raw SHA or HMAC keys published. No production change or PR merge.


## 2026-11-22 — M3.12 / portable opt-in 512 MB memory observation

**Pre-change HEAD:** 2b7e5f1d2f4a277fd7db0c6dc990cebdba3e0281; compare identical; PR #4 OPEN, draft=true, merged=false, head feature/printcheck-vision-copy-v01. GitHub Actions on pre-change SHA: UI smoke 45021795689 SUCCESS, raster safety 45021795752 SUCCESS, rules/dataset safety 45021795699 SUCCESS. CircleCI vision-contract and vision-raster SUCCESS. Exact-SHA preview publish NOT VERIFIED.

**Change:** b838b76202b7c7488cd736ad8ca84b1929a09b9a changes only tests/test_vision_private_corpus_stage.py. Opt-in 512 MB three-pass test replaces unconditional POSIX-only `resource` import and nonportable same-process ru_maxrss high-water comparison with `tracemalloc` allocation observation. `tracemalloc` is explicitly NOT an RSS measurement and proves no absolute RAM ceiling. Existing streamed SHA, 511999999/512000000/512000001-byte boundaries, training-off assertions and opt-in guard remain. This is a portability correction, not resource certification.

**Verification:** No independent local Python execution or opt-in 512 MB three-pass execution performed in this cycle. CI on new HEAD pending; do not claim PASS. Next task: separate bounded subprocess with real peak RSS, timeout and explicit disk/RAM budget, followed by 3x synthetic execution. Real ROI dual votes/adjudication, verified constructor/print process/physical scale, ICC/spot, family holdout and anonymous 404/MV3 reference_state remain UNVERIFIED. training_ready=false; production_approved=false; unknown => MANUAL. No private customer files, SHA, names, keys or images uploaded; no production changes or PR merge.


## 2026-11-22 — M3.13 / synthetic private HMAC rotation regression

**Pre-change HEAD:** 6cf733cc25a3c11ab1fc3d8092ad02b6ed380dd7; branch identical, PR #4 open/draft=true/merged=false. GitHub Actions on pre-change HEAD: UI smoke 45043389819 SUCCESS, raster safety 45043389826 SUCCESS, rules/dataset safety 45043389874 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Exact-SHA preview publish NOT VERIFIED.

**Change:** 8d1a64ec3b3f5a9a39591a49b11883965c447964 modifies only tests/test_vision_private_corpus_stage.py, adding a synthetic regression for rotation of the private HMAC grouping key. It asserts both family/content pseudonyms change, verified synthetic PDF count stays stable, no automatic training is enabled, and no raw family identifier appears in the serialized review output. No real customer data, SHA, key or original filename was uploaded.

**Post-change observation:** branch comparison identical, PR #4 still open/draft=true/merged=false. GitHub Actions runs and CircleCI statuses were not yet returned for the changed SHA. The new test has NOT been independently executed in this cycle. No success claim on new HEAD. The 512 MB x3 opt-in resource test and independent child-process peak RSS/time budget remain unexecuted/unimplemented.

**Outstanding:** exact-HEAD UI/raster/rules CI, CircleCI and preview publish; 3x independent ROI votes/adjudication; real anonymous authenticated 404/MV3 reference_state; PDF --all and ICC/spot; trusted physical mm scale and print method; verified real ROI/family holdout. training_ready=false; production_approved=false; unknown => MANUAL. No production modification, PR merge or public customer upload.


## 2026-11-22 — M3.14 / deterministic private HMAC rotation regression

**Pre-change HEAD:** 6794ec274f0a0b907bf1eba269fef4010de0e34d; PR #4 OPEN, draft=true, merged=false, head branch feature/printcheck-vision-copy-v01. Exact-SHA GitHub Actions: UI smoke 45049507142 SUCCESS, raster safety 45049507129 SUCCESS, rules/dataset safety 45049507099 SUCCESS. Preview publish not verified; CircleCI exact-SHA not independently verified.

**Change:** 74f8719c3b3c5babc00c0c6ae36f1a7e0500a81e updates only tests/test_vision_private_corpus_stage.py. Synthetic HMAC rotation test now repeats the rotated-key staging three times and asserts stable family/content pseudonyms, identical summaries, and automatic_training_enabled=false; restoring the original key must reproduce both original pseudonyms. No real data or secrets used.

**Verification:** new test NOT independently executed locally; new-HEAD CI pending at write time. 512 MB x3 opt-in streaming/RSS budget still unverified. No real dual-voice ROI/adjudication, proven constructor/physical mm/process, ICC/spot, verified family holdout or authenticated anonymous 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No production files modified, PR merge or customer material upload.


## 2026-11-23 — M3.15 / triple synthetic independent ROI adjudication regression

**Pre-change HEAD:** 792e806cfaae3d195004bfc67d4c5179d36c4301, branch compare identical. PR #4 OPEN, draft=true, merged=false confirmed via GitHub API before write. Exact pre-change GitHub Actions: UI smoke 45054540842 SUCCESS, raster safety 45054540859 SUCCESS, rules/dataset safety 45054540930 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA NOT VERIFIED.

**Change:** 781f4656960f5ed098375a453d651cb4c0ed4bdb updates only tests/test_vision_roi_review.py. Adds three separate synthetic ROI proposals with two independent conflicting expert votes and a third independent adjudicator; checks DISAGREEMENT_NEEDS_ADJUDICATION then ADJUDICATED_RESEARCH_ONLY, uncertain label, physical_scale_verified=false, training_approved=false and no automatic training. This is a synthetic test of workflow safety, NOT three real independent expert reviews.

**Verification:** new test NOT independently executed locally; post-change CI not yet verified at entry time. No real customer material, filenames, hashes, keys or expert answers uploaded. The 512 MB x3 resource/RSS bounded runner is still missing and opt-in 512 MB execution unverified. Four-contour preview publish not confirmed. Chromium 404/MV3 anonymous reference_state, PDF --all real audit, physical mm constructor/process, ICC/spot and verified family holdout remain UNVERIFIED. training_ready=false; production_approved=false; unknown => MANUAL. No production changes or PR merge.


## 2026-11-23 — M3.16 / proposer-independence adjudication regression

**Pre-change HEAD:** 118747dd9bb6851a69c19e6eb1c49b7c4bd3ec2d; PR #4 OPEN, draft=true, merged=false confirmed via GitHub connector. Exact-head GitHub Actions: UI smoke 45065934536 SUCCESS, raster safety 45065934585 SUCCESS, rules/dataset safety 45065934503 SUCCESS. CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA NOT VERIFIED.

**Change:** 78bcb1b32727a7417ff6ed3a569bd9ebb4a8d412 updates only tests/test_vision_roi_review.py: three synthetic disagreement cycles verify that the original ROI proposer cannot serve as the third adjudicator; rejection must leave the case awaiting adjudication and training unapproved. No production module or private material changed. This is a regression test for existing independence enforcement, not new real expert evidence.

**Verification:** Test not independently executed in this cycle. Post-change CI and CircleCI pending at log-writing time; no PASS claim for changed SHA. Optional 512 MB triple run with measured peak RSS, preview publish, authenticated anonymous 404/MV3 reference_state, real PDF --all, dual real expert ROI, verified constructor/physical scale/print method, ICC/spot and verified family holdout remain UNVERIFIED. training_ready=false; production_approved=false; unknown => MANUAL. No customer data, SHA, keys or original filenames uploaded. No PR merge.


## 2026-11-23 — M3.17 / malformed ROI print-process metadata fail-closed

**Pre-change HEAD:** 7f530aec3e4006d274a9de40e36b3119d947f5d5, branch compare identical; GitHub PR search with is:draft returned PR #4, open issue record (no merge). Exact pre-change GitHub Actions: UI smoke 45072088757 SUCCESS, raster safety 45072088696 SUCCESS, rules/dataset safety 45072088699 SUCCESS. CircleCI vision-contract and vision-raster success. Exact-SHA preview publish NOT VERIFIED.

**Changes:** 0df3311e72e513e7ed08a434c7862921185e2a78 in tools/vision_roi_review.py rejects non-string kind/units/technology with controlled ROI_CLASS_OR_TECHNOLOGY_INVALID instead of allowing regex TypeError on malformed technology. 59e953372ff523b2fa9239b4736f3c5347f2926f adds three synthetic cycles checking None, number, bool, list, mapping and invalid-space process metadata, zero ROI cases, zero training approval and automatic_training_enabled=false. No customer data used.

**Verification:** The new test has NOT been independently executed in this cycle; new-HEAD CI remains to be checked. Existing successful CI is for pre-change HEAD only. No real accuracy claim. Still outstanding: four-contour preview publish, optional 512 MB x3 with independent process peak RSS and timeout, real dual independent ROI/adjudication, constructor/print method/physical mm proof, ICC/spot, verified family holdout, PDF --all real local audit and anonymous authenticated 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No production changes, PR merge or private uploads.


## 2026-11-23 — M3.18 / opt-in Linux child RSS/time watchdog (synthetic only)

**Pre-change HEAD:** ef309451d8487423e098f77ccf676d566febdaa8 (branch identical). PR #4 open/draft=true/merged=false, head feature/printcheck-vision-copy-v01. Exact pre-change GitHub Actions UI smoke 45083248811 SUCCESS, raster safety 45083248635 SUCCESS, rules/dataset safety 45083248657 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish exact-SHA NOT VERIFIED.

**Changes:** 2ca65a4f16405b1ccf244b1c11d8e3682425bbba adds tools/vision_resource_runner.py; 67848bd5667655304c42ec52805bb23706d4e47c adds tests/test_vision_resource_runner.py. Linux-only /proc child watchdog monitors sampled VmRSS, kills on RSS budget/timeout, fails closed on missing measurements or child errors. The opt-in runner launches only the existing synthetic 512MB x3 boundary unittest with VISION_RUN_512MB_BOUNDARY=1; stdout/stderr suppressed, no customer data accepted. Windows/non-Linux remains unsupported rather than claiming RSS coverage. RSS is sampled, not a guaranteed instantaneous high-water mark or OS-enforced memory ceiling. The 512MB file is sparse but its streamed SHA reads real bytes; no large synthetic data enters normal CI.

**Local verification:** Four new lightweight Python unittests PASS in isolated Linux container (three small subprocess repeats, timeout, RSS over-limit and nonzero child exit). Initial local test failed due to transient VmRSS absence during child startup/exit; corrected before commit. Full 512MB nine-boundary test was NOT executed; resource budget and disk availability require separate opt-in execution. Post-change GitHub Actions/CircleCI results not yet verified at log-writing time. No production code or customer material changed.

**Open blockers:** exact-new-HEAD UI/raster/rules and preview publish; 512MB x3 full run with independent peak RSS/time (sampling alone insufficient for strict limit certification); 3x real dual independent ROI/adjudication, verified constructor/physical mm/print method, ICC/spot, verified family holdout, local real PDF --all, anonymous authenticated 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. PR not merged.


## 2026-11-23 — M3.19 / Linux kernel VmHWM transient RSS detection

**Pre-change HEAD:** 04b610f2cc63bd34b39a827e26ecc3a30a213243; PR #4 open/draft=true/merged=false, exact experimental branch confirmed. GitHub Actions UI smoke 45093939787 SUCCESS, raster safety 45093939788 SUCCESS, rules/dataset safety 45093939837 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish exact-SHA NOT VERIFIED.

**Changes:** d2917157a0a713f68b60af82c04a78aed17a0327 updates tools/vision_resource_runner.py to use max(VmRSS, VmHWM) from Linux /proc/<pid>/status and fail closed when either metric is missing/malformed. c921cc901275032ecae4d7c6a33d48cd67bdf86b adds three synthetic high-water fixture repetitions plus malformed/missing VmHWM cases to tests/test_vision_resource_runner.py; ef3719613a66a73fd98a2804270c29713ab29c0b corrects fixture string escaping. All edits confined to experimental tools/tests. No production changes or customer material.

**Verification:** Connector read and PR metadata confirmed. Local git checkout and independent Python test execution unavailable because github.com DNS resolution failed in isolated test container. Post-change CI and CircleCI not yet verified at log-writing time. This tests the kernel high-water reading contract, NOT a measured 512 MB boundary run or a guaranteed OS-enforced memory limit. The child can exceed the budget before the watchdog polls; fail closed upon observed VmHWM.

**Outstanding:** exact-new-HEAD CI and preview publish; optional 512MB x3 nine-case test with independent peak RSS/time; real two independent expert ROI votes/adjudication; verified constructor, physical mm scale and print method; ICC/spot; verified family holdout; private PDF --all; anonymous authenticated 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No customer data, SHA, original filenames, keys or private PDFs uploaded; PR not merged.


## 2026-11-23 — M3.20 / synthetic CLI opt-in safety regression

**Pre-change HEAD:** b337cb8f75604507cd7d15dd32f42538296edbc6; PR #4 found by GitHub is:open is:draft search; branch identical before write. Exact-head GitHub Actions: UI smoke 45130602714 SUCCESS, raster safety 45130602628 SUCCESS, rules/dataset safety 45130602562 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish exact SHA NOT VERIFIED.

**Change:** a9c42fcbaa3205430952edf705efb45c426be6aa adds only tests/test_vision_resource_optin_guard.py. Three synthetic subprocess repetitions assert that CLI without VISION_RUN_512MB_BOUNDARY=1 fails with OPT_IN_REQUIRED and never reports RESOURCE_REGRESSION_PASS. Does not execute any 512 MB test or use customer files.

**Verification:** Python syntax and one unittest with three subprocess repetitions passed in isolated Linux using a stand-in guard script, NOT the repository's actual runner; actual integrated test and post-change CI remain UNVERIFIED at log-writing time. Full 512 MB nine-case opt-in run not performed. Other unresolved: preview publish, real dual independent ROI/adjudication, proven constructor/physical mm/print method, ICC/spot, verified family holdout, private PDF --all, anonymous authenticated 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No production changes, private uploads or PR merge.


## 2026-11-23 — M3.21 / malformed 512 MB opt-in guard regression

**Pre-change HEAD:** daf3f7578396b0e3a52d5ad9fef75b63641b87e0. PR #4 OPEN, draft=true, merged=false, head feature/printcheck-vision-copy-v01 confirmed via GitHub connector immediately before change. Exact-head GitHub Actions: UI smoke 45136320190 SUCCESS, raster safety 45136320200 SUCCESS, rules/dataset safety 45136320124 SUCCESS; preview publish exact SHA NOT VERIFIED. CircleCI exact-head NOT VERIFIED.

**Change:** 153650410c8f2625be46b7eca06fd94a12df50f9 changes only tests/test_vision_resource_optin_guard.py: three synthetic repeats now test missing, '0', 'true', '1 ' and empty VISION_RUN_512MB_BOUNDARY. All must reject without reporting RESOURCE_REGRESSION_PASS. This extends the existing actual-runner subprocess test without running the 512 MB workload, changing production code or accessing customer data.

**Verification:** Actual integrated Python test NOT independently executed in this cycle (isolated container cannot resolve github.com); exact-new-HEAD GitHub Actions and CircleCI remain to be checked. No 512 MB boundary execution or memory certification claimed. Open: preview publish, 512 MB nine-case opt-in run with RSS/time budget, real independent dual-voice ROI and adjudication, proven constructor/physical mm/print method, ICC/spot, verified family holdout, private PDF --all and authenticated anonymous 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No private data, secrets, original filenames or SHA uploaded; no PR merge.


## 2026-11-23 — M3.25 / non-finite resource budget fail-closed (synthetic)

**Pre-change HEAD:** 5369d56aed0b38b0f35ccc45b169b6b200471473. GitHub PR #4 confirmed OPEN, draft=true, merged=false and exact experimental head before each write. Exact pre-change GitHub Actions: UI smoke 45173109373 SUCCESS, raster safety 45173109524 SUCCESS, rules/dataset safety 45173109474 SUCCESS. Exact-SHA preview publish and CircleCI NOT VERIFIED.

**Changes:** ac69bd9a6ec4e94b2c3654793752e138dc4141d8 modifies only tools/vision_resource_runner.py: reject NaN and infinite timeout/poll intervals before spawning a child, in addition to existing nonpositive budget checks. 7ef587fab1f218d0ff84af5e359cac671f3dc727 modifies only tests/test_vision_resource_runner.py: three synthetic repetitions of six non-finite timing combinations, asserting INVALID_RESOURCE_BUDGET and no child spawn. No customer inputs or heavy 512 MB allocations.

**Verification:** Changes and test source committed through GitHub connector. Independent integrated Python execution and exact-post-change CI were NOT yet verified when this entry was written (isolated container cannot resolve github.com). The existing watchdog still cannot guarantee a peak RSS observation if a child exits before the first valid /proc measurement; kernel-enforced cgroup v2 remains a research task. No claim of OS-enforced memory cap or real 512 MB run.

**Outstanding:** exact-new-HEAD four-contour CI (especially preview publish), CircleCI, optional 512 MB x3 nine-case resource test, real dual independent ROI votes/adjudication, verified constructor/print process/physical mm scale, ICC/spot, verified family holdout, local private PDF --all and authenticated anonymous 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No production modifications, PR merge, private customer PDFs, names, SHA, HMAC keys or expert answers uploaded.


## 2026-11-23 — M3.27 / Python syntax repair in resource watchdog

**Pre-change HEAD:** 559ab9156f7c90906dde2d6168ee9ca2b69ab614; compare identical, PR #4 returned by GitHub is:open is:draft search. Exact pre-change Actions UI 45183829923 SUCCESS, raster 45183829803 SUCCESS, rules 45183829900 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA not confirmed.

**Change:** c38bf1bcc5bde4a6466f7264632a1d2fc69f6fc0 fixes literal escaped \\n sequences in tools/vision_resource_runner.py duplicate VmRSS/VmHWM guard which made the Python module syntactically invalid. bb4a690cc72b5d5a2b55e8b891dfa376e0b024c4 adds three compile(source, path, 'exec') regression repetitions in tests/test_vision_resource_runner.py. Changes restricted to experimental tools/tests; no customer data.

**Verification:** connector source inspection confirmed escaped characters before fix; independent integrated test execution and post-change CI pending, not asserted PASS. The new syntax test is synthetic only. Kernel-enforced RSS ceiling/cgroup v2, 512 MB nine-case opt-in, verified dual ROI/adjudication, constructor/physical mm/process, ICC/spot, family holdout, real private PDF --all, authenticated anonymous 404/MV3 reference_state and preview publish remain UNVERIFIED. training_ready=false; production_approved=false; unknown => MANUAL. No production modifications, private uploads or PR merge.


## 2026-11-23 — M3.28 / reject noninteger synthetic RSS limits before child spawn

**Pre-change HEAD:** 7242fdb676475c220f1883d03859ba4737498427; PR #4 OPEN/draft=true/merged=false, correct experimental head verified by GitHub connector. Exact pre-change Actions UI smoke 45205112976 SUCCESS, raster safety 45205113133 SUCCESS, rules/dataset safety 45205113245 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA NOT VERIFIED.

**Changes:** 9b2eb074cdd41c26ea73a42bb77c8a3d21465d84 updates only tools/vision_resource_runner.py to reject noninteger RSS budgets (including NaN/infinity/boolean) before subprocess spawn. 2d1d830e1f281ae083e300f4c44ecd29df3def89 updates only tests/test_vision_resource_runner.py with three synthetic repetitions for seven invalid RSS budget types; each requires INVALID_RESOURCE_BUDGET and no child spawn. No production code or customer data touched.

**Verification:** GitHub connector confirmed PR state before each write. The tests were committed, but independent integrated execution and post-change GitHub Actions/CircleCI were NOT verified when writing this entry. No full 512 MB run or OS-enforced peak memory guarantee claimed. The child-exit /proc VmHWM race remains an open problem; cgroup v2 is a candidate, not implemented.

**Outstanding:** exact-new-HEAD four-contour CI (especially preview publish), optional 512 MB x3 nine-case run, dual independently reviewed real ROI/adjudication, proven constructor/print method/physical scale, ICC/spot, verified family holdout, private PDF --all, anonymous authenticated 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. PR not merged; no private files, hashes, names, keys or expert votes uploaded.


## 2026-11-23 — M3.29 / reject nonnumeric synthetic time budgets before spawn

**Pre-change HEAD:** cd230f7e0cc7a7b0f1802c0822cd4d3f21409608. PR #4 OPEN/draft=true/merged=false, correct experimental head confirmed before writes. Exact-head GitHub Actions: UI smoke 45214971282 SUCCESS; raster safety 45214970970 SUCCESS; rules/dataset safety 45214971325 SUCCESS. CircleCI vision-contract and vision-raster SUCCESS. Preview publish exact-head NOT VERIFIED.

**Changes:** 38ca3ee1fd8d143eda64af3a755accca519e8f30 updates only tools/vision_resource_runner.py: reject nonnumeric timeout_s/poll_s (including strings, None, bool, collections) with INVALID_RESOURCE_BUDGET before subprocess spawn. b2cc2f90f77a97f13bde15b21ab9d932a8f5888b updates only tests/test_vision_resource_runner.py: three synthetic repetitions of eight invalid time-budget combinations, requiring INVALID_RESOURCE_BUDGET and zero child spawns. No 512 MB allocations, production code or customer data.

**Verification:** source/test changes committed via GitHub connector. Independent integrated execution and exact-post-change CI not verified at log-writing time; do not claim PASS. The child-exit /proc VmHWM race and lack of OS-enforced peak RSS guarantee remain unresolved (cgroup v2 research required). No full 512 MB test was run.

**Outstanding:** four-contour CI especially preview publish; optional nine-case 512 MB test; independent real dual-voice ROI/adjudication; proven constructor, physical mm scale and print process; ICC/spot; verified family holdout; private PDF --all; authenticated anonymous 404/MV3 reference_state. training_ready=false; production_approved=false; unknown => MANUAL. No private data, filenames, hashes, keys, expert votes or customer PDFs uploaded; PR not merged.


## 2026-11-23 — M3.30 / bounded streaming SHA verification for private PDF audit

**Pre-change HEAD:** ed43e786d9542f97191e5a704b3019bf0bc5bed1; PR #4 OPEN, draft=true, merged=false, correct experimental head verified before each write. Exact pre-change GitHub Actions: UI smoke 45227827446 SUCCESS, raster safety 45227827487 SUCCESS, rules/dataset safety 45227827609 SUCCESS. CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA NOT VERIFIED.

**Changes:** 0d759e0500b5ed72d7d324cb72f34f81cf68d0d4 modifies only tools/vision_pdf_audit.py: local audit_sample SHA validation now streams in 1 MiB chunks, checks MAX_FILE while reading, and returns MANUAL on oversize or I/O failure instead of allocating an entire original with read_bytes(). 4d8965533e888ab824ea528d195d8cca652f5d0f modifies only tests/test_vision_pdf_audit.py: three synthetic repetitions assert no Path.read_bytes() is used, verify RESEARCH_ONLY with no training/production approval, and reject a tampered synthetic source. No client documents or identifying metadata committed.

**Verification:** Source and regression test committed via GitHub connector. Independent integrated test execution and exact post-change CI NOT VERIFIED when written; test PASS not claimed. No 512 MB opt-in run. This change does not prove PDF colors, actual ink width, physical scale or print acceptance. All unknowns => MANUAL.

**Outstanding:** four exact-head CI contours (especially preview publish), CircleCI, independent ROI two voices/adjudication, proven constructor/print method/physical mm, ICC/spot, verified family holdout, private PDF --all, anonymous authenticated 404/MV3 reference_state, 512 MB nine-case opt-in, kernel-enforced RSS/cgroup v2. training_ready=false; production_approved=false. No production changes, private uploads, automatic training or PR merge.


## 2026-11-24 — M3.35 / bounded verified PDF snapshot, source-swap regression

**Pre-change HEAD:** 379a9203dfdea16b19e468322d53799ec45b9834. GitHub PR #4 confirmed OPEN, draft=true, merged=false, correct experimental head. Exact pre-change GitHub Actions: UI smoke 45238021672 SUCCESS, raster safety 45238021635 SUCCESS, rules/dataset safety 45238021588 SUCCESS; CircleCI vision-contract and vision-raster SUCCESS. Preview publish on exact SHA NOT VERIFIED.

**Changes:** 86f11b412fc68611697aebe6e95f0bd77f3aacee modifies only tools/vision_pdf_audit.py: audit_sample streams source into a local owner-only temporary snapshot (16 MB ceiling), validates SHA-256 of the copied bytes, and gives the PDF engine the verified snapshot rather than the mutable original path. TemporaryDirectory cleanup runs on success, checksum failure and backend failure. 3f9b5a010367d56664a1de5795b2be1df257f0de adds three synthetic source-replacement cycles and a backend-failure cleanup/privacy test in tests/test_vision_pdf_audit.py. Only synthetic test bytes; no client data committed.

**Verification:** connector confirmed branch/PR state before each write. The new Python regressions have NOT been independently executed in this cycle, and post-change GitHub Actions/CircleCI have NOT yet been verified; do not claim PASS. Snapshot isolation addresses source replacement after verification, but cannot certify an adversarial local filesystem, PDF engine internals, ICC/spot, physical scale, or actual printed geometry. Local temporary copy is intentionally bounded, not an external upload.

**Outstanding:** exact-head four CI contours including preview publish; independent three-pass Python execution; two independent real ROI reviews/adjudication, verified constructor and print process/physical mm, ICC/spot, verified family holdout, private PDF --all, anonymous authenticated 404/MV3 reference_state, optional nine-case 512 MB test and cgroup v2. training_ready=false; production_approved=false; unknown => MANUAL. No production modification, private uploads, training or PR merge.


## HISTORY-001 — 2026-11-26 — durable recovery protocol and Trainer source snapshots

Base HEAD 096208c9f1a00388ac120c0078aa57291b38a4b3, feature/printcheck-vision-copy-v01, PR #4 open/draft/not merged verified. Base GitHub PR runs: UI 45288268200 SUCCESS; raster 45288268263 SUCCESS; rules/dataset 45288268243 SUCCESS. CircleCI vision-raster and vision-contract SUCCESS. Preview publish NOT VERIFIED.

Added docs/VISION_PROJECT_STATE_RU.md at commit 4c9ca98461f5279ed1aa0e88dca4ea769df9f1a3: canonical recovery entry point, append-only DEVLOG workflow, module index, privacy boundaries, test/CI evidence policy, local backup and restoration protocol, pending Trainer migration and research priorities. Documentation only; no production or CI workflow changes.

Recovered all three previously delivered Trainer ZIPs locally and verified archive CRC. Three independent runs of Python unittest from Archive Trainer 0.2.0: test_archive_trainer (7), discussion/test_vision (9), visual/test_visual (32), total 144/144 PASS in Linux. Not a real-world accuracy test; Windows and live gifts.ru crawl not tested. Local source-only Git bundle created from 52 allowlisted files (3 reconstructed version commits); git bundle verify, clean clone, git fsck --full and per-file SHA-256 comparison PASS. Local source identifiers are recorded in project state; they are not GitHub commits. No private datasets, reports, model weights or attachments included in the bundle. Direct git access from container blocked by DNS; Trainer source migration to public experiment remains PENDING. New documentation HEAD CI not yet verified at time of writing.

Next: preserve the source-only Trainer version history in the experimental branch after independent source review, then fix BADGE_UNKNOWN and PDF copy-time mutation regression. All previous real ROI, family holdout, scale, technology, color/ICC, private PDF --all, 404/MV3, and 512 MB blockers remain. training_ready=false; production_approved=false; unknown => MANUAL. No PR merge, no private uploads, no real training.


## ADAPTIVE-001 — 2026-11-26 — expandable residual learner, local Trainer 0.2.1
Base HEAD 9bf18717aca5955041b0c542a10602e24b2b88be, draft PR #4 open/not merged verified. UI smoke 45755376563, raster safety 45755376551, rules/dataset safety 45755376540 all SUCCESS; CircleCI vision-raster and vision-contract SUCCESS. Preview publish NOT VERIFIED.
Local Archive Trainer 0.2.1 added adaptive.py, adaptive_demo.py, test_adaptive.py, dashboard button and TEST.cmd inclusion. Existing baseline remains frozen; zero-output residual blocks preserve logits at insertion, then optimize newly added weights on synthetic reviewed train only. Checkpoints are JSON, parent-linked and content-addressed; old weights remain accessible; parameter editing forks a checkpoint. Train-only residual association ranking proposes feature-pair inputs, not causal knowledge. New labels pending, not trainable yet. No real adaptive training, no automatic candidate promotion.
Three independent Linux unittest cycles (7 archive + 9 discussion + 32 visual + 9 adaptive): 171/171 PASS. Synthetic demonstration: 28,020 holdout pixels; baseline and candidate thin-positive precision/IoU 0.956848 and recall 1.0, identical abstention 0.001249; no improvement established. 8 associations ranked, 4 used. No real-world accuracy evidence. Windows GUI not tested. Source-only local Git bundle extended to tag vision-archive-0.2.1, commit f7efe915fab1d4d7c4adc4dabd270f8882c91e02, 34 files for new version. Bundle verify, clean clone, fsck, file diff PASS. Direct Git DNS failure reconfirmed; Trainer source migration to GitHub still pending. No client data or real weights in bundle. Recovery index updated in bc8f2b8e0215735a8c3dbc7aebec8a84dcd64e25; only documentation changes remotely.
Next: separate dev-validation/final holdout, safe dataset migration/replay and forgetting guard, new-class output expansion, evidence-linked relation graph. Preserve existing BADGE_UNKNOWN, PDF/ROI/scale/ICC/holdout/512MB/404 blockers. New HEAD CI not yet verified at writing. training_ready=false; production_approved=false; unknown => MANUAL.


## WORKSPACE-001 / EXPERT-WEIGHTS-001 — 2026-11-26
Base d8881074cf58a21686e5a322f1a9aa8411d2a05f verified draft PR #4. GitHub UI 45757342031, raster 45757341930, rules 45757342252 SUCCESS; CircleCI vision-raster/vision-contract SUCCESS. Preview publish NOT VERIFIED. Local releases recovered: Archive Trainer 0.3.0 (reviewer UI, heuristic visual preview), 0.3.1 (expert exchange), 0.3.2 (workspace_manager.py, analysis_export.py, dashboard and 10 new tests). New Windows default D:\vaidata; verified closed-workspace copy into empty target, original preserved; no merge; actual Windows migration not tested. Explicit offline numeric baseline/adaptive tensor export and aggregate-only option; existing request IDs and answers/ratings remain compatible; no raw client metadata or private text vocabulary in export. Authorized transfer only, no real weights in GitHub. Three independent Linux regression cycles 77 each, 231/231 PASS; Linux/Xvfb dashboard startup PASS. Source-only history bundle restored and git fsck/file diff PASS; local HEAD 82c710a755b577ca4eca41b95f058ef94a6a7b6c (not a remote commit). Project state updated at 07766a62d033f2d4f1d557e6fbf5dfec8a583633. Trainer source migration to GitHub pending; remote changes documentation only, new CI not yet verified. Production unchanged, PR remains draft, unknown => MANUAL, real training/evidence gates retained. Next: user imports authorized diagnostic request and grades answers; continue independent verified ROI/scale/ICC/family holdout and source migration.
