# PrintCheck — изменения 2026-10-08

## Реальный результат v22

Пользователь прислал screenshot одного и того же проблемного синего LM1 artwork:
- field 32×32 мм;
- raster 1048 dpi;
- PrintCheck: 724 markers;
- lines: 392, минимум ~0.02 мм против нормы 0.10 мм;
- gaps: 332, минимум ~0.02 мм против нормы 0.20 мм.

Визуально множество markers находится на обычных наружных/внутренних контурах толстых синих объектов и на мелких растровых выемках белого фона.

## Диагноз

1048 dpi => ~0.024 мм/px. Значение 0.02 мм означает однопиксельный кандидат.

v22 всё ещё допускал два класса ошибки:
1. single-ink geometry строилась из seed, где даже слабое отклонение от background становилось foreground; anti-alias fringe попадала в физическую маску;
2. negative SWT мог принять shallow open raster concavity за настоящий gap.

## v23

Algorithm marker:
`PrintCheck-coverage-local-v23-control-circle-topology`

Functional commit:
`6a8d800a5d0006c1577f229704b91663baec691c`

Workflow:
`37755818416`

Published main:
`6db3059d78e81b67e41c3d59ee9cab4625610b9d`

Cache:
`20261008-1`

Patcher expected hash:
`2943354870275bb5b2755459a3017f30fc5c354509d4bd1844565e658f5ad7d4`

Tests:
110/110 passed.

### Изменения
- singleInkCoverageMask: 50% coverage contour вместо low-threshold seed;
- transparent artwork: alpha >= 50% для physical geometry;
- opaque artwork: coverage по направлению цвета относительно background и core magnitude;
- componentOpeningDepth для топологической глубины missing geometry;
- positive: shallow one-body missing component отбрасывается как contour fringe;
- negative: disk opening + topology, separate wall components, enclosed gap и channel depth;
- cache chain поднят на 20261008-1;
- browser regression ожидает v23;
- CI guards обновлены.

### Новые regressions
- anti-alias fringe на thick stroke;
- real solid sub-threshold stroke;
- shallow open raster notch;
- deep narrow open channel.

## Статус

precheck success
publish success
browser_verify success

Следующее действие — пользовательская проверка того же синего artwork на опубликованном v23.
