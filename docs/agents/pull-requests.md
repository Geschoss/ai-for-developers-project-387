# Pull requests

Rules for the PR an agent opens. They apply to OpenCode in GitHub Actions and to local agents alike. The `pr` workflow
(`scripts/commit-message.sh pr`) fails the PR when they are broken.

PRs are squash-merged: the PR title and body become the commit on `main`.

## Title

`<type>(<scope>): <sentence>` in English, in the imperative. Types: `feat`, `fix`, `perf`, `refactor`, `docs`,
`test`, `build`, `ci`, `chore`, `style`. Never a status report such as "README updated" or "Done".

```text
docs(readme): describe agent settings and skills
```

## Body

1. The first line is `Closes #<n>`, the issue the work belongs to. Nothing before it: no greeting, no "Готово".
2. Then the sections of the `pr` skill (`.agents/skills/pr`): Summary, Evidence, Merge Danger. Keep them short.

```markdown
Closes #8

## Summary

...

## Evidence

- **Before:** ...
  **After:** ...

## Merge Danger

**Door:** two-way

**Blast Radius:** ...
```

Do not paste the Actions run link or a "committed <sha>" line into the title; the run link may go last in the body.

## Commits

Each commit follows **Commits** in `AGENTS.md`, with the trailer `Refs: #<n>`.

## If the `pr` check fails

Edit the PR title and body (`gh pr edit`) to match the rules above. Do not change code to satisfy the check.
