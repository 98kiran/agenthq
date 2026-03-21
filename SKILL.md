# AgentHQ Skill

Install AgentHQ in full Supabase mode for the complete ops dashboard: timeline, task board, dispatcher, observer, and gateway WebSocket support.

## Recommended install flow

Do not use the default SQLite quick install if the goal is the full dashboard experience.

1. Get the user's Supabase project URL and `service_role` key.
2. Clone or update the repo in `~/.openclaw/workspace/agenthq`.
3. Install Python requirements:

```bash
pip3 install -r requirements.txt --break-system-packages 2>/dev/null || pip3 install -r requirements.txt --user
```

4. Run Supabase setup:

```bash
bash setup.sh supabase <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY>
```

5. Apply `schema.sql` in the user's Supabase SQL Editor.
6. Add gateway values to `.env.local`:

```env
SUPABASE_URL=<url>
SUPABASE_KEY=<service role key>
GATEWAY_WS_URL=ws://127.0.0.1:18789
GATEWAY_TOKEN=<from ~/.openclaw/openclaw.json>
GATEWAY_ORIGIN=http://localhost:3000
```

Keep the generated `AUTH_SECRET` and `AUTH_PASSWORD` from `setup.sh`.

7. Start services:

```bash
npx pm2 start npm --name agenthq -- start
SUPABASE_URL=<url> SUPABASE_KEY=<key> GATEWAY_URL=http://127.0.0.1:18789 GATEWAY_TOKEN=<token> npx pm2 start python3 --name agenthq-dispatcher -- dispatcher.py
npx pm2 save
```

8. Install observer cron every 30 seconds:

```bash
(crontab -l 2>/dev/null; echo "* * * * * cd $HOME/.openclaw/workspace/agenthq && python3 observer.py >> observer.log 2>&1") | sort -u | crontab -
(crontab -l 2>/dev/null; echo "* * * * * sleep 30 && cd $HOME/.openclaw/workspace/agenthq && python3 observer.py >> observer.log 2>&1") | sort -u | crontab -
```

## Quick installer note

`install.sh` is still useful as a fast local bootstrap, but it currently defaults to SQLite:

```bash
cd ~/.openclaw/workspace
curl -fsSL https://raw.githubusercontent.com/98kiran/agenthq/master/install.sh | bash
```

Use the Supabase flow above when the user wants the complete AgentHQ setup.
