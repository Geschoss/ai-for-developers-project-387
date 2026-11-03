# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `Geschoss/ai-for-developers-project-387`. Use the `gh` CLI
(2.94+) for all operations. Issue titles and bodies are in Russian and use the terms from `GLOSSARY.md`.

## Taking a ticket

Follow this when you are asked to work on an issue (for example `/implement #12`) or to pick the next one.

1. **Pick.** Take an open issue labelled `ready-for-agent` with no open blockers and no assignee (see **Count open
   blockers**). If several qualify, take the lowest number: issues were filed in dependency order. Issues labelled
   `ready-for-human` need the user (accounts, secrets, dashboards); don't start them on your own.
2. **Claim.** `gh issue edit <n> --add-assignee @me`, before any other write.
3. **Read context.** The issue body, its comments, and the closed blockers' PRs for what already exists. Then
   `AGENTS.md`, `docs/spec.md` (the source of truth for behaviour), `GLOSSARY.md`, and the ADRs the issue names.
4. **Branch.** From fresh `main`: `git switch -c issue-<n>-<short-slug>`.
5. **Build.** Test-first where there is a seam (`/tdd`). API changes start in TypeSpec under `spec/`, then
   regenerate and commit `spec/openapi.yaml` (ADR-0001). Keep to the issue's scope; if you find missing or wrong
   requirements, comment on the issue instead of silently expanding it. Commit messages follow **Commits** in
   `AGENTS.md`.
6. **Verify.** Lint, typecheck, the full test suite and the E2E scenarios the issue lists must pass locally. Tick the
   acceptance criteria you met in the issue body.
7. **Hand off.** Open a PR titled and bodied per **Commits** in `AGENTS.md` (use `/pr`), and leave the issue open:
   merging the PR closes it and unblocks dependent issues. If you stop before finishing, comment on the issue with
   what is done and what remains, then unassign yourself.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>`. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh api repos/Geschoss/ai-for-developers-project-387/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only; 0 means startable).
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: post the explanation with `gh issue comment <number> --body "..."`, then `gh issue close <number>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

File issues only into this repo. Never file into `mattpocock/skills` (the repo the vendored skills come from).

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
