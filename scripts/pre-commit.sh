#!/usr/bin/env bash
# Staged files only. Checks, never autofixes: oxlint without --fix, oxfmt --check.
# mise joins $STAGED on spaces, so a path with a space would be split. The index
# is the same set, read as NUL-separated paths.
set -euo pipefail

lint_files=()
fmt_files=()

while IFS= read -r -d '' file; do
  if [[ ! -f "${file}" ]]; then
    continue
  fi
  case "${file}" in
    spec/openapi.yaml | spec/api.d.ts | pnpm-lock.yaml | CHANGELOG.md | .github/workflows/hexlet-check.yml)
      continue
      ;;
    backend/drizzle | backend/drizzle/* | .agents | .agents/* | .claude | .claude/*)
      continue
      ;;
    dist | dist/* | */dist | */dist/* | node_modules | node_modules/* | */node_modules | */node_modules/*)
      continue
      ;;
  esac
  case "${file}" in
    *.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs)
      lint_files+=("${file}")
      fmt_files+=("${file}")
      ;;
    *.json | *.jsonc | *.yaml | *.yml | *.md)
      fmt_files+=("${file}")
      ;;
  esac
done < <(git diff-index --cached --name-only -z HEAD)

if ((${#lint_files[@]} > 0)); then
  pnpm exec oxlint --deny-warnings "${lint_files[@]}"
fi

if ((${#fmt_files[@]} > 0)); then
  pnpm exec oxfmt --check "${fmt_files[@]}"
fi
