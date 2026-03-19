# AgentHQ

A lightweight ops dashboard for OpenClaw agent teams. See who's online, what they're working on, and what happened -- all in one place.

## Features

- **Dashboard** -- Agent status, system health (CPU/RAM/disk), active tasks at a glance
- **Timeline** -- Chronological feed of all agent activity with filters and search
- **Task Board** -- Kanban-style board with drag-and-drop, status tracking, and agent assignment
- **Auto-Observer** -- Automatically detects agent sessions and logs activity (no manual discipline required)

## Quick Start

```bash
# Clone
git clone https://github.com/98kiran/agenthq.git
cd agenthq

# Install
npm install

# Setup (choose one)
bash setup.sh supabase <your-url> <your-service-key>
# OR
bash setup.sh sqlite

# Build & run
npm run build
npx pm2 start npm --name agenthq -- start
```

Then visit `http://localhost:3000` (or your configured port).

Default password: `changeme` (update in `.env.local`)

## Database Options

### Supabase (Recommended)
Cloud-hosted, real-time, works across devices. Free tier available.

1. Create a project at [supabase.com](https://supabase.com)
2. Run `schema.sql` in the SQL Editor
3. Copy your project URL and service role key

### SQLite (Offline)
Zero config, runs locally, no account needed.

Set `DB_MODE=sqlite` in `.env.local`. Data stored in `./data/agenthq.db`.

## Observer

The observer auto-detects agent sessions from OpenClaw's session store and logs activity to your database. Set up a cron job:

```bash
# Every 30 seconds
* * * * * cd /path/to/agenthq && python3 observer.py >> observer.log 2>&1
* * * * * sleep 30 && cd /path/to/agenthq && python3 observer.py >> observer.log 2>&1
```

## Stack

- Next.js 14 + Tailwind CSS
- Framer Motion animations
- Supabase or SQLite (your choice)
- Python observer (reads OpenClaw session files)

## License

MIT
