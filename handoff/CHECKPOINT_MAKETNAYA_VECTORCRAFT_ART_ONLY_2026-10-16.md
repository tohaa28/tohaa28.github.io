# Контрольная точка: Макетная + VectorCraft — логотип без рабочего листа
Дата: 16 октября 2026

## Зафиксированное состояние

Полностью работающая и опубликованная версия «Макетной», редактора мокапов, PrintCheck и интеграции VectorCraft. Векторное изображение открывается для редактирования на монтажной области физического размера выбранного поля нанесения. При возврате VectorCraft экспортирует только фактическую видимую геометрию логотипа (visual art bounds), а положение `x, y` и реальные размеры `w, h` передаются в миллиметрах отдельно. Макетная сохраняет сам логотип, его связь с исходным нанесением и корректное положение. Повторное открытие возвращённого SVG проверено.

### Две независимые контрольные ветки

1. **Исходный код**: `checkpoint-maketnaya-vectorcraft-art-only-20261016-source`.
   Зафиксированный commit: `02f4de78bbf79bf57afc83294057e09024980501`.
   Совпадает с проверенным функциональным исходным состоянием `gifts-layout-workbench-mockups-source` до добавления этой записи.
2. **Опубликованный сайт и скомпилированный WebAssembly**: `checkpoint-maketnaya-vectorcraft-art-only-20261016-production`.
   Зафиксированный commit: `55b4674ed444ec8eb5e43f4c96e55fd269f2d81e`.
   Совпадает с опубликованной веткой `main` до добавления этой записи.

Ветка production включает собранный движок:
`gifts-layout-workbench-mockups/vectorcraft/vectorcraft-web-3cf61965e249b54c_bg.wasm`
Git blob SHA: `701c848ddf0ed86ab2d90c99042df899eefdd1a6` (64,746,526 байт).
В production также находятся необходимые JS glue, HTML, лицензии и атрибуция исходников VectorCraft.

### Успешные проверки контрольной точки
- Workflow `38911661636` — сборка VectorCraft WebAssembly: **success**.
- Workflow `38912383028` — публикация «Макетной» с precheck / publish / browser_verify: **success**.
- Workflow `38913116507` — выкладка GitHub Pages: **success**.
- Workflow `38913278617` — реальный Chromium, импорт SVG на монтажной области 120×80 мм и возврат только рисунка 40×18 мм со смещением 12×8 мм: **success**. Консольных ошибок браузера не было.

### Серверные данные — не терять при откате
В source и production на дату фиксации одинаковые blob SHA:
- `mockup-profiles.json`: `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`.
- `method-settings.json`: `cbf6c8204e4fb3892d806342d37debefb8d9038e`.

**Правило отката:** не перезаписывать эти JSON файлами из контрольной ветки без сравнения с актуальными серверными значениями. Сначала сохранить более поздние правки реестров. Вернуть исходники из `checkpoint-...-source`, а опубликованный сайт и WASM из `checkpoint-...-production` только с переносом актуальных серверных реестров. После восстановления проверить браузерные workflows и целостность публикации. Не изменять `main` вручную без синхронизации с publishing workflow.

### Ссылки
- [Исходный checkpoint](https://github.com/tohaa28/tohaa28.github.io/tree/checkpoint-maketnaya-vectorcraft-art-only-20261016-source)
- [Опубликованный checkpoint](https://github.com/tohaa28/tohaa28.github.io/tree/checkpoint-maketnaya-vectorcraft-art-only-20261016-production)
- [История интеграции](https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/MAKETNAYA_VECTORCRAFT_ART_BOUNDS_2026-10-16.md)

Контрольная точка — это **две замороженные Git-ветки**, а эта запись документирует их точные commits; сама запись в history не меняет исходный программный код и не запускает публикацию сайта.
