#!/bin/bash
# Usage: ./log-event.sh <agent> <type> <title> [description]
# Types: assignment, task_complete, fix, system, planning, session
# Example: ./log-event.sh nova assignment "Assigned AgentHQ CSS fix to SamDev"

AGENT="${1:?Usage: log-event.sh <agent> <type> <title> [description]}"
TYPE="${2:?Missing event type}"
TITLE="${3:?Missing title}"
DESC="${4:-}"

# Load env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_KEY)=" | xargs)
fi
# Fallback to config.env
if [ -z "$SUPABASE_URL" ] && [ -f "$HOME/.openclaw/config.env" ]; then
  source "$HOME/.openclaw/config.env"
  SUPABASE_SERVICE_KEY="$SUPABASE_KEY"
fi

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

JSON="{\"agent\":\"$AGENT\",\"event_type\":\"$TYPE\",\"title\":\"$TITLE\",\"timestamp\":\"$TS\""
[ -n "$DESC" ] && JSON="$JSON,\"description\":\"$DESC\""
JSON="$JSON}"

curl -s -X POST "$SUPABASE_URL/rest/v1/timeline_events" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$JSON" -w "%{http_code}" -o /dev/null
