#!/usr/bin/env bash
# Tests for scripts/oc-budget.sh with a fake `gh` that serves Actions API fixtures. Run: bash scripts/oc-budget.test.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="${here}/oc-budget.sh"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
mkdir "${work}/bin"

cat > "${work}/runs.json" <<'JSON'
{"workflow_runs": [
  {"id": 101, "display_title": "opencode #5"},
  {"id": 102, "display_title": "opencode #5"},
  {"id": 103, "display_title": "opencode #5"},
  {"id": 104, "display_title": "opencode #5"},
  {"id": 200, "display_title": "opencode #6"},
  {"id": 300, "display_title": "Заметка к Бронированию"}
]}
JSON
# 101 ran, 102 was cancelled (still spent), 103 was refused for the budget (skipped),
# 104 is the current run: attempt 1 failed, attempt 2 is the Re-run that asks now.
echo '{"jobs": [{"name": "opencode", "conclusion": "success", "run_attempt": 1}, {"name": "budget", "conclusion": "success", "run_attempt": 1}]}' > "${work}/jobs-101.json"
echo '{"jobs": [{"name": "opencode", "conclusion": "cancelled", "run_attempt": 1}]}' > "${work}/jobs-102.json"
echo '{"jobs": [{"name": "opencode", "conclusion": "skipped", "run_attempt": 1}]}' > "${work}/jobs-103.json"
echo '{"jobs": [{"name": "opencode", "conclusion": "failure", "run_attempt": 1}]}' > "${work}/jobs-104.json"
echo '{"jobs": [{"name": "opencode", "conclusion": "success", "run_attempt": 1}]}' > "${work}/jobs-200.json"

cat > "${work}/bin/gh" <<'STUB'
#!/usr/bin/env bash
url="${*: -1}"
case "${url}" in
  *"/workflows/opencode.yml/runs"*) cat "${FIXTURES}/runs.json" ;;
  *"/actions/runs/"*"/jobs"*)
    id="${url#*/actions/runs/}"
    cat "${FIXTURES}/jobs-${id%%/*}.json"
    ;;
  *) echo "unexpected gh call: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "${work}/bin/gh"

failures=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    echo "ok   ${name}"
  else
    echo "FAIL ${name}: expected '${expected}', got '${actual}'" >&2
    failures=$((failures + 1))
  fi
}
count() { PATH="${work}/bin:${PATH}" FIXTURES="${work}" REPO=o/r bash "${script}" count | paste -sd' ' -; }

check "below the limit: cancelled run counts, refused run does not" \
  "used=2 limit=3 allowed=true" "$(PR_NUMBER=5 RUN_ID=104 RUN_ATTEMPT=1 count)"
check "Re-run spends an attempt and exhausts the budget" \
  "used=3 limit=3 allowed=false" "$(PR_NUMBER=5 RUN_ID=104 RUN_ATTEMPT=2 count)"
check "other PR has its own budget" \
  "used=1 limit=3 allowed=true" "$(PR_NUMBER=6 RUN_ID=999 RUN_ATTEMPT=1 count)"
check "PR without runs" \
  "used=0 limit=3 allowed=true" "$(PR_NUMBER=7 RUN_ID=999 RUN_ATTEMPT=1 count)"
check "limit is configurable" \
  "used=2 limit=2 allowed=false" "$(PR_NUMBER=5 RUN_ID=104 RUN_ATTEMPT=1 LIMIT=2 count)"

check "plain issue has no limit" \
  "used=0 limit=none allowed=true" "$(IS_PR=false PR_NUMBER=5 RUN_ID=104 RUN_ATTEMPT=1 count)"

# The counter finds runs by display_title. In YAML a bare " #" starts a comment, so the run-name must be quoted
# and have exactly the form the script searches for ("opencode #<number>").
run_name="$(sed -n 's/^run-name: //p' "${here}/../.github/workflows/opencode.yml")"
check "workflow run-name is quoted and starts with 'opencode #'" \
  'ok' "$([[ "${run_name}" == '"opencode #${{ '* && "${run_name}" == *' }}"' ]] && echo ok || echo "${run_name}")"

reason() { bash "${script}" reason; }
check "reason: success" "ok" "$(echo '{"conclusion":"success","steps":[]}' | reason)"
check "reason: model step failed" "agent_failed" \
  "$(echo '{"conclusion":"failure","steps":[{"name":"Run OpenCode","conclusion":"failure"}]}' | reason)"
check "reason: setup step failed" "infra" \
  "$(echo '{"conclusion":"failure","steps":[{"name":"Check the model key","conclusion":"failure"}]}' | reason)"
check "reason: ran to the timeout" "timeout" \
  "$(echo '{"conclusion":"cancelled","started_at":"2026-11-09T10:00:00Z","completed_at":"2026-11-09T10:15:05Z","steps":[{"name":"Run OpenCode","conclusion":"cancelled"}]}' | reason)"
check "reason: cancelled early by a person" "cancelled" \
  "$(echo '{"conclusion":"cancelled","started_at":"2026-11-09T10:00:00Z","completed_at":"2026-11-09T10:02:00Z","steps":[]}' | reason)"
check "reason: nothing recognisable" "unknown" "$(echo '{"conclusion":null,"steps":[]}' | reason)"

if ((failures > 0)); then
  echo "${failures} failed" >&2
  exit 1
fi
