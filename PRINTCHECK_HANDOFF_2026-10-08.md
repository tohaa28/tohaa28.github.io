# PrintCheck — handoff snapshot 2026-10-08

## Текущая точка

Работаем только над модулем PrintCheck в Макетной. Остальные рабочие части проекта без отдельного запроса не менять.

Репозиторий: `tohaa28/tohaa28.github.io`
Source branch: `gifts-layout-workbench-mockups-source`
Функциональный source commit: `6a8d800a5d0006c1577f229704b91663baec691c`
Published main: `6db3059d78e81b67e41c3d59ee9cab4625610b9d`
Workflow run: `37755818416`

Результат:
- precheck — success
- publish — success
- browser_verify — success
- unit tests — 110/110 passed

Алгоритм:
`PrintCheck-coverage-local-v23-control-circle-topology`

Cache chain:
`20261008-1`

Patcher expected bundle SHA-256:
`2943354870275bb5b2755459a3017f30fc5c354509d4bd1844565e658f5ad7d4`

## Почему понадобился v23

Пользователь проверил v22 на том же синем LM1-растре 32×32 мм при 1048 dpi. Результат оставался неправильным:
- всего 724 markers;
- positive/линии: 392;
- negative/пробелы: 332;
- минимальный измеренный размер около 0.02 мм;
- markers снова шли по обычным контурам и границам толстых элементов.

При 1048 dpi один исходный пиксель имеет размер около 0.024 мм. Следовательно, характерное значение 0.02 мм подтвердило, что алгоритм принимал однопиксельную растровую геометрию/антиалиасинговую кайму за физический дефект.

## Что изменено в v23

### 1. Single-ink coverage geometry

Для одноцветных технологий больше не используется правило «любой пиксель, немного отличающийся от фона, является краской».

Теперь:
- для прозрачного artwork геометрия строится по alpha coverage с рабочей границей 50%;
- для непрозрачного фона coverage вычисляется относительно фонового цвета и фактических направлений/ядра найденных цветов;
- слабая anti-alias fringe не входит в физическую бинарную геометрию;
- настоящий сплошной тонкий штрих сохраняется.

Это особенно важно для LM1/black-white/single-color.

### 2. Positive: control-circle topology

После disk opening анализируется connected missing component:
- shallow missing-компонента, прилегающая к одному массивному телу, считается контурной шероховатостью/raster fringe и отбрасывается;
- реальный bridge между двумя массивными частями сохраняется;
- длинный thin spur сохраняется;
- standalone thin line сохраняется;
- существующие taper/end-cap/corner filters сохранены.

Для классификации используется глубина missing-компоненты относительно opened geometry, а не только локальная ширина пикселя.

### 3. Negative: control-circle topology

Negative больше не основывается только на SWT width:
- строится disk opening белой фазы;
- проверяется missing gap geometry;
- shallow open notch одного connected ink object отбрасывается;
- enclosed narrow knockout остаётся дефектом;
- clearance между отдельными same-ink objects остаётся дефектом;
- глубокий узкий открытый канал остаётся дефектом.

### 4. Новые regression tests

Добавлены тесты:
- faint anti-alias fringe вокруг толстой линии → 0 positive, 0 negative;
- реальный solid sub-threshold stroke → найден;
- shallow open raster notch → не negative;
- deep narrow open channel → negative.

Общий suite: 110/110 success.

## Что не менять

Не откатывать:
- physical field size fixes;
- field/template size labels;
- automatic mask UI;
- single-ink policy;
- colour-boundary suppression;
- isolated-object visible-geometry logic;
- status «поиск мелких элементов...»;
- worker/cache chain;
- marker circles without centre dots;
- остальную Макетную/Mockup Editor.

## Следующий обязательный реальный тест

Повторно открыть тот же заказ/арт:
- заказ 7967900;
- артикул 15637;
- LM1;
- поле 32×32 мм;
- исходный растр 1048 dpi.

Сравнить с v22:
- v22: 724 total / 392 positive / 332 negative;
- v23 должен убрать markers по массивным синим контурам и shallow white notches.

Если ложные markers останутся, анализировать их по конкретной топологии:
1. boundary fringe;
2. true thin line/bridge;
3. shallow open notch;
4. deep open channel;
5. enclosed gap;
6. detached object.

Не возвращаться к v18–v20 EDT/medial-axis как основному классификатору.
