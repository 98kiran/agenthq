# AgentHQ

A slim operations dashboard for [OpenClaw](https://github.com/openclaw/openclaw) agent teams. See who's online, what they're working on, and what happened -- all in real time.

**3 pages. 4 API routes. Zero bloat.**

- **Dashboard** -- agent status cards, stat overview, recent activity
- **Timeline** -- full audit trail with agent filter pills, date grouping, expandable details
- **Task Board** -- Kanban columns (todo / in-progress / review / done) with archived task grid

## Requirements

- Node.js 22+
- Python 3.8+
- `pip3 install -r requirements.txt --break-system-packages` on Ubuntu 24.04+ system Python

Ubuntu 24.04 ships Node 18 by default. Install Node 22 with:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Quick Start

```bash
git clone https://github.com/98kiran/agenthq.git
cd agenthq
pip3 install -r requirements.txt --break-system-packages

# SQLite (zero database services)
bash setup.sh sqlite

# Start
npx pm2 start npm --name agenthq -- start
```

Setup prints your login URL and generated password.


## Supabase Mode

For cloud persistence + multi-device access:

```bash
bash setup.sh supabase <your-supabase-url> <your-service-role-key>
pip3 install -r requirements.txt --break-system-packages
```

Run `schema.sql` in your Supabase SQL editor to create tables, then start normally.

### Dispatcher (task auto-routing)

The dispatcher watches for new tasks and routes them to agents automatically. It requires Supabase plus access to your local OpenClaw gateway.

```bash
cd ~/.openclaw/workspace/agenthq
SUPABASE_URL=<url> SUPABASE_KEY=<key> GATEWAY_URL=http://127.0.0.1:18789 GATEWAY_TOKEN=<gateway token from openclaw.json> npx pm2 start python3 --name agenthq-dispatcher -- dispatcher.py
npx pm2 save
```

Get `GATEWAY_TOKEN` from `~/.openclaw/openclaw.json` → `gateway.auth.token`.

## Observer (Auto-Detection)

The included `observer.py` watches your OpenClaw session files and automatically:
- Detects agent status (active / online / idle / offline)
- Tracks subagent task spawns and completions
- Logs timeline events

```bash
# Run every 30 seconds via cron
* * * * * cd /path/to/agenthq && python3 observer.py >> observer.log 2>&1
* * * * * sleep 30 && cd /path/to/agenthq && python3 observer.py >> observer.log 2>&1
```

## Skill-Based Install

If your OpenClaw agent has the `agenthq` skill, it can set this up for you:

> "Install AgentHQ for me"

The agent will clone the repo, install Python requirements, run setup, and start the dashboard.

## Optional: Gateway WebSocket (live agent status)

For live agent status dots (active/online/idle/offline), add to `~/.openclaw/workspace/agenthq/.env.local`:

```env
GATEWAY_WS_URL=ws://127.0.0.1:18789
GATEWAY_TOKEN=<gateway token from openclaw.json>
GATEWAY_ORIGIN=http://localhost:3000
```

## Stack

- Next.js 16 + React 19
- Tailwind CSS v3
- IBM Plex Sans + Sora (typography)
- React Query (auto-refresh)
- Framer Motion (animations)
- SQLite (default) or Supabase (optional)

## Architecture

```
AgentHQ (Next.js)
  |-- /api/agents    -> agent_config table
  |-- /api/tasks     -> tasks table
  |-- /api/timeline  -> timeline_events table
  |-- /api/health    -> disk/ram/uptime

observer.py          -> reads OpenClaw session files
                     -> writes to agent_config, tasks, timeline_events

dispatcher.py        -> polls Supabase todo tasks
                     -> routes work through OpenClaw gateway
                     -> logs assignment events
```

No external API keys required for SQLite mode. Supabase mode requires your own Supabase project plus OpenClaw gateway access for dispatcher features.

## License

MIT
