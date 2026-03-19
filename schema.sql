-- AgentHQ Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS agent_config (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT '',
  model TEXT DEFAULT '',
  status TEXT DEFAULT 'offline',
  emoji TEXT DEFAULT '🤖',
  color TEXT DEFAULT '#8c8c9a',
  last_active TIMESTAMPTZ,
  session_key TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  project TEXT,
  agent TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'todo',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  retries INTEGER DEFAULT 0,
  timeout_minutes INTEGER DEFAULT 30,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id BIGSERIAL PRIMARY KEY,
  agent TEXT,
  event_type TEXT,
  title TEXT,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_ts ON timeline_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_agent ON timeline_events(agent);

-- Enable RLS (optional but recommended)
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON agent_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON timeline_events FOR ALL USING (true) WITH CHECK (true);
