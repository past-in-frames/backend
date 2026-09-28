#!/usr/bin/env bash
# Forwards the production MySQL container to 127.0.0.1:13306 for local development.
# The database is not published on the server, so this tunnel is the only way in.
#
#   npm run db:tunnel          start in the background
#   npm run db:tunnel:stop     stop it
#   npm run db:tunnel:status   check whether it is up
set -euo pipefail

SSH_HOST="${DB_TUNNEL_SSH_HOST:-root@178.156.245.168}"
SSH_KEY="${DB_TUNNEL_SSH_KEY:-$HOME/.ssh/pif_hetzner}"
LOCAL_PORT="${DB_TUNNEL_PORT:-13306}"

RUN_DIR="${TMPDIR:-/tmp}"
PID_FILE="$RUN_DIR/pif-db-tunnel.pid"
LOG_FILE="$RUN_DIR/pif-db-tunnel.log"

port_open() {
  nc -z 127.0.0.1 "$LOCAL_PORT" >/dev/null 2>&1
}

# Always succeeds, printing nothing when there is no tunnel, so callers can
# assign the result without `set -e` aborting the script.
tunnel_pid() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    cat "$PID_FILE"
    return 0
  fi
  # Also finds tunnels started outside this script.
  pgrep -f "ssh.*-L $LOCAL_PORT:.*:3306" 2>/dev/null | head -n1 || true
}

start() {
  if [ -n "$(tunnel_pid)" ]; then
    echo "Tunnel is already running on 127.0.0.1:$LOCAL_PORT (pid $(tunnel_pid))."
    return 0
  fi
  if port_open; then
    echo "Port $LOCAL_PORT is already taken by another process." >&2
    return 1
  fi

  # Coolify assigns the container a new bridge IP on every restart, so look it up.
  local container ip
  container=$(ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SSH_HOST" \
    "docker ps --filter ancestor=mysql:8 --format '{{.ID}}' | head -n1")
  if [ -z "$container" ]; then
    echo "No running mysql:8 container found on $SSH_HOST" >&2
    return 1
  fi

  ip=$(ssh -i "$SSH_KEY" "$SSH_HOST" \
    "docker inspect $container --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'")

  nohup ssh -i "$SSH_KEY" -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -L "$LOCAL_PORT:$ip:3306" "$SSH_HOST" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  for _ in $(seq 1 20); do
    if port_open; then
      echo "Tunnel up: 127.0.0.1:$LOCAL_PORT -> $ip:3306 (pid $(cat "$PID_FILE"))"
      return 0
    fi
    sleep 0.5
  done

  echo "Tunnel failed to open. See $LOG_FILE" >&2
  stop >/dev/null 2>&1 || true
  return 1
}

stop() {
  local pid
  pid=$(tunnel_pid)
  if [ -z "$pid" ]; then
    echo "No tunnel is running."
    rm -f "$PID_FILE"
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Tunnel stopped (pid $pid)."
}

status() {
  local pid
  pid=$(tunnel_pid)
  if [ -n "$pid" ] && port_open; then
    echo "up (pid $pid, 127.0.0.1:$LOCAL_PORT)"
  else
    echo "down"
    return 1
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; start ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac
