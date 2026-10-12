# Откат Maketnaya Motion System — контрольная точка 2026-10-12

## Резервные Git-ветки созданы и проверены ДО изменения кода

- **Исходники до внедрения анимаций переключений:** `backup/maketnaya-source-before-motion-system-2026-10-12` — commit `2886e79f7501d60b52cb26bf97862938e3403174`. Эта версия содержит утверждённую новую стартовую заставку, но ещё без системы внутренних переходов.
- **Точная копия предыдущей публикации GitHub Pages:** `backup/maketnaya-published-before-motion-system-2026-10-12` — commit `253113aeec77edd195c7d0b2a66f7e2f0e4310b1`.
- Обе ветки созданы из существующих проверенных Git-коммитов и не зависят от новых коммитов source/main.

## Опубликованная версия с Motion System

- Исходники: `863e52aa77f4d5cdc620359d78ae028db3185ea3`; публикация main: `081017eae23e9d857c14a96c84d94e69791cdf9b`.
- GitHub Actions: workflow `38253390600`, **138/138 unit, precheck, publish и browser_verify — success**, GitHub Pages deployment тоже success.
- Новые визуальные файлы: `assets/workbench-motion.css`, `assets/workbench-motion.js`, `assets/mockup-motion.css`, `assets/mockup-motion.js`.
- Обновлены `editor.html`, `mockup.html`, version stamping, браузерный тест и `tests/workbench-motion.test.mjs`.
- CSS и JS отделены от движка работы с PDF, PrintCheck и растровыми мокапами. В кадре НЕ применяются CSS transforms к canvas макета и фото.

## Безопасный откат без переписывания истории

**Рекомендуемый способ** — создать новый коммит source-ветки, восстанавливающий прежнее дерево из резервной ветки (не делать force-push). На рабочей копии репозитория:

```bash
git fetch origin
git switch gifts-layout-workbench-mockups-source
git pull --ff-only origin gifts-layout-workbench-mockups-source
git restore --source=origin/backup/maketnaya-source-before-motion-system-2026-10-12 --staged --worktree .
git diff --cached --stat
git commit -m "Rollback: restore Maketnaya before internal motion system"
git push origin gifts-layout-workbench-mockups-source
```

Далее дождаться успешных `precheck`, `publish`, `browser_verify` и успешного GitHub Pages deployment; сверить `main` и сайт. При таком откате прежние 2.6-секундная стартовая анимация и весь функционал редакторов сохранятся, отменятся только внутренние motion-переходы.

При необходимости аварийного восстановления **публикации байт-в-байт** исходная точка `backup/maketnaya-published-before-motion-system-2026-10-12` содержит прежнее дерево `main`. Сначала убедиться, что автоматическая публикация из source не перезапишет восстановленный main; не делать неконтролируемых force-push в main.

## Правила дальнейшей разработки

- Не удалять и не перемещать обе резервные ветки.
- Не менять PrintCheck v25 и алгоритмы макетов ради анимаций.
- Не объявлять новый релиз стабильным до полного browser_verify.
- Следующие изменения вести в `gifts-layout-workbench-mockups-source`; резервные ветки оставить неизменными.
