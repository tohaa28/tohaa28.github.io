# Макетная — откат визуального редизайна Studio UI 2.0

## Профессиональный редизайн проверен и опубликован

- Каноническая source-ветка: `gifts-layout-workbench-mockups-source`.
- Функциональный source SHA: `18a29a464e8a47a7fd6480995600a10fb6bb9e37`.
- Опубликованный `main` SHA: `328fa9240a310c6bf29634e34dce1cf54b99c661`.
- Workflow `38256728445`: 142/142 unit, `precheck`, `publish`, `browser_verify` — SUCCESS.
- GitHub Pages deploy `38256766407` — SUCCESS.
- URL: https://tohaa28.github.io/gifts-layout-workbench-mockups/

## Резервные ветки, созданные **до** визуального редизайна

1. `backup/maketnaya-source-before-ui-redesign-2026-10-12`, SHA `f1158f35ce0d8866925bdfc40ffee357c1dc8c00`. Эта версия уже содержит стартовую 2.6-секундную заставку и предыдущие микропереходы между инструментами, но не содержит Studio UI 2.0.
2. `backup/maketnaya-published-before-ui-redesign-2026-10-12`, SHA `081017eae23e9d857c14a96c84d94e69791cdf9b`. Точная предшествующая опубликованная ветка `main`.
3. Более старый независимый backup до самих микропереходов: `backup/maketnaya-source-before-motion-system-2026-10-12`, SHA `2886e79f7501d60b52cb26bf97862938e3403174`.
4. Соответствующий backup публикации: `backup/maketnaya-published-before-motion-system-2026-10-12`, SHA `253113aeec77edd195c7d0b2a66f7e2f0e4310b1`.

Не удалять резервные ветки.

## Что включено в Studio UI 2.0

- В `editor.html` подключены `assets/workbench-shell.css` и `assets/workbench-shell.js`.
- В `mockup.html` подключены `assets/mockup-shell.css` и `assets/mockup-shell.js`.
- Разделы «Заказы / Макет / Мокапы» в шапке, обновлённые карточки корзины, приветственный блок, шкала 4 шагов, обновлённые редактор, рабочая область, панель инструментов, адаптивные скругления и градиентные поверхности.
- Навигация использует прежние кнопки управления (`backToOrders`, `resumeEditor`, `mockupModeButton`, `mockupBackButton`), без собственного механизма заказов или макетов.
- CSS не преобразует canvas и не меняет физические размеры логотипа/поля; PrintCheck v25, алгоритмы цилиндров и профили мокапов не менялись.
- Версии компонентов учитывают новые `workbench-shell.*`; Smoke тест `.github/workflows/test-direct-workbench.yml` проверяет реальные computed styles и встроенный mockup iframe.

## Вернуться к прежнему оформлению без переписывания Git-истории

На локальном репозитории:

```bash
git fetch origin
git switch gifts-layout-workbench-mockups-source
git pull --ff-only origin gifts-layout-workbench-mockups-source
git restore --source=origin/backup/maketnaya-source-before-ui-redesign-2026-10-12 --staged --worktree .
git diff --cached --stat
git commit -m "Rollback visual redesign: restore pre-Studio UI source"
git push origin gifts-layout-workbench-mockups-source
```

**Проверить результат:** дождаться успешного `precheck`, `publish`, `browser_verify`, а затем GitHub Pages deploy. Это восстанавливает **прежний интерфейс вместе с работающей стартовой анимацией и микропереходами**.

Дополнительно: деревом ветки `backup/maketnaya-published-before-ui-redesign-2026-10-12` можно сверить точную прошлую публикацию. Не делать force-push в `main` и не отключать защиту веток; публикация должна проходить через штатный workflow.

## Дальнейшая разработка

- Фиксировать каждый новый функциональный релиз после полного browser_verify.
- Для сравнения старого и нового дизайна сравнивать backup source с текущей source-веткой.
- Не смешивать косметические анимации с геометрическими изменениями PDF/SVG/canvas.
