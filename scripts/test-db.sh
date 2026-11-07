#!/usr/bin/env bash
# Throwaway local Postgres for integration tests when Docker/Supabase is unavailable.
# Usage: scripts/test-db.sh start|stop|url
set -euo pipefail

PORT="${TEST_DB_PORT:-54329}"
DATA_DIR="${TEST_DB_DIR:-/var/tmp/buildr-test-pg}"
BIN_DIR="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"

if [ -z "$BIN_DIR" ]; then
  echo "No local PostgreSQL server binaries found under /usr/lib/postgresql" >&2
  exit 1
fi

# Postgres refuses to run as root, so drop to the postgres user when needed.
as_pg() {
  if [ "$(id -u)" -eq 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

case "${1:-}" in
  start)
    if [ ! -d "$DATA_DIR" ]; then
      mkdir -p "$DATA_DIR"
      if [ "$(id -u)" -eq 0 ]; then chown postgres:postgres "$DATA_DIR"; fi
      as_pg "$BIN_DIR/initdb" -D "$DATA_DIR" -U postgres --auth=trust --no-sync >/dev/null
    fi
    if ! as_pg "$BIN_DIR/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
      as_pg "$BIN_DIR/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATA_DIR -c fsync=off -c max_connections=100" -l "$DATA_DIR/server.log" -w start >/dev/null
    fi
    echo "postgresql://postgres@127.0.0.1:$PORT/postgres"
    ;;
  stop)
    if [ -d "$DATA_DIR" ]; then
      as_pg "$BIN_DIR/pg_ctl" -D "$DATA_DIR" -m fast stop >/dev/null 2>&1 || true
      rm -rf "$DATA_DIR"
    fi
    ;;
  url)
    echo "postgresql://postgres@127.0.0.1:$PORT/postgres"
    ;;
  *)
    echo "usage: $0 start|stop|url" >&2
    exit 2
    ;;
esac
