# oxlint и oxfmt вместо ESLint и Prettier; две версии TypeScript

Линт и формат — oxlint и oxfmt. Включены категории correctness, suspicious, pedantic, perf, style и restriction,
все как ошибки; nursery выключен, потому что правила в нём меняются между релизами. `tsc -b` работает на TypeScript 6:
NestJS не собирается на TypeScript 7 (декораторы и `emitDecoratorMetadata`), бэкенд эмитит SWC. TypeScript 7 есть только
внутри oxlint-tsgolint и служит type-aware анализу. `options.typeCheck` у oxlint выключен, поэтому ошибки компилятора
отдаёт только `tsc` — два компилятора расходятся в диагностике.

## Considered Options

- **ESLint + typescript-eslint + Prettier**: привычный набор, но медленнее, и форматирование жило бы во втором инструменте.
- **Один TypeScript 7 на весь репозиторий**: NestJS на нём не работает, а `erasableSyntaxOnly` запрещает декораторы
  и parameter properties, на которых построен бэкенд.

## Consequences

- `tsconfig` валиден для обеих версий: без `baseUrl` и без `moduleResolution: node10`. `erasableSyntaxOnly` включён
  во всех пакетах, кроме backend.
- Пересмотреть, когда Nest подтверждённо заработает на TypeScript 7: тогда одна версия, TypeScript 7.
- Пересмотреть, если расхождение движков начнёт давать ложные срабатывания: тогда ESLint + typescript-eslint
  на TypeScript 6. oxfmt при этом остаётся.
