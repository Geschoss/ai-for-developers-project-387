#!/usr/bin/env bash
# Budget of agent runs per PR and the reason a run stopped. Used by .github/workflows/opencode.yml, README.md,
# «Предел запусков на PR». Tests: scripts/oc-budget.test.sh.
#
#   oc-budget.sh count   REPO, PR_NUMBER, RUN_ID, RUN_ATTEMPT [, LIMIT=3] in the environment.
#                        Prints `used=`, `limit=`, `allowed=`; appends them to $GITHUB_OUTPUT when set.
#   oc-budget.sh reason  A job object from the Actions API on stdin [, TIMEOUT_MINUTES=15]. Prints one of
#                        ok, timeout, infra, agent_failed, cancelled, unknown.
#
# The counter is the Actions history of the workflow, which the agent's token (actions: read) cannot rewrite. A run
# is tied to its PR by `run-name: opencode #<number>`. An attempt is spent when the job `opencode` was not skipped,
# so cancelled runs, timeouts and Re-run attempts count; a request refused for the budget does not.
set -euo pipefail

agent_job="opencode"
model_step="Run OpenCode"

count() {
  : "${REPO:?}" "${PR_NUMBER:?}" "${RUN_ID:?}" "${RUN_ATTEMPT:?}"
  local limit="${LIMIT:-3}" title="opencode #${PR_NUMBER}" used=0 id n
  local ids
  ids="$(gh api --paginate "repos/${REPO}/actions/workflows/opencode.yml/runs?per_page=100" |
    jq -rs --arg title "${title}" '[.[].workflow_runs[] | select(.display_title == $title) | .id] | .[]')"
  for id in ${ids}; do
    n="$(gh api --paginate "repos/${REPO}/actions/runs/${id}/jobs?filter=all&per_page=100" |
      jq -s --arg job "${agent_job}" --arg id "${id}" --arg current "${RUN_ID}" --argjson attempt "${RUN_ATTEMPT}" \
        '[.[].jobs[]
          | select(.name == $job and .conclusion != "skipped")
          | select($id != $current or .run_attempt < $attempt)] | length')"
    used=$((used + n))
  done
  local allowed=false
  if ((used < limit)); then allowed=true; fi
  printf 'used=%s\nlimit=%s\nallowed=%s\n' "${used}" "${limit}" "${allowed}" | tee -a "${GITHUB_OUTPUT:-/dev/null}"
}

reason() {
  jq -r --arg model "${model_step}" --argjson timeout "${TIMEOUT_MINUTES:-15}" '
    def secs: fromdateiso8601;
    (.steps // []) as $steps
    | ([$steps[] | select(.conclusion == "failure")] | first) as $failed
    | if .conclusion == "success" then "ok"
      elif .conclusion == "cancelled" and ((.completed_at | secs) - (.started_at | secs)) >= ($timeout * 60 - 60) then "timeout"
      elif $failed != null then (if $failed.name == $model then "agent_failed" else "infra" end)
      elif .conclusion == "cancelled" then "cancelled"
      else "unknown" end'
}

case "${1:-}" in
  count) count ;;
  reason) reason ;;
  *)
    echo "usage: oc-budget.sh count | reason" >&2
    exit 2
    ;;
esac
