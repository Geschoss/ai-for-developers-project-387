# Откуда OpenCode берёт заголовок и тело PR

Дата: 2026-11-06. Версия: `anomalyco/opencode/github@v1.19.5`. Вопрос: почему в PR #13 заголовок — «Added README link; committed and PR ready.», а правильный заголовок оказался в теле.

## Вывод

Заголовок PR — это ответ модели на отдельный запрос «Summarize the following in less than 40 characters», а не строка, которую написал агент. Тело PR — полный финальный текст агента плюс `Closes #N` и ссылка на запуск. Задать заголовок через документированные настройки нельзя.

## Где живёт код (проверено по исходникам)

`github/index.ts` в теге v1.19.5 — старая реализация. Экшен ставит бинарник `opencode` и запускает `opencode github run` ([github/action.yml, v1.19.5](https://github.com/anomalyco/opencode/blob/v1.19.5/github/action.yml)). Логика сейчас в [`packages/opencode/src/cli/cmd/github.handler.ts`](https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/cli/cmd/github.handler.ts). Наш запуск установил `opencode version: 1.19.5` (`gh run view 42158661272 --log`), так что работает именно он.

Путь для комментария к issue (`github.handler.ts`, ветка «Issue», строки 589-621):

1. `checkoutNewBranch("issue")` создаёт ветку. Имя: `opencode/${type}${issueId}-${timestamp}` (`generateBranchName`, стр. 1058-1070). Отсюда `opencode/issue12-20261106034755`.
2. `chat(userPrompt + данные issue)` отдаёт агенту задачу. `response` — последний текстовый кусок ответа (`extractResponseText`, стр. 905).
3. `branchIsDirty` (стр. 1106-1126) считает ветку грязной, если есть незакоммиченные правки или `HEAD` ушёл вперёд. Агент сам закоммитил, поэтому `dirty`.
4. Заголовок: `const summary = await summarize(response)` (стр. 603). `summarize` (стр. 865-874) выполняет `chat("Summarize the following in less than 40 characters:\n\n" + response)`. Возвращается ответ модели. Если вызов упал, заголовок будет `Fix issue: <заголовок issue>`.
5. Коммит: `pushToNewBranch(summary, branch, uncommittedChanges, false)` (стр. 1072). Новый коммит делается только при незакоммиченных правках, иначе просто `git push`. Сообщение коммита агента остаётся как есть. Поэтому в PR #13 коммит правильный: `docs(readme): link the agent PR rules`.
6. PR: `createPR(default_branch, branch, summary, ``${response}\n\nCloses #${issueId}${footer()}``)` (стр. 605-610). Заголовок = `summary`, тело = весь `response` + `Closes #12` + ссылка `[github run]`. Подстановки шаблона нет, заголовок из ответа агента не извлекается.
7. `createPR` (стр. 1263+) сначала ищет открытый PR с той же головной веткой и, если находит, возвращает его номер без создания нового. Тогда `summary` в заголовок не попадает.
8. Ответ агента пуст — делается ещё один запрос «Summarize the actions … in 1-2 sentences» (стр. 943). Это не наш случай.

## Первая рука: наши запуски

- PR #13 (`gh pr view 13`): заголовок «Added README link; committed and PR ready.». Единственный коммит называется `docs(readme): link the agent PR rules`. Тело начинается с «Добавил строку в README.md и закоммитил…», внутри — блоки «PR title: `docs(readme): link the agent PR rules`» и «PR body», в конце `Closes #12` и `[github run]`. Это совпадает с шагами 4-6.
- Лог запуска 42158661272: `Sending message to opencode...` (задача), затем `exiting loop`, `Pushing to new branch...`, `Creating pull request...`. Нового коммита от экшена нет, коммит один, агентский. Это шаги 3 и 5.
- PR #9: сейчас заголовок `docs(readme): describe agent settings and skills`, а в тексте задачи фигурировало «README updated, committed 26dce85.». Тело #9 дописано вручную: в нём есть `Generated with Claude Code`, а экшен такого не добавляет. Вывод: заголовок #9 исправили позже. Это вывод, а не проверенный факт, потому что истории правок я не смотрел.

## Что говорят документы и action.yml

Входы v1.19.5 (`github/action.yml`): `model`, `agent`, `share` (устарел, игнорируется), `prompt`, `use_github_token`, `mentions`, `variant`, `oidc_base_url`. Страница [opencode.ai/docs/github](https://opencode.ai/docs/github/) описывает те же входы. Про заголовок и тело PR, `instructions` и AGENTS.md там ничего нет: сказано только, что для запроса на исправление агент «will work in a new branch and submits a PR».

В `chat()` стоит комментарий «agent is omitted - server will use default_agent from config or fall back to "build"» (стр. 890). Судя по этому, вход `agent` в этой версии на запрос не влияет. Это вывод из чтения кода, я его не проверял запуском.

## Варианты по убыванию надёжности

1. **Агент сам создаёт PR (`gh pr create`) с нужным заголовком и телом, ветку не меняет.** В коде есть явная поддержка: `createPR` возвращает существующий PR и не перезаписывает его заголовок (стр. 1270-1280, комментарий «agent created a PR via gh pr create during its run»). Если агент переключил ветку, экшен не пушит и не создаёт PR, только комментирует (`switched`, стр. 598-602). Риск: нужны права и токен у агента. Токен берётся из `id-token: write`/приложения OpenCode, а `gh` в раннере использует `GITHUB_TOKEN`. У нас `contents: read`, значит `gh pr create` не сработает без `pull-requests: write`. Это вывод, не проверено.
2. **Шаг в нашем workflow после OpenCode.** Нужно найти PR по ветке `opencode/issue<N>-*`, взять заголовок из первого коммита (`git log -1 --format=%s`) и выполнить `gh pr edit --title`. Нужны `pull-requests: write` и `GH_TOKEN`. Не зависит от внутренностей экшена, но это наш код. Заголовок из коммита надёжен, потому что экшен его не трогает (шаг 5).
3. **Управлять финальным сообщением агента.** Заголовок генерирует тот же сеанс по запросу «<40 символов», поэтому есть шанс, что последний ответ из одной строки с правильным conventional-коммитом превратится в верный заголовок. Гарантий нет: запрос «<40 символов» заставляет модель сократить текст, а наши заголовки длиннее 40. Опираться на это нельзя.
4. **Свой `prompt` или `AGENTS.md`.** `prompt` заменяет задачу из комментария (`getUserPrompt`, стр. 711-745), но не меняет `summarize`. `AGENTS.md` модель читает как контекст, он не влияет на код экшена. Это поможет телу PR (оно целиком из `response`), но не заголовку.
5. **Закрепить версию и ждать правки апстрима.** В `summarize` нет настройки. Остаётся issue или PR в `anomalyco/opencode`.

## Проверено и предположено

- Проверено по исходникам v1.19.5: пункты 1-8 выше, список входов, формат ветки.
- Проверено по нашим данным: заголовок #13 не совпадает с коммитом, тело содержит ответ агента, `Closes #12` и ссылку; новых коммитов экшен не делал.
- Предположение: что именно модель ответила на «Summarize…» — прямого лога ответа нет, но «Added README link; committed and PR ready.» (42 символа) по форме подходит. Заголовок #9 исправили вручную. Вход `agent` не используется. `gh pr create` недоступен с нашими правами.
