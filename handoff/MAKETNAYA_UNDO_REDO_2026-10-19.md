# Макетная — Undo / Redo размещения логотипа (19.10.2026)

## Контрольные точки до изменений
- Source: `082b1a6dff8bf99c5bba81df55dac1cbc0d1def6`
  (`backup-before-placement-undo-redo-20261019-source`).
- Production main: `3c5fa0fe1f647122762962d0702ca2139bd35d2a`
  (`backup-before-placement-undo-redo-20261019-production`).

## Функциональность
- Новые кнопки `#editorUndo` и `#editorRedo` внутри `#fieldLogoTools`, рядом с «Редактор логотипа».
- Клавиши: Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z (сохранена работа обычных текстовых полей).
- В Undo/Redo входят добавление, замена, удаление файла логотипа и операции с его размещением: перенос, изменение габаритов, угла, обрезки.
- Непрерывное перетаскивание записывается как одна операция после `pointerup`. Для числовых вводов изменение фиксируется на `change`/`focusout`.
- Безопасные снимки `y.placements`, координаты клонируются, объекты artwork доступны по ссылке без копий тяжёлых байтов SVG/PDF.
- История: максимум 64 состояния. Сбрасывается при смене конструктора, артикула, позиции заказа или страницы. После новой операции из старого состояния ветка Redo сбрасывается.
- Восстановление синхронизирует выбранное поле, положение, подпись файла, контроль нанесений и redraw, а при смене поля подстраивает viewport.
- Undo/Redo недоступны, пока выполняется обработка; не перехватывают клавиатуру открытых VectorCraft/TraceDraw.

## Архитектура
- `editor.html`: два UI-контрола в штатной панели.
- `tools/patch-placement-history.mjs`: изолированная идемпотентная вставка в встроенный JS исходного редактора. Вызывается из `tools/build-launcher.mjs` после `applyLogoPreflight()` и `applyLogoEditorBridge()`.
- Hook **именно в актуальном preflight patched renderer**:
  `function X(){gwbHistoryObserve();gwbSyncLogoUploadHint();const c=y.template;`.
  End hook:
  `gwbArtworkView?.refresh();gwbHistoryControls()}function co(`.
  Не использовать старые базовые якоря `function X(){const c=y.template;` и `yi()}function co(` при повторных изменениях.
- `tests/placement-history.test.mjs` проверяет движение, размеры, поворот, клиппинг, замену, удаление, ветвление, клавиши и reset по артикулу.

## Публикация
- Рабочая ветка `main` обновлена вручную лишь в четырёх файлах:
  `gifts-layout-workbench-mockups/editor.html`,
  `gifts-layout-workbench-mockups/assets/index-BpU9kvz8.js`,
  `gifts-layout-workbench-mockups/launcher.js`,
  `gifts-layout-workbench/launcher.js`.
- Production HEAD после изменений: `469f1c851268a2f9f108d34ea8345387773f16f7`.
- Live JS blob: `933ac7b45c9122c1dcb7b2fe11804693ad725dd7`; label `Макетная r933ac7b4`.
- Проверен синтаксис инструментария, фактический bundle с внедрённой историей, единичность хуков, смоделированы операции Undo/Redo; проверен точный дифф четырёх файлов.
- **Ограничение**: не удалось подтвердить GitHub Pages живым браузерным тестом; не утверждать, что такой тест пройден. История не сохраняется после закрытия вкладки.
- Source branch автоматическая публикация может обновить version fingerprint. Сохранять отдельные файлы WASM.

## Сохранены неизменными
- `mockup-profiles.json` blob `ddb84fdc0d656341770a2399f5a10f0e21f5d72c`
- `method-settings.json` blob `cbf6c8204e4fb3892d806342d37debefb8d9038e`
- WASM VectorCraft/TraceDraw, PrintCheck, PDF export, Mockups editor, личная библиотека PDF, все order bindings и данные заказов.
