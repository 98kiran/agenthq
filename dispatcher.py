#!/usr/bin/env python3
"""
AgentHQ Dispatcher — watches Supabase for new tasks AND polls agent health.
Zero LLM tokens. Runs as systemd/PM2 service.

Flow:
  Every 30s:
    1. Poll Supabase for tasks with status='todo'
    2. For each: send message to assigned agent via OpenClaw gateway API
    3. Flip task status to 'in-progress'
    4. Log timeline event

  Every 60s (health poll cycle):
    5. Read sessions.json for each known agent
    6. Update agent_config in Supabase (last_active, session_count, token_usage)
    7. Auto-log timeline events when agents go online/offline
"""

import os
import sys
import json
import time
import logging
import requests
from datetime import datetime, timezone

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://127.0.0.1:18789")
GATEWAY_TOKEN = os.environ.get("GATEWAY_TOKEN", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))  # task poll: seconds
HEALTH_INTERVAL = int(os.environ.get("HEALTH_INTERVAL", "60"))  # agent health poll: seconds
ACTIVE_TASKS_FILE = os.path.expanduser("~/.openclaw/workspace/active-tasks.json")
AGENTS_DIR = os.path.expanduser("~/.openclaw/agents")

# Agent ID → session key mapping
AGENT_SESSIONS = {
    "samdev": "agent:samdev:main",
    "pam": "agent:pam:main",
    "marty": "agent:marty:main",
    "scout": "agent:scout:main",
    "quill": "agent:quill:main",
    "raven": "agent:raven:main",
    "dexter": "agent:dexter:main",
    "nova": "agent:main:main",
    "main": "agent:main:main",
}

# Agents that need subagent spawns (have code/tool work)
# These get routed through Nova who spawns subagents
# Others get direct chat messages (research, content, etc.)
SPAWN_AGENTS = {"samdev", "raven", "scout", "quill", "marty"}

# Map agent IDs to display names (matches agent_config table)
AGENT_DISPLAY = {
    "samdev": "SamDev",
    "pam": "Pam",
    "marty": "Marty",
    "scout": "Scout",
    "quill": "Quill",
    "raven": "Raven",
    "dexter": "Dexter",
    "nova": "Nova",
    "main": "Nova",
}

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [dispatcher] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("dispatcher")

