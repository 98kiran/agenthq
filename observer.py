#!/usr/bin/env python3
"""
AgentHQ Session Observer
========================
Watches OpenClaw session data and auto-syncs to Supabase.

Runs every 60s. Reads from OpenClaw's own session store files.
No discipline required from Nova -- this observes and records everything.

What it does:
1. Scans all agent session stores for new/changed sessions
2. Auto-creates Supabase tasks for new subagent sessions
3. Auto-updates task status when sessions complete
4. Auto-logs timeline events for lifecycle transitions
5. Updates agent_config with latest health data
"""

import json
import os
import time
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

# ── Config ──────────────────────────────────────────────
CONFIG_ENV = Path.home() / ".openclaw" / "config.env"
OC_BASE = Path.home() / ".openclaw"
AGENTS_DIR = OC_BASE / "agents"
STATE_FILE = Path(__file__).parent / ".observer-state.json"

# Load env
def load_env():
    env = {}
    if CONFIG_ENV.exists():
        for line in CONFIG_ENV.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
SUPABASE_URL = ENV.get("SUPABASE_URL", "")
SUPABASE_KEY = ENV.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in config.env")
    sys.exit(1)

# ── State Management ────────────────────────────────────
def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except:
            pass
    return {"known_sessions": {}, "last_run": 0}

def save_state(state):
    state["last_run"] = int(time.time() * 1000)
    STATE_FILE.write_text(json.dumps(state, indent=2))

# ── Supabase Helpers ────────────────────────────────────
def supabase_request(method, path, data=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(data).encode() if data else None
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201, 204):
                try:
                    return json.loads(resp.read())
                except:
                    return {"ok": True}
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"  Supabase {method} {path}: HTTP {e.code} - {body[:200]}")
        return None
    except Exception as e:
        print(f"  Supabase {method} {path}: {e}")
        return None

def supabase_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"  Supabase GET {path}: {e}")
        return None

# ── OpenClaw Session Reading ────────────────────────────
def get_all_sessions():
    """Read session data from all agent session stores."""
    sessions = []
    
    # Find all agent directories
    if not AGENTS_DIR.exists():
        return sessions
    
    for agent_dir in AGENTS_DIR.iterdir():
        if not agent_dir.is_dir():
            continue
        
        agent_id = agent_dir.name
        session_file = agent_dir / "sessions" / "sessions.json"
        
        if not session_file.exists():
            continue
        
        try:
            data = json.loads(session_file.read_text())
            # sessions.json is a dict of session_key -> session_data
            if isinstance(data, dict):
                for key, sess in data.items():
                    sess["_key"] = key
                    sess["_agent_id"] = agent_id
                    sessions.append(sess)
            elif isinstance(data, list):
                for sess in data:
                    sess["_agent_id"] = agent_id
                    sessions.append(sess)
        except Exception as e:
            print(f"  Error reading {session_file}: {e}")
    
    return sessions

def extract_subagent_sessions(sessions):
    """Find sessions that are subagent spawns (the ones we want to auto-track)."""
    subagent_sessions = []
    for s in sessions:
        key = s.get("_key", s.get("key", ""))
        if ":subagent:" in key:
            subagent_sessions.append(s)
    return subagent_sessions

def session_is_complete(session):
    """Heuristic: session is complete if it has output tokens and hasn't been updated recently."""
    updated_at = session.get("updatedAt", 0)
    age_ms = int(time.time() * 1000) - updated_at
    has_output = session.get("outputTokens", 0) > 0
    # If session hasn't been updated in 5 minutes and has output, it's done
    return has_output and age_ms > 300_000

def session_is_active(session):
    """Session updated in last 5 minutes."""
    updated_at = session.get("updatedAt", 0)
    age_ms = int(time.time() * 1000) - updated_at
    return age_ms < 300_000

# ── Core Observer Logic ─────────────────────────────────
def observe():
    print(f"\n[{datetime.now(timezone.utc).isoformat()}] Observer running...")
    
    state = load_state()
    known = state.get("known_sessions", {})
    
    sessions = get_all_sessions()
    print(f"  Found {len(sessions)} total sessions")
    
    subagent_sessions = extract_subagent_sessions(sessions)
    print(f"  Found {len(subagent_sessions)} subagent sessions")
    
    # Get existing tasks from Supabase
    existing_tasks = supabase_get("tasks?select=id,status&status=neq.archived") or []
    existing_task_ids = {t["id"] for t in existing_tasks}
    
    new_tasks = 0
    updated_tasks = 0
    timeline_events = 0
    
    for sess in subagent_sessions:
        key = sess.get("_key", "")
        agent_id = sess.get("_agent_id", "unknown")
        session_id = sess.get("sessionId", "")
        model = sess.get("model", "unknown")
        tokens = sess.get("totalTokens", 0)
        updated_at = sess.get("updatedAt", 0)
        
        # Generate a stable task ID from the session key
        # Extract the UUID from the subagent key
        parts = key.split(":")
        task_id = f"auto-{parts[-1][:12]}" if len(parts) > 3 else f"auto-{session_id[:12]}"
        
        prev_state = known.get(key, {})
        prev_status = prev_state.get("status", "unknown")
        
        # Determine current status
        if session_is_active(sess):
            current_status = "in-progress"
        elif session_is_complete(sess):
            current_status = "done"
        else:
            current_status = "in-progress"  # Default to in-progress
        
        # New session we haven't seen before
        if key not in known:
            print(f"  NEW: {key} (agent={agent_id}, tokens={tokens})")
            
            # Try to get task description from session transcript
            description = f"Subagent task for {agent_id} (session {session_id[:8]})"
            
            # Create task in Supabase (upsert)
            task_data = {
                "id": task_id,
                "project": "AgentHQ" if "agenthq" in key.lower() else "Auto-tracked",
                "phase": "coding",
                "agent": agent_id,
                "description": description,
                "status": current_status,
                "priority": "medium",
                "assigned_at": datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).isoformat(),
                "updated_at": datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).isoformat(),
                "metadata": json.dumps({"session_key": key, "model": model, "auto_tracked": True}),
            }
            
            if task_id not in existing_task_ids:
                result = supabase_request("POST", "tasks", task_data)
                if result is not None:
                    new_tasks += 1
                    # Timeline event for new spawn
                    supabase_request("POST", "timeline_events", {
                        "agent": agent_id,
                        "event_type": "spawn",
                        "title": f"Agent {agent_id} spawned (auto-detected)",
                        "description": f"Model: {model}, Session: {session_id[:8]}",
                        "timestamp": datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).isoformat(),
                    })
                    timeline_events += 1
        
        # Status changed
        elif prev_status != current_status:
            print(f"  UPDATED: {key} {prev_status} -> {current_status}")
            
            patch_data = {
                "status": current_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if current_status == "done":
                patch_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            supabase_request("PATCH", f"tasks?id=eq.{task_id}", patch_data)
            updated_tasks += 1
            
            # Timeline event for completion
            if current_status == "done":
                supabase_request("POST", "timeline_events", {
                    "agent": agent_id,
                    "event_type": "completion",
                    "title": f"Agent {agent_id} task completed (auto-detected)",
                    "description": f"Tokens used: {tokens}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                timeline_events += 1
        
        # Update known state
        known[key] = {
            "status": current_status,
            "agent_id": agent_id,
            "tokens": tokens,
            "updated_at": updated_at,
            "task_id": task_id,
        }
    
    # ── Update agent_config health ──────────────────────
    agent_last_active = {}
    agent_session_counts = {}
    
    for sess in sessions:
        agent_id = sess.get("_agent_id", "")
        updated_at = sess.get("updatedAt", 0)
        
        if agent_id not in agent_last_active or updated_at > agent_last_active[agent_id]:
            agent_last_active[agent_id] = updated_at
        
        agent_session_counts[agent_id] = agent_session_counts.get(agent_id, 0) + 1
    
    for agent_id, last_active_ms in agent_last_active.items():
        age_ms = int(time.time() * 1000) - last_active_ms
        
        if age_ms < 300_000:  # 5 min
            status = "online"
        elif age_ms < 3_600_000:  # 1 hour
            status = "idle"
        else:
            status = "offline"
        
        supabase_request("PATCH", f"agent_config?id=eq.{agent_id}", {
            "status": status,
            "last_active": datetime.fromtimestamp(last_active_ms / 1000, tz=timezone.utc).isoformat(),
            "session_count": agent_session_counts.get(agent_id, 0),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    
    # Save state
    state["known_sessions"] = known
    save_state(state)
    
    print(f"  Results: {new_tasks} new tasks, {updated_tasks} updated, {timeline_events} timeline events")
    print(f"  Agent health updated for {len(agent_last_active)} agents")

# ── Main ────────────────────────────────────────────────
if __name__ == "__main__":
    observe()
