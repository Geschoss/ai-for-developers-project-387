#!/usr/bin/env bash
# Checks that a commit or a PR names its type (Conventional Commits) and its ticket. See Commits in AGENTS.md.
# Usage: `commit-message.sh commit <message-file>` from the commit-msg hook (`mise run commit-msg`),
# `commit-message.sh pr` from CI, with PR_TITLE and PR_BODY in the environment.
set -euo pipefail

conventional='^(feat|fix|perf|refactor|docs|test|build|ci|chore|style)(\([A-Za-z0-9./_-]+\))?!?: [^ ]'
# Exempt: release commits and PRs that release-please writes, reverts and merges that git writes.
exempt='^(chore\(main\): release |Revert "|Merge )'

case "${1:-}" in
  commit)
    # Drop git's comment lines and everything below the scissors line of `commit -v`.
    text="$(sed -e '/^# -\{24\} >8 -\{24\}$/,$d' -e '/^#/d' "${2:?message file}")"
    ticket='^Refs: #[0-9]+'
    ticket_hint='a `Refs: #<n>` trailer'
    ;;
  pr)
    # Bodies edited on github.com have CRLF line ends.
    pr_body="$(printf '%s\n' "${PR_BODY:-}" | tr -d '\r')"
    text="$(printf '%s\n%s' "${PR_TITLE:-}" "${pr_body}" | tr -d '\r')"
    ticket='^Closes #[0-9]+'
    ticket_hint='`Closes #<n>` as the first line of the PR body'
    ;;
  *)
    echo "usage: commit-message.sh commit <message-file> | pr" >&2
    exit 2
    ;;
esac

# Leading blank lines are not the subject.
text="$(printf '%s\n' "${text}" | sed -e '/./,$!d')"
subject="$(printf '%s\n' "${text}" | head -n 1)"

if [[ "${subject}" =~ ${exempt} ]]; then
  exit 0
fi

failures=()
if [[ ! "${subject}" =~ ${conventional} ]]; then
  failures+=("\"${subject}\" is not <type>(<scope>): <subject>, with type feat, fix, refactor, docs, test, ci, …")
fi
if [[ "$1" == "pr" ]]; then
  # The body's first non-blank line, right after the title.
  first_body_line="$(printf '%s\n' "${pr_body}" | sed -e '/./,$!d' | head -n 1)"
  [[ "${first_body_line}" =~ ${ticket} ]] || failures+=("missing ${ticket_hint}")
elif ! printf '%s\n' "${text}" | grep -Eq "${ticket}"; then
  failures+=("missing ${ticket_hint}")
fi

if ((${#failures[@]} > 0)); then
  echo "Commit message check failed (see Commits in AGENTS.md):" >&2
  printf '  %s\n' "${failures[@]}" >&2
  exit 1
fi
