# PrintCheck v24 — журнал изменений 2026-10-08

Входная обратная связь: v23 на синем LM1 логотипе заказа 7967900 показывает 70 маркеров: positive=16, negative=54. Пробелы стали существенно лучше, но многие реальные тонкие синие линии не определяются.

Root cause подтверждён искусственными и golden тестами: 1px stroke имеет нулевой Sobel `phaseNormal`, поэтому SWT его вообще не трассирует. 2px stroke обнаруживается.

Реализована гибридная positive-ветка:
- основная SWT-классификация не меняется;
- при нуле SWT на missing-компоненте резервная проверка по Euclidean local diameter и disk opening;
- shallow opening residue на внешнем крае отсекается depth/extent фильтрами;
- устойчивые свободные 1px линии и присоединённые 1px штрихи возвращаются как positive;
- negative-ветка не изменялась.

Source: `eea6d0688bb15790beb3d2e539f173ff74841cad`
Main: `430d8e7f71c96375efac55e5d832d6710560093a`
Workflow: `37757876595`
Algorithm: `PrintCheck-coverage-swt-v24-pixel-stroke-recovery`
Cache: `20261008-2`
Bundle SHA-256: `cd4911b4cfcacee70f3b6630213221b5a3d00263f4db252700cce852e3e2b11b`
Unit: 115/115 passed.
precheck/publish/browser_verify: success.

Следующий тест пользователя — тот же исходный синий LM1 artwork. Без него нельзя утверждать, что все реальные линии найдены.
