# AgentHQ

A slim operations dashboard for [OpenClaw](https://github.com/openclaw/openclaw) agent teams. See who's online, what they're working on, and what happened -- all in real time.

**3 pages. 4 API routes. Zero bloat.**

- **Dashboard** -- agent status cards, stat overview, recent activity
- **Timeline** -- full audit trail with agent filter pills, date grouping, expandable details
- **Task Board** -- Kanban columns (todo / in-progress / review / done) with archived task grid

## Quick Start

```bash
git clone https://github.com/98kiran/agenthq.git
cd agenthq

# SQLite (zero dependencies)
bash setup.sh sqlite

# Start
npx pm2 start npm --name agenthq -- start
```

Setup prints your login URL and generated password.

## Docker

```bash
git clone https://github.com/98kiran/agenthq.git
cd agenthq
docker compose up -d
```

Visit `http://localhost:3000`. Default password: `changeme` (set `AUTH_PASSWORD` in environment).

## Supabase Mode

For cloud persistence + multi-device access:

```bash
bash setup.sh supabase <your-supabase-url> <your-service-role-key>
```

Run `schema.sql` in your Supabase SQL editor to create tables, then start normally.

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

The agent will clone the repo, run setup, and start the dashboard.

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
```

No external API keys required. No Postgres. No Docker (unless you want it).

## License

MIT
