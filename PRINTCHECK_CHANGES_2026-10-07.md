# PrintCheck — журнал изменений 2026-10-07

## Цель дня

Исправить два основных дефекта:
1. поиск мелких элементов даёт сотни false positive по обычным краям синего одноцветного рисунка;
2. алгоритм стал работать медленнее после перехода на многократный Euclidean Distance Transform.

Параллельно были исправлены отображение физических размеров поля/шаблона и cache chain worker.

## Исходный пользовательский пример

Заказ: 7967900
Артикул: 15637
Нанесение: LM1, лазерная гравировка
Поле: 32×32 мм
Растр: 1048 dpi

Нормы PrintCheck для LM1:
- positive: 0.10 мм;
- negative: 0.20 мм;
- min raster DPI: 300.

Главный визуальный дефект: markers шли цепочками по обычным синим внешним и внутренним границам.

## Изменения по версиям

### v18 — native-raster scan
Algorithm:
`PrintCheck-control-circle-v18-native-raster-scan`

Исправлено:
- raster source с 1–3 px на минимальный элемент больше не отключается автоматически;
- проверка идёт в native resolution;
- stop только если минимум < 1 source pixel;
- появляется предупреждение о pixel quantization.

Проблема:
- геометрические false positives остались.

### v19 — two-sided medial
Algorithm:
`PrintCheck-control-circle-v19-two-sided-medial`

Изменения:
- ось требовала убывания EDT с двух сторон;
- уменьшено число повторных EDT;
- worker cache поднят.

Реальный пользовательский результат:
- 720 markers;
- positive 485;
- negative 235.

Вывод: не помогло.

### v20 — local-max EDT ridge
Algorithm:
`PrintCheck-control-circle-v20-local-max-ridge`

Изменения:
- medial candidate = локальный максимум Euclidean distance transform;
- обычный edge pixel должен был отсеиваться;
- алгоритм стал дешевле по сравнению с направленным v19.

Реальный пользовательский результат:
- 586 markers;
- positive 484;
- negative 102.

Вывод: главный класс ошибки сохранился. Medial-axis / EDT-ridge не использовать как основной детектор для реального растрированного artwork.

### Исследование альтернатив

Были изучены:
- Stroke Width Transform (SWT);
- morphological opening диском;
- distance transform / medial axis;
- skeleton pruning;
- local thickness / maximal inscribed circles.

Решено перейти на SWT + control-circle confirmation.

### v21 — экспериментальный SWT

Основная идея:
- луч от одной границы штриха к противоположной;
- нормали двух краёв должны быть почти противоположны;
- измеряется реальная ширина полосы;
- для negative аналогично измеряется белый канал между двумя стенками same ink.

Промежуточные attempts и причины остановки:
- `4df947bf...`: потерял open-channel positive, thin spur; corner false positive;
- `c5dff70e...`: появились hole positive и wedge/corner false positives;
- `8dc252b1...`: topology classification всё ещё пропускал wedge;
- `7c8e4da6...`, `805a2378...`: strict ±30° normal check улучшил часть случаев, но wedge regression остался;
- `0500bb...`, `490589...`: дополнительные taper/end support classifiers;
- `cd553f...`, `752b08...`: CI/integration corrections;
- `3d2bdb...`, `9805a3...`: field-view/browser regression corrections;
- `27c8174f...`: SWT + control-circle confirmation, ещё не зелёный.

Все перечисленные v21 commits — экспериментальные, не финал.

### v22 — SWT + disk opening

Algorithm:
`PrintCheck-swt-open-v22-control-circle-confirmed`

Functional commit:
`3485e8104d61cb7eb862504b7850bd66b782882b`

Workflow:
`37614678089`

Published main:
`e54c4df170fab45d8ea028794e488f5604409143`

Cache:
`20261007-4`

Expected patched bundle:
`daa4951a08f695e89d6263d21dda58eec5a4edcbd56bfcda3d2b3c87ffb40511`

Результат:
- 106/106 unit tests passed;
- precheck success;
- publish success;
- browser_verify success.

Логика positive:
- SWT подтверждает две реальные противоположные границы;
- boundary normals ≈ opposite, допуск около ±30°;
- different colour boundary блокирует измерение;
- disk opening моделирует контрольный круг;
- defect только на пересечении SWT-candidate и control-circle failure;
- topology filter убирает свободные wedges/end-caps/tapers.

Логика negative:
- SWT работает по background gap;
- обе стенки должны относиться к same ink;
- one-sided outside background игнорируется;
- foreign ink boundary не считается gap.

Isolated:
- отдельные маленькие объекты считаются отдельно;
- исключаются из positive/negative, чтобы избежать двойного счёта.

## Производительность

Убраны/снижены:
- repeated full EDT per missing component;
- EDT пустой other-ink mask для single-ink;
- дорогая направленная трассировка medialAxis;
- старые edge-based кандидатные цепочки.

SWT ограничивает ray длиной, связанной с текущим threshold, поэтому не должен обходить весь объект для каждого edge pixel.

## Regression invariants

Должны оставаться зелёными:
- thick stroke > threshold -> 0 positive;
- thin straight stroke -> positive;
- thin diagonal -> positive;
- thin zigzag -> positive;
- long uniform spur -> positive;
- wedge/corner convergence -> 0;
- narrow white gap -> negative;
- open outside background -> 0 negative;
- wide gap > threshold -> 0 negative;
- touching different inks -> 0 caused by boundary;
- antialias transitions -> не отдельная ink;
- true detached object -> isolated;
- connected multicolor artwork -> не fragmented isolated;
- dense detached grid -> isolated;
- SVG / PNG / PDF;
- auto light/dark/transparent background;
- source raster never upsampled past source pixels;
- LM1 native raster 1–3 px per minimum still runs.

## UI / размеры Макетной в этот же период

Исправлено:
- PDF size parser больше не умножает `мм` на 10;
- explicit `см` переводятся ×10;
- unitless dimensions не задают physical scale;
- 15637 field = 32×32 мм;
- whole-template view показывает только `Размер шаблона`;
- field view показывает только `Размер поля`.

## Что нельзя потерять при продолжении

- не менять остальную Макетную;
- не возвращать manual mask;
- markers должны быть centered;
- marker diameter = minimum allowed size;
- same-colour positive/negative only;
- no defect at different-colour intersections;
- no chains on ordinary contours;
- raster and vector supported;
- no false OK when source resolution physically cannot support measurement;
- CI must be fully green before declaring published.

## Следующий тест

Пользователь должен прогнать тот же синий LM1 artwork после v22.

Ожидается:
- резкое уменьшение marker count;
- отсутствие chains вдоль обычных контуров;
- yellow only on true narrow blue stroke/bridge;
- cyan only in true narrow white channel;
- faster completion than EDT-heavy versions.

Если пользовательский результат снова неправильный:
- сохранить screenshot;
- классифицировать один конкретный false positive geometry;
- воспроизвести его synthetic fixture;
- менять только SWT/control-circle confirmation;
- не подбирать глобальный threshold под один пример.
