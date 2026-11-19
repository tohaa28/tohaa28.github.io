# Vision AI 0.1.13 — файловая очередь заказов
Дата: 2026-11-19.
Экспериментальная ветка: feature/printcheck-vision-copy-v01.
PR #4 не объединять; не менять production/боевой gifts.ru.

## Исходные данные
Локальный dst.txt: 1 214 273 строк файловой описи.
Точно семизначное basename + расширение: 641 648 строк.
Уникальных номеров: 333 943. В прежнем диапазоне 3200000–8200000:
311 306. Ниже 3200000: 22 637. Номера выше 8200000: 0.
Имена с дополнительными суффиксами (482 391 записей) и числовые
названия каталогов исключены. Список отсортирован по возрастанию.
Полученные файлы vision_ai_order_numbers.txt и
vision_ai_order_numbers_summary.txt переданы пользователю в чате.
Не добавлять эти данные в публичный GitHub.

## Изменённые модули
- vision/orders/approval-file-list.mjs — строгий parser TXT и URL.
- vision/orders/approval-file-persistence.mjs — IndexedDB с 5 stores:
  queue, state, pending, success, failures.
- vision/orders/approval-file-controller.mjs — UI импорта и сканирования,
  пауза, стоп, задержка, ZIP, восстановление после reload.
- vision/orders/approval-range-scanner.mjs — флаг explicitList=true,
  разрешает семизначные старые номера без диапазонного перебора.
- vision/orders/overlay-entry.mjs — UI-блок и передача native chunks.
- vision/orders/extension/service-worker.js — аудит list ZIP.
- vision/orders/extension/manifest.json — версия 0.1.13.
- tests/printcheck-vision-approval-file-list.test.mjs —
  строгий разбор 333 943 номеров, дедупликация, границы и URL.
- tests/printcheck-vision-approval-file-list.browser.mjs —
  один старый синтетический номер, обсуждения и вложения,
  reload перед ZIP, ошибки карточек, pause+reload.
- .github/workflows/publish-printcheck-vision-preview.yml —
  сборка и тест перед выкладкой расширения в изолированный preview.

## Инварианты
1. Все IDs только из вручную выбранного TXT. Импорт не запускает перебор
   промежуточных номеров и не должен менять диапазонный checkpoint.
2. При каждом шаге в одной IDB-транзакции сохраняются завершённый заказ,
   его вложения и индекс следующего заказа; при сбое текущий повторяется.
3. Большой массив очереди неизменяемый; не пересохранять 333943 номера
   после каждой карточки: состояние cursor хранится отдельно.
4. ZIP подтверждается только Chrome Downloads COMPLETE;
   после reload не сбрасывать pending, если загрузка не подтверждена.
5. 404/410 — пропуск; HTTP 502 и повреждённый HTML — реестр ошибок;
   401/403/429 — глобальная остановка без пропуска.
6. Не передавать реальные номера, личные переписки или файлы на GitHub
   или внешние endpoint. Локальный тестовый origin и только GET.
7. Очистка IndexedDB сайта уничтожает невыгруженный прогресс —
   регулярно выгружать архивы и реестр.
