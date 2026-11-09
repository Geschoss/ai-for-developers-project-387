# Pull requests

Rules for the PR an agent opens. They apply to OpenCode in GitHub Actions and to local agents alike. The `pr` workflow
(`scripts/commit-message.sh pr`) fails the PR when they are broken.

PRs are squash-merged: the PR title and body become the commit on `main`.

OpenCode in GitHub Actions does not take the title from the agent: the action makes it from a 40-character summary of
the agent's reply and puts the whole reply into the body (see `docs/research/opencode-pr-title.md`). A person fixes
the title and body of such a PR by hand with `gh pr edit`, so the `pr` check turns green. The agent's own commits
still follow the rules below: the last commit's subject is the title to copy.

## Title

`<type>(<scope>): <sentence>` in English, in the imperative. Types: `feat`, `fix`, `perf`, `refactor`, `docs`,
`test`, `build`, `ci`, `chore`, `style`. Never a status report such as "README updated" or "Done".

```text
docs(readme): describe agent settings and skills
```

## Body

1. The first line is `Closes #<n>`, the issue the work belongs to. Nothing before it: no greeting, no "Готово".
2. Then the sections of `.github/pull_request_template.md`: Summary (with the `pr` skill's diagram or diff), Проверки,
   Риск, Откат. Keep them short.

```markdown
Closes #8

## Summary

...

## Проверки

- **SHA:** `<head SHA>`
- `mise run check`: <link to the CI run>
- **Было:** <red run>
  **Стало:** <green run>

## Риск

**Door:** two-way

**Blast Radius:** ...

## Откат

`git revert <squash commit>`; check by ...
```

Summary links the original request, the spec, the tickets and the human sign-off. Проверки give the command you actually ran, its
result, the run link and the checked SHA, never just "tests passed" or "did not run". Риск names the behaviour that can break and who it affects, and
justifies the depth of checking by the cost of a mistake, not by the number of lines. Откат says how to undo the change
in Git and what confirms the behaviour is back; if data is touched, it says whether reverting the code is enough.

Do not paste the Actions run link or a "committed <sha>" line into the title; the run link may go last in the body.

## Commits

Each commit follows **Commits** in `AGENTS.md`, with the trailer `Refs: #<n>`.

## If the `pr` check fails

Edit the PR title and body (`gh pr edit`) to match the rules above. Do not change code to satisfy the check.
