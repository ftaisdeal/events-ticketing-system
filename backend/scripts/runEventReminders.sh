#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
LOG_DIR=${EVENT_REMINDER_LOG_DIR:-"$BACKEND_DIR/logs"}
LOG_FILE=${EVENT_REMINDER_LOG_FILE:-"$LOG_DIR/event-reminders.log"}
MAX_BYTES=${EVENT_REMINDER_LOG_MAX_BYTES:-10485760}
BACKUP_COUNT=${EVENT_REMINDER_LOG_BACKUPS:-5}

mkdir -p "$LOG_DIR"

rotate_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    return
  fi

  FILE_SIZE=$(wc -c < "$LOG_FILE" | tr -d ' ')
  if [ "$FILE_SIZE" -lt "$MAX_BYTES" ]; then
    return
  fi

  INDEX=$BACKUP_COUNT
  while [ "$INDEX" -gt 1 ]; do
    PREV_INDEX=$((INDEX - 1))
    if [ -f "$LOG_FILE.$PREV_INDEX" ]; then
      mv "$LOG_FILE.$PREV_INDEX" "$LOG_FILE.$INDEX"
    fi
    INDEX=$PREV_INDEX
  done

  mv "$LOG_FILE" "$LOG_FILE.1"
}

rotate_logs

cd "$BACKEND_DIR"
npm run email:send-event-reminders -- "$@" >> "$LOG_FILE" 2>&1