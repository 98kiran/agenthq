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

# Also load .env.local from the agenthq directory
DOTENV_LOCAL = Path(__file__).parent / ".env.local"
if DOTENV_LOCAL.exists():
    for line in DOTENV_LOCAL.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            ENV.setdefault(k.strip(), v.strip())

DB_MODE = os.environ.get("DB_MODE", ENV.get("DB_MODE", "supabase"))
SUPABASE_URL = os.environ.get("SUPABASE_URL", ENV.get("SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", ENV.get("SUPABASE_SERVICE_KEY", ENV.get("SUPABASE_KEY", "")))
SQLITE_PATH = os.environ.get("SQLITE_PATH", ENV.get("SQLITE_PATH", str(Path(__file__).parent / "data" / "agenthq.db")))

if DB_MODE == "supabase" and (not SUPABASE_URL or not SUPABASE_KEY):
    print("ERROR: SUPABASE_URL or SUPABASE_KEY not found. Set DB_MODE=sqlite for offline mode.")
    sys.exit(1)

# ── SQLite backend ──────────────────────────────────────
_sqlite_conn = None
def get_sqlite():
    global _sqlite_conn
    if _sqlite_conn is None:
        import sqlite3
        os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
        _sqlite_conn = sqlite3.connect(SQLITE_PATH)
        _sqlite_conn.row_factory = sqlite3.Row
        _sqlite_conn.execute("PRAGMA journal_mode=WAL")
        _sqlite_conn.executescript("""
            CREATE TABLE IF NOT EXISTS agent_config (
                id TEXT PRIMARY KEY, display_name TEXT, role TEXT DEFAULT '',
                model TEXT DEFAULT '', status TEXT DEFAULT 'offline',
                emoji TEXT DEFAULT '🤖', color TEXT DEFAULT '#8c8c9a',
                last_active TEXT, session_key TEXT, session_count INTEGER DEFAULT 0,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, description TEXT, project TEXT, agent TEXT,
                priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'todo', phase TEXT,
                assigned_at TEXT, updated_at TEXT, completed_at TEXT,
                retries INTEGER DEFAULT 0, timeout_minutes INTEGER DEFAULT 30, metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS timeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, event_type TEXT,
                title TEXT, description TEXT, timestamp TEXT, status TEXT
            );
        """)
    return _sqlite_conn

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

# ── DB abstraction wrappers ─────────────────────────────
def db_get(table, filters=None, select="*"):
    """Get rows from table. filters is a dict of column=value."""
    if DB_MODE == "sqlite":
        conn = get_sqlite()
        where = []
        params = []
        if filters:
            for k, v in filters.items():
                if k.endswith("__neq"):
                    where.append(f"{k[:-5]} != ?")
                    params.append(v)
                else:
                    where.append(f"{k} = ?")
                    params.append(v)
        clause = f" WHERE {' AND '.join(where)}" if where else ""
        rows = conn.execute(f"SELECT {select} FROM {table}{clause}", params).fetchall()
        return [dict(r) for r in rows]
    else:
        path = f"{table}?select={select}"
        if filters:
            for k, v in filters.items():
                if k.endswith("__neq"):
                    path += f"&{k[:-5]}=neq.{v}"
                else:
                    path += f"&{k}=eq.{v}"
        return supabase_get(path)

def db_upsert(table, data):
    """Insert or update a row."""
    if DB_MODE == "sqlite":
        conn = get_sqlite()
        cols = list(data.keys())
        placeholders = ",".join(["?"] * len(cols))
        updates = ",".join([f"{c}=excluded.{c}" for c in cols if c != "id"])
        conn.execute(
            f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders}) ON CONFLICT(id) DO UPDATE SET {updates}",
            list(data.values())
        )
        conn.commit()
        return {"ok": True}
    else:
        return supabase_request("POST", table, data)

def db_update(table, id_field, id_value, data):
    """Update rows matching id."""
    if DB_MODE == "sqlite":
        conn = get_sqlite()
        sets = ",".join([f"{k}=?" for k in data.keys()])
        conn.execute(f"UPDATE {table} SET {sets} WHERE {id_field}=?", list(data.values()) + [id_value])
        conn.commit()
        return {"ok": True}
    else:
        return supabase_request("PATCH", f"{table}?{id_field}=eq.{id_value}", data)

