# Макетная: подтверждённый откат 12 октября 2026

**Текущее проверенное состояние**: source `85bab4b183db1f419512559490cb97a415d7bd0c`, published `main` `57d23feb558c10aa8ccec475c9b0956752b7db1f`.

- Откат выполнен по запросу «откати последние изменения».
- Восстановлен Git tree `ea8c0fae627a95009e4e4e2e28f85ceb93ee5305`, тот же самый, что в `2886e79f7501d60b52cb26bf97862938e3403174` до внутренних переходов.
- Отменены пространственный Studio UI 2.0 и внутренний Motion System; **стартовая 2.6-секундная профессиональная анимация** на gifts.ru оставлена.
- PrintCheck v25, данные заказов, привязки артикулов/полей, редактор мокапов и его алгоритмы не редактировались при откате.
- Проверка: [workflow 38290413508](https://github.com/tohaa28/tohaa28.github.io/actions/runs/38290413508) (134/134 тестов, precheck/publish/browser_verify SUCCESS) и [GitHub Pages 38290486575](https://github.com/tohaa28/tohaa28.github.io/actions/runs/38290486575) SUCCESS.

Сохранены предыдущие версии: `backup/maketnaya-source-before-ui-redesign-2026-10-12` (с Motion System, без Studio UI 2.0) и `backup/maketnaya-source-before-motion-system-2026-10-12` (текущая функциональная основа). Версии публикации хранятся в соответствующих `backup/maketnaya-published-...` ветках. История Git не переписана (force-push не применялся). Коммиты Studio UI 2.0 доступны в истории и могут быть использованы для отдельного восстановления позднее.