# ── Supabase helpers ────────────────────────────────────────────────────────
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def supabase_get(table, params=None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


def supabase_patch(table, match_params, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = {**HEADERS, "Prefer": "return=representation"}
    r = requests.patch(url, headers=h, params=match_params, json=data)
    r.raise_for_status()
    return r.json()


def claim_task_if_todo(task_id):
    """Atomically claim a task only if it is still todo.
    Returns the claimed row if successful, else None."""
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = supabase_patch(
        "tasks",
        {"id": f"eq.{task_id}", "status": "eq.todo"},
        {"status": "in-progress", "updated_at": now_iso},
    )
    return rows[0] if rows else None


def supabase_post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = {**HEADERS, "Prefer": "return=minimal"}
    r = requests.post(url, headers=h, json=data)
    r.raise_for_status()


def supabase_upsert(table, data, on_conflict="id"):
    """Upsert via PATCH (update existing row). Falls back to POST if row doesn't exist."""
    row_id = data.get("id")
    if row_id:
        # Try PATCH first (all agents are pre-seeded)
        patch_data = {k: v for k, v in data.items() if k != "id"}
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        h = {**HEADERS, "Prefer": "return=minimal"}
        r = requests.patch(url, headers=h, params={"id": f"eq.{row_id}"}, json=patch_data)
        if r.status_code in (200, 204):
            return
        # If nothing matched (new agent), fall through to insert
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = {**HEADERS, "Prefer": "return=minimal,resolution=merge-duplicates"}
    r = requests.post(url, headers=h, params={"on_conflict": on_conflict}, json=data)
    r.raise_for_status()


# ── Gateway helper ──────────────────────────────────────────────────────────
def send_to_agent(session_key, message):
    """Send a message to an agent session via OpenClaw gateway chat completions API.
    Uses stream=True and closes after receiving HTTP 200 -- fire-and-forget.
    We don't need the LLM response; we just need the message delivered."""
    parts = session_key.split(":")
    agent_id = parts[1] if len(parts) >= 2 else "main"

    url = f"{GATEWAY_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GATEWAY_TOKEN}",
        "Content-Type": "application/json",
        "x-openclaw-agent-id": agent_id,
        "x-openclaw-session-key": session_key,
    }
    payload = {
        "model": "openclaw",
        "stream": True,
        "messages": [{"role": "user", "content": message}],
    }
    try:
        # stream=True with short timeout for initial connection only
        r = requests.post(url, headers=headers, json=payload, timeout=(5, 5), stream=True)
        if r.status_code == 200:
            log.info(f"  → Agent notified via {session_key} (fire-and-forget)")
            r.close()  # Don't wait for response body
            return True
        else:
            body = r.text[:200] if not r.headers.get("transfer-encoding") else "(streaming)"
            log.warning(f"  → Gateway returned {r.status_code}: {body}")
            r.close()
            return False
    except requests.exceptions.ReadTimeout:
        # Connection established but response slow -- message was likely delivered
        log.info(f"  → Agent notified via {session_key} (timeout ok, message submitted)")
        return True
    except requests.exceptions.ConnectTimeout:
        log.error(f"  → Gateway unreachable (connect timeout)")
        return False
    except Exception as e:
        log.error(f"  → Gateway error: {e}")
        return False


# ── Sync active-tasks.json for watchdog compatibility ───────────────────────
def sync_active_tasks_file(tasks):
    """Write non-done tasks to active-tasks.json for watchdog cron."""
    try:
        active = [
            {
                "project": t.get("project", ""),
                "phase": t.get("phase", ""),
                "agent": t.get("agent", ""),
                "sessionKey": AGENT_SESSIONS.get(t.get("agent", ""), ""),
                "assignedAt": t.get("assigned_at", ""),
                "status": t.get("status", ""),
                "retries": t.get("retries", 0),
                "instruction": t.get("description", ""),
            }
            for t in tasks
            if t.get("status") in ("todo", "in-progress")
        ]
        with open(ACTIVE_TASKS_FILE, "w") as f:
            json.dump({"tasks": active}, f, indent=2)
    except Exception as e:
        log.warning(f"Failed to sync active-tasks.json: {e}")


# ── Timeline logging (with DB dedup) ──────────────────────────────────────
def log_timeline(agent, event_type, title, description=None):
    # Check if this exact event already exists in last 5 minutes
    try:
        from urllib.parse import quote
        five_min_ago = (datetime.now(timezone.utc) - __import__('datetime').timedelta(minutes=5)).isoformat()
        existing = supabase_get("timeline_events", {
            "agent": f"eq.{agent}",
            "title": f"eq.{title}",
            "timestamp": f"gte.{five_min_ago}",
            "select": "id",
            "limit": "1",
        })
        if existing:
            log.debug(f"  Skipped duplicate timeline event: {title}")
            return
    except Exception:
        pass  # If dedup check fails, log anyway
    try:
        payload = {
            "agent": agent,
            "event_type": event_type,
            "title": title,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if description:
            payload["description"] = description
        supabase_post("timeline_events", payload)
    except Exception as e:
        log.warning(f"Timeline log failed: {e}")


# ── Build task message for agent ────────────────────────────────────────────
def build_task_message(task):
    priority = task.get("priority", "medium")
    priority_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(priority, "⚪")

    msg = f"""**New Task Assigned** {priority_emoji} Priority: {priority.upper()}

**Project:** {task.get('project', 'Untitled')}
**Phase:** {task.get('phase', 'general')}
**Task ID:** {task.get('id', 'unknown')}

**Description:**
{task.get('description', 'No description provided.')}

---
Start working on this immediately. When complete:
1. Complete the work and verify it
2. Update the task status when done
3. Report completion to the main agent
"""
    return msg


# ── Agent health polling ─────────────────────────────────────────────────────
# Track previous status to detect online/offline transitions
_prev_agent_status = {}


def read_agent_sessions(agent_id):
    """Read sessions.json for a given agent, returns list of session records."""
    sessions_file = os.path.join(AGENTS_DIR, agent_id, "sessions", "sessions.json")
    if not os.path.exists(sessions_file):
        return {}
    try:
        with open(sessions_file) as f:
            data = json.load(f)
        # sessions.json is a dict {sessionKey: sessionData}
        return data
    except Exception as e:
        log.warning(f"Could not read sessions for {agent_id}: {e}")
        return {}


def compute_agent_health(agent_id):
    """
    Returns dict with:
      - last_active: ISO timestamp of most recent session activity
      - session_count: number of active (non-deleted) sessions
      - model: model from most recently active session
      - token_usage: {input, output, total} summed across all sessions
      - status: "online"|"idle"|"offline" based on last_active
    """
    sessions = read_agent_sessions(agent_id)
    if not sessions:
        return None

    most_recent_ts = 0
    most_recent_model = None
    total_input = 0
    total_output = 0
    total_tokens = 0
    active_count = 0

    for session_key, session_data in sessions.items():
        if not isinstance(session_data, dict):
            continue
        updated_at = session_data.get("updatedAt", 0)
        if updated_at > most_recent_ts:
            most_recent_ts = updated_at
            most_recent_model = session_data.get("model")
        total_input += session_data.get("inputTokens", 0)
        total_output += session_data.get("outputTokens", 0)
        total_tokens += session_data.get("totalTokens", 0)
        active_count += 1

    if most_recent_ts == 0:
        return None

    last_active_dt = datetime.fromtimestamp(most_recent_ts / 1000, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    age_minutes = (now - last_active_dt).total_seconds() / 60

    if age_minutes < 5:
        status = "online"
    elif age_minutes < 60:
        status = "idle"
    else:
        status = "offline"

    return {
        "last_active": last_active_dt.isoformat(),
        "session_count": active_count,
        "model": most_recent_model,
        "token_usage": {
            "input": total_input,
            "output": total_output,
            "total": total_tokens,
        },
        "status": status,
    }


def poll_agent_health():
    """Poll all known agents, update agent_config in Supabase, log status changes."""
    global _prev_agent_status

    agents_to_poll = [a for a in AGENT_SESSIONS.keys() if a != "main"]  # skip alias

    for agent_id in agents_to_poll:
        # Also handle "nova" → reads from "main" agent dir
        fs_agent_id = "main" if agent_id == "nova" else agent_id
        health = compute_agent_health(fs_agent_id)

        if health is None:
            log.debug(f"  No session data for {agent_id}")
            continue

        now_iso = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "id": agent_id,
            "status": health["status"],
            "last_active": health["last_active"],
            "session_count": health["session_count"],
            "metadata": {"token_usage": health["token_usage"]},
            "updated_at": now_iso,
        }
        # Don't overwrite model from session data - subagent sessions
        # inherit the caller's model, not the agent's configured model.
        # Model is set manually in agent_config and should not be auto-updated.

        try:
            supabase_upsert("agent_config", update_payload, on_conflict="id")
            log.debug(f"  Updated agent_config: {agent_id} → {health['status']}")
        except Exception as e:
            log.warning(f"  Failed to update agent_config for {agent_id}: {e}")
            continue

        # Status transitions logged by observer -- dispatcher only handles dispatch events
        _prev_agent_status[agent_id] = health["status"]

    log.debug(f"Health poll complete: {len(agents_to_poll)} agents checked")


# ── Main loop ──────────────────────────────────────────────────────────────
def run():
    if not SUPABASE_KEY:
        log.error("SUPABASE_KEY not set. Exiting.")
        sys.exit(1)
    if not GATEWAY_TOKEN:
        log.error("GATEWAY_TOKEN not set. Exiting.")
        sys.exit(1)

    log.info(f"AgentHQ Dispatcher started. Task poll: {POLL_INTERVAL}s, Health poll: {HEALTH_INTERVAL}s")
    log.info(f"Supabase: {SUPABASE_URL}")
    log.info(f"Gateway: {GATEWAY_URL}")

    last_health_poll = 0

    while True:
        now = time.time()

        # ── Health poll (every HEALTH_INTERVAL seconds) ──────────────────
        if now - last_health_poll >= HEALTH_INTERVAL:
            try:
                poll_agent_health()
            except Exception as e:
                log.error(f"Health poll error: {e}", exc_info=True)
            last_health_poll = time.time()

        # ── Task dispatch (every loop iteration = POLL_INTERVAL) ─────────
        try:
            todo_tasks = supabase_get("tasks", {
                "status": "eq.todo",
                "order": "assigned_at.asc",
            })
            in_progress_tasks = supabase_get("tasks", {
                "status": "eq.in-progress",
                "select": "id,agent,project,phase",
            })

            if todo_tasks:
                log.info(f"Found {len(todo_tasks)} todo task(s)")

            _prune_dispatched_cache()
            in_progress_ids = {t.get("id") for t in in_progress_tasks if t.get("id")}
            active_signatures = {
                (
                    (t.get("agent") or "").strip().lower(),
                    (t.get("project") or "").strip().lower(),
                    (t.get("phase") or "").strip().lower(),
                )
                for t in in_progress_tasks
            }

            for task in todo_tasks:
                task_id = task.get("id", "?")
                agent = task.get("agent", "unknown")
                project = task.get("project", "Untitled")
                phase = task.get("phase", "")
                session_key = AGENT_SESSIONS.get(agent)

                if not session_key:
                    log.warning(f"  Task {task_id}: unknown agent '{agent}', skipping")
                    continue

                if task_id in _dispatched_task_ids:
                    log.debug(f"  Task {task_id}: already dispatched this process session, skipping")
                    continue

                if task_id in in_progress_ids:
                    log.info(f"  Task {task_id}: already in-progress in database, skipping")
                    _dispatched_task_ids.add(task_id)
                    continue

                signature = (
                    (agent or "").strip().lower(),
                    (project or "").strip().lower(),
                    (phase or "").strip().lower(),
                )
                if signature in active_signatures:
                    log.warning(
                        f"  Task {task_id}: similar task already active for agent={agent} project={project} phase={phase}; skipping dispatch"
                    )
                    continue

                claimed = claim_task_if_todo(task_id)
                if not claimed:
                    log.info(f"  Task {task_id}: lost race while claiming, skipping")
                    continue

                log.info(f"  Dispatching: [{project}] → {agent}")
                _dispatched_task_ids.add(task_id)
                active_signatures.add(signature)

                message = build_task_message(task)

                if agent in SPAWN_AGENTS:
                    # Route through main agent -- it will spawn a subagent with tools
                    main_key = os.environ.get("MAIN_AGENT_SESSION", "agent:main:main")
                    spawn_msg = f"**[Auto-Dispatch]** New task for {agent}:\n\n{message}\n\n**Spawn {agent} as a subagent to execute this. Use a descriptive label based on the project name.**"
                    notified = send_to_agent(main_key, spawn_msg)
                    log.info(f"  → Routed to main agent for subagent spawn (agent={agent})")
                else:
                    # Direct chat message for non-code agents
                    notified = send_to_agent(session_key, message)

                if not notified:
                    retry_count = int(task.get("retries", 0) or 0) + 1
                    supabase_patch("tasks", {"id": f"eq.{task_id}", "status": "eq.in-progress"}, {
                        "status": "todo",
                        "retries": retry_count,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })
                    log.warning(f"  Task {task_id}: notify failed, reverted to todo (retries={retry_count})")
                    active_signatures.discard(signature)
                    continue

                log.info(f"  Task {task_id} dispatched and claimed")

                log_timeline(
                    agent="dispatcher",
                    event_type="assignment",
                    title=f"Dispatched '{project}' to {agent}" + (" (notified)" if notified else " (notify failed)"),
                )

            # Sync active-tasks.json
            all_active = supabase_get("tasks", {
                "status": "in.(\"todo\",\"in-progress\")",
            })
            sync_active_tasks_file(all_active)

        except requests.exceptions.ConnectionError:
            log.warning("Connection error (gateway or Supabase down?). Retrying...")
        except Exception as e:
            log.error(f"Loop error: {e}", exc_info=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