def db_insert(table, data):
    """Insert a row (no conflict handling)."""
    if DB_MODE == "sqlite":
        conn = get_sqlite()
        cols = list(data.keys())
        placeholders = ",".join(["?"] * len(cols))
        conn.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})", list(data.values()))
        conn.commit()
        return {"ok": True}
    else:
        return supabase_request("POST", table, data)

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
    """Session is complete if totalTokensFresh is True AND has meaningful output."""
    output_tokens = session.get("outputTokens", 0)
    
    # No output = not complete, period
    if output_tokens == 0:
        return False
    
    # Best signal: OpenClaw marks totalTokensFresh=True when a run completes
    if session.get("totalTokensFresh") == True and output_tokens > 0:
        return True
    
    # Fallback heuristic: inactive for 5 min with output
    updated_at = session.get("updatedAt", 0)
    age_ms = int(time.time() * 1000) - updated_at
    return output_tokens > 0 and age_ms > 300_000

def session_is_active(session):
    """Session updated in last 5 minutes."""
    updated_at = session.get("updatedAt", 0)
    age_ms = int(time.time() * 1000) - updated_at
    return age_ms < 300_000

# ── Core Observer Logic ─────────────────────────────────
def observe():
    # Silent unless changes detected
    
    state = load_state()
    known = state.get("known_sessions", {})
    
    sessions = get_all_sessions()
    subagent_sessions = extract_subagent_sessions(sessions)
    
    # Get existing tasks
    existing_tasks = db_get("tasks", {"status__neq": "archived"}, "id,status") or []
    existing_task_ids = {t["id"] for t in existing_tasks}
    
    new_tasks = 0
    updated_tasks = 0
    timeline_events = 0
    
    # Also check for manually-created tasks that already track a session
    existing_tasks_full = db_get("tasks", {"status__neq": "archived"}, "id,status,metadata") or []
    tracked_sessions = set()
    for t in existing_tasks_full:
        meta = t.get("metadata")
        if meta:
            if isinstance(meta, str):
                try: meta = json.loads(meta)
                except: meta = {}
            sk = meta.get("session_key", "")
            if sk:
                tracked_sessions.add(sk)
    
    for sess in subagent_sessions:
        key = sess.get("_key", "")
        agent_id = sess.get("_agent_id", "unknown")
        session_id = sess.get("sessionId", "")
        model = sess.get("model", "unknown")
        tokens = sess.get("totalTokens", 0)
        updated_at = sess.get("updatedAt", 0)
        label = sess.get("label", "")
        spawned_by = sess.get("spawnedBy", "")
        
        # Skip CREATION if a manually-created task already tracks this session
        # But still allow status updates for auto-created tasks
        manually_tracked = False
        if key in tracked_sessions and key not in known:
            # This is a manual task we haven't seen before - skip creation only
            manually_tracked = True
        
        # Generate a stable task ID from the label or session key
        parts = key.split(":")
        if label:
            task_id = f"auto-{label}"
        else:
            task_id = f"auto-{parts[-1][:12]}" if len(parts) > 3 else f"auto-{session_id[:12]}"
        
        prev_state = known.get(key, {})
        prev_status = prev_state.get("status", "unknown")
        
        # Determine current status
        if session_is_complete(sess):
            current_status = "done"
        elif session_is_active(sess):
            current_status = "done"
        else:
            current_status = "in-progress"
        
        # New session we haven't seen before
        if key not in known and not manually_tracked:
            # Build description from label and context
            if label:
                description = label.replace("-", " ").replace("_", " ").title()
            else:
                description = f"Subagent task for {agent_id} (session {session_id[:8]})"
            
            # Derive project from label
            project = "General"
            if label:
                for keyword in ["agenthq", "agent-hq", "agentHQ"]:
                    if keyword.lower() in label.lower():
                        project = "AgentHQ"
                        break
            
            print(f"  NEW: {label or key[:50]} (agent={agent_id}, tokens={tokens})")
            
            task_data = {
                "id": task_id,
                "project": project,
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
                result = db_upsert("tasks", task_data)
                if result is not None:
                    new_tasks += 1
                    # Timeline event for new spawn
                    display_name = agent_id.title() if agent_id != "main" else "Main Agent"
                    db_insert("timeline_events", {
                        "agent": agent_id,
                        "event_type": "assignment",
                        "title": f"Started: {description}",
                        "description": f"Assigned to {display_name}",
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
            
            db_update("tasks", "id", task_id, patch_data)
            updated_tasks += 1
            
            # Timeline event for completion
            if current_status == "done":
                task_label = known.get(key, {}).get("task_id", task_id).replace("auto-", "").replace("-", " ").replace("_", " ").title()
                db_insert("timeline_events", {
                    "agent": agent_id,
                    "event_type": "task_complete",
                    "title": f"Task complete: {task_label}",
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
    
    # ── Track activity from persistent sessions (main, discord, telegram) ──
    for sess in sessions:
        key = sess.get("_key", "")
        if ":subagent:" in key:
            continue  # already handled above
        
        agent_id = sess.get("_agent_id", "")
        tokens = sess.get("totalTokens", 0)
        output_tokens = sess.get("outputTokens", 0)
        updated_at = sess.get("updatedAt", 0)
        
        if not agent_id or tokens == 0:
            continue
        
        prev = known.get(key, {})
        prev_tokens = prev.get("tokens", 0)
        token_delta = tokens - prev_tokens
        
        # Log activity when meaningful new tokens (>500 = real work, not just a ping)
        # Skip first observation (prev_tokens == 0 means we haven't seen this session before)
        if token_delta > 500 and prev_tokens > 0:
            display_name = agent_id.title() if agent_id != "main" else "Main Agent"
            # Determine session type from key
            if ":discord:" in key:
                session_type = "Discord"
            elif ":telegram:" in key:
                session_type = "Telegram"
            else:
                session_type = "main"
            
            db_insert("timeline_events", {
                "agent": agent_id,
                "event_type": "session",
                "title": f"{display_name} active ({session_type})",
                "description": f"+{token_delta:,} tokens",
                "timestamp": datetime.fromtimestamp(updated_at / 1000, tz=timezone.utc).isoformat(),
            })
            timeline_events += 1
        
        # Always update known state for persistent sessions
        known[key] = {
            "status": "active",
            "agent_id": agent_id,
            "tokens": tokens,
            "updated_at": updated_at,
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
    
    agents_updated = 0
    for agent_id, last_active_ms in agent_last_active.items():
        age_ms = int(time.time() * 1000) - last_active_ms
        
        if age_ms < 300_000:  # 5 min
            status = "online"
        elif age_ms < 3_600_000:  # 1 hour
            status = "idle"
        else:
            status = "offline"
        
        # Skip agent IDs that aren't in the canonical config (auto-detected from filesystem)
        # Auto-detect from OpenClaw agents directory
        canonical_agents = set()
        if AGENTS_DIR.exists():
            for d in AGENTS_DIR.iterdir():
                if d.is_dir() and (d / "sessions").exists():
                    canonical_agents.add(d.name)
        # Always include "main"
        canonical_agents.add("main")
        if agent_id not in canonical_agents:
            continue
        
        # Update if status changed OR last_active drifted more than 60s
        prev_agent = known.get(f"agent:{agent_id}", {})
        prev_last_active = prev_agent.get("last_active_ms", 0)
        status_changed = prev_agent.get("status") != status
        session_changed = prev_agent.get("session_count") != agent_session_counts.get(agent_id, 0)
        active_drifted = abs(last_active_ms - prev_last_active) > 60_000
        
        if status_changed or session_changed or active_drifted:
            db_update("agent_config", "id", agent_id, {
                "status": status,
                "last_active": datetime.fromtimestamp(last_active_ms / 1000, tz=timezone.utc).isoformat(),
                "session_count": agent_session_counts.get(agent_id, 0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            agents_updated += 1
            
            # Only log meaningful status transitions to timeline (not every bounce)
            prev_status_val = prev_agent.get("status", "offline")
            if status_changed and prev_status_val != status:
                # Only log: offline -> online (came online), online/idle -> offline (went offline)
                if prev_status_val == "offline" and status == "online":
                    display_name = agent_id.title() if agent_id != "main" else "Main Agent"
                    db_insert("timeline_events", {
                        "agent": agent_id,
                        "event_type": "system",
                        "title": f"{display_name} came online",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    timeline_events += 1
                elif prev_status_val in ("online", "idle") and status == "offline":
                    display_name = agent_id.title() if agent_id != "main" else "Main Agent"
                    db_insert("timeline_events", {
                        "agent": agent_id,
                        "event_type": "system",
                        "title": f"{display_name} went offline",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    timeline_events += 1
        
        known[f"agent:{agent_id}"] = {"status": status, "session_count": agent_session_counts.get(agent_id, 0), "last_active_ms": last_active_ms}
    
    # Save state
    state["known_sessions"] = known
    save_state(state)
    
    if new_tasks or updated_tasks or timeline_events or agents_updated:
        print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] {new_tasks} new, {updated_tasks} updated, {timeline_events} events, {agents_updated} agents")

# ── Main ────────────────────────────────────────────────
if __name__ == "__main__":
    observe()
