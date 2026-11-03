#!/bin/sh
# Hexlet's check runs this image as `docker run -e PORT=8080` and curls
# http://localhost:8080/. There is no database service and no ADMIN_* env.
# When DATABASE_URL is already set (Render, compose), this script only drops
# privileges. Placeholder Администратор credentials exist only for that
# self-contained start; a deployment that sets DATABASE_URL still has to set them.
set -eu

start_local_postgres() {
  if ! pg_lsclusters --no-header | grep -q '[0-9]'; then
    version="$(ls /usr/lib/postgresql)"
    pg_createcluster "${version}" main --locale=C.UTF-8 --encoding=UTF8
  fi

  version="$(pg_lsclusters --no-header | awk 'NR==1 { print $1 }')"
  name="$(pg_lsclusters --no-header | awk 'NR==1 { print $2 }')"
  pg_ctlcluster "${version}" "${name}" start

  # Local socket is peer auth, so this needs no password. The app connects over
  # TCP as user `node`, which peer auth would reject.
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD 'calendar'"
  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'calendar'" | grep -q 1; then
    runuser -u postgres -- createdb calendar
  fi

  export DATABASE_URL="postgres://postgres:calendar@127.0.0.1:5432/calendar"
  if [ -z "${ADMIN_EMAIL:-}" ]; then
    export ADMIN_EMAIL="admin@example.com"
  fi
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    export ADMIN_PASSWORD="change-me"
  fi
}

if [ -z "${DATABASE_URL:-}" ]; then
  start_local_postgres
fi

cd /app
exec setpriv --reuid=node --regid=node --init-groups -- "$@"
