# Сообщение для нового чата — «Макетная» (19.10.2026)

Продолжаем разработку существующей «Макетной» (Gifts Layout Workbench), PrintCheck и Редактора мокапов. **Не создавай новую программу и не сбрасывай код.** У меня есть GitHub доступ; работай с репозиторием https://github.com/tohaa28/tohaa28.github.io. Канонический source — ветка **gifts-layout-workbench-mockups-source**, production — **main/gifts-layout-workbench-mockups/**; сайт https://tohaa28.github.io/gifts-layout-workbench-mockups/.

Сначала через GitHub ПРОЧИТАЙ актуальные документы:
1. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/START_HERE_2026-10-19_FINAL.md
2. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/PROJECT_STATE_2026-10-19_FINAL.json
3. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/SAFE_RECOVERY_2026-10-19_FINAL.md
4. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/handoff/NEXT_STEPS_2026-10-19.md
5. https://github.com/tohaa28/tohaa28.github.io/blob/gifts-layout-workbench-mockups-source/HANDOFF_FOR_NEXT_CHAT.md

**Frozen source:** checkpoint-maketnaya-20261019-newchat-final-source (commit 52743e6b27cd4d644f0465ed07999035af7e1a98); **frozen production:** checkpoint-maketnaya-20261019-newchat-final-production (commit eafb2c85d563b619165c79f858426b97256126ca). Исходные версии проверены: Publish CI 39231640321 success; TraceDraw Rust build 39231601793 success; Live TraceDraw Chromium 39231640175 attempt 2 success; Pages 39232177088 success.

Сейчас под кнопкой «Редактор логотипа» отдельный выбор **VectorCraft / TraceDraw**. VectorCraft: настоящие инструменты Rust/WASM, gifts.ru-тема по умолчанию (старый вид и простой редактор в исходниках сохранены, переключатели намеренно скрыты в текущем UI), CMYK, только текущее поле, размер в мм, обратно только фактический векторный SVG рисунок и положение внутри поля. TraceDraw — отдельный настоящий Rust/WASM 0.9.4 с SVG/PDF и art-only возвратом; встроенный CDR ещё не реализован. Нельзя ломать ни одно направление transfer/apply, идентичность поля или исходное размещение. Библиотека PDF с редактируемыми исходниками сейчас только локальная (IndexedDB); private серверный API не развернут, не утверждай обратное.

**КРИТИЧЕСКИ:** mockup-profiles.json (blob ddb84fdc0d656341770a2399f5a10f0e21f5d72c) и method-settings.json (blob cbf6c8204e4fb3892d806342d37debefb8d9038e) — действующие реестры, их нельзя затирать из старого checkpoint. Папки published vectorcraft/ и tracedraw/ с WASM также нельзя удалять обычным build. Перед правками создай новые backup source/main branches от свежих SHA, проверяй исходное состояние и запускай настоящие тесты и публикацию. Не считай незавершённое выполненным и не смешивай этот проект с отдельным VectorForge.

**Новое задание:** [пишу в следующем сообщении].
