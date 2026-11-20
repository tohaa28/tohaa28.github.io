# CircleCI как резервный исполнитель PrintCheck Vision

Дата: 2026-11-17. **Только экспериментальная ветка** feature/printcheck-vision-copy-v01. Основная «Макетная» и gifts-layout-workbench-mockups-source не изменяются, PR #4 остаётся черновым.

## Что подготовлено

Конфигурация: .circleci/config.yml.

CircleCI 2.1, два независимых задания:

- **vision-contract** — автоматически на каждом push в feature/printcheck-vision-copy-v01; cimg/python:3.12-node, resource_class small. Проверка синтаксиса всех vision/*.mjs и deterministic tests, запуск всех tests/printcheck-vision-*.test.mjs, замеры vector-corridors и curved-normal-probes, Python tests с префиксом test_printcheck_vision_, полный синтетический подписанный пилот Node Ed25519 -> приватные JSON -> Python метрики.
- **vision-browser** — запуск только по явному параметру run_browser=true; cimg/node:22, resource_class medium. Установка Playwright Chromium, desktop/mobile UI smoke, независимая Vision Studio/Review проверка, сборка isolated bookmarklet и синтетическая проверка same-origin сессии Gifts.ru.

Ни в одном задании нет release, deployment, записи в GitHub, использования реального авторизованного аккаунта Gifts.ru, пользовательских PDF/ZIP, секретов или обучающих клиентских данных. Все проверки изолированы и используют искусственные образцы.

**Экономия кредитов:** браузерные прогоны выключены по умолчанию. На каждый новый коммит выполняется сравнительно лёгкий пакет Node + Python. Включайте дорогой Chromium вручную после заметного изменения UI/launcher или перед приёмкой.

## Однократная настройка в открытой вкладке CircleCI

1. Войдите в организацию **tohaa28**, откройте **Projects**. Найдите **tohaa28.github.io**. Если проект ещё не создан, выберите **Set Up Project** / **Create Project**. Авторизованный вход на circleci.com не гарантирует автоматически, что сам репозиторий подключён.
2. Подключите GitHub-репозиторий **tohaa28/tohaa28.github.io**. Для GitHub App может потребоваться разрешить CircleCI GitHub App доступ к **этому конкретному репозиторию**; не обязательно давать доступ ко всем репозиториям аккаунта.
3. Выберите **existing config** и файл **.circleci/config.yml** из ветки **feature/printcheck-vision-copy-v01**. Не создавайте новый starter config поверх существующего исходника.
4. Для GitHub App pipeline укажите **config source и checkout source** как **tohaa28/tohaa28.github.io**, затем настройте GitHub trigger (например, **All pushes**) для экспериментального процесса. Внутри файла дополнительно присутствует фильтр по экспериментальной ветке. Для старого GitHub OAuth-интеграционного проекта выберите «Use existing config» и эту же ветку.
5. Сохраните проект. Чтобы начать проверку сразу, выберите **Trigger Pipeline** и ветку **feature/printcheck-vision-copy-v01** и убедитесь, что workflow **vision-automatic** выполняет job **vision-contract**.
6. Для полного браузерного цикла откройте **Trigger Pipeline**, укажите параметр **run_browser = true** типа boolean; тогда к базовым тестам добавится workflow **vision-browser-on-demand**.

Если после подключения project pipeline не появляется, проверьте **Project Settings → Project Setup/Triggers**: установлен ли GitHub trigger и связаны ли config source и checkout source с правильными веткой и репозиторием. Для GitHub App свежий push в source-ветку создаёт pipeline только после регистрации trigger.

## Как проверять результаты

Сравнить журнал с существующими GitHub Actions:
- Node test totals и Python test totals;
- отчёты synthetic CPU, отсутствие падения на vector-corridors и curved normal rays;
- raw signed-pilot test должен вывести «Signed synthetic pilot -> segregated private files -> Python research metrics: PASS»;
- в UI workflow тестируется только изолированная Vision и смоделированная сессия, а не реальные заказы.

Ссылка на экспериментальный код: https://github.com/tohaa28/tohaa28.github.io/blob/feature/printcheck-vision-copy-v01/.circleci/config.yml

CircleCI UI организации: https://app.circleci.com/pipelines/github/tohaa28?useNewPipelines=true

## Ограничения и состояние

Файл успешно закоммичен в GitHub, но **до получения конкретного CircleCI pipeline/job link и его состояния нельзя утверждать, что CircleCI уже исполнил тесты**. Открытая авторизованная страница CircleCI сама по себе не создаёт pipeline. Browser access из текущего ChatGPT-сеанса не предоставил доступ к пользовательской открытой вкладке; настройка CircleCI осуществляется через UI или Work/Computer Use со связанным браузером.

GitHub Actions могут независимо оставаться активными или ограниченными. Добавление конфига CircleCI **не отключает GitHub Actions**, а даёт запасной способ выполнять те же тесты. Изменять рабочий редактор или автоматически сливать PR для этого не требуется.

## Ссылки на подтверждённую документацию

- CircleCI создание проекта: https://circleci.com/docs/guides/getting-started/create-project/
- CircleCI вручную запустить pipeline: https://circleci.com/docs/guides/orchestrate/triggers-overview/
- CircleCI конфигурация и параметры: https://circleci.com/docs/reference/configuration-reference/
- CircleCI интеграция GitHub: https://circleci.com/docs/guides/integration/github-apps-integration/
- Playwright Chromium в CI: https://playwright.dev/docs/browsers
