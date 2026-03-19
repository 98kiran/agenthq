/**
 * Database abstraction layer for AgentHQ
 * Supports: Supabase (recommended) or SQLite (offline)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string
  display_name: string
  role: string
  model: string
  status: string
  emoji: string
  color: string
  last_active: string | null
  session_key: string | null
}

export interface Task {
  id: string
  description: string
  project: string | null
  agent: string | null
  priority: string
  status: string
  assigned_at: string
  updated_at: string
  completed_at: string | null
  retries: number
  timeout_minutes: number
  metadata: any
}

export interface TimelineEvent {
  id: string
  agent: string
  event_type: string
  title: string
  description: string | null
  timestamp: string
  status: string | null
}

// ── Database Interface ────────────────────────────────────────────────────────

export interface DB {
  // Agents
  getAgents(): Promise<AgentConfig[]>
  upsertAgent(agent: Partial<AgentConfig> & { id: string }): Promise<void>

  // Tasks
  getTasks(opts?: { status?: string; agent?: string; project?: string; includeArchived?: boolean; limit?: number; offset?: number }): Promise<Task[]>
  createTask(task: Partial<Task> & { id: string; description: string }): Promise<Task>
  updateTask(id: string, fields: Partial<Task>): Promise<Task | null>

  // Timeline
  getTimeline(opts?: { agents?: string[]; limit?: number }): Promise<TimelineEvent[]>
  insertEvent(event: Omit<TimelineEvent, 'id'>): Promise<void>
}

// ── Supabase Implementation ──────────────────────────────────────────────────

class SupabaseDB implements DB {
  private client: SupabaseClient

  constructor(url: string, key: string) {
    this.client = createClient(url, key)
  }

  async getAgents(): Promise<AgentConfig[]> {
    const { data, error } = await this.client
      .from('agent_config')
      .select('*')
      .order('display_name')
    if (error) throw new Error(error.message)
    return data || []
  }

  async upsertAgent(agent: Partial<AgentConfig> & { id: string }): Promise<void> {
    const { error } = await this.client
      .from('agent_config')
      .upsert(agent, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }

  async getTasks(opts: { status?: string; agent?: string; project?: string; includeArchived?: boolean; limit?: number; offset?: number } = {}): Promise<Task[]> {
    const limit = opts.limit || 100
    const offset = opts.offset || 0
    let query = this.client.from('tasks').select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!opts.includeArchived) query = query.neq('status', 'archived')
    if (opts.status) {
      const statuses = opts.status.split(',').map(s => s.trim())
      query = query.in('status', statuses)
    }
    if (opts.agent) query = query.eq('agent', opts.agent)
    if (opts.project) query = query.eq('project', opts.project)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  }

  async createTask(task: Partial<Task> & { id: string; description: string }): Promise<Task> {
    const row = {
      id: task.id,
      description: task.description,
      project: task.project || null,
      agent: task.agent || null,
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retries: 0,
    }
    const { data, error } = await this.client.from('tasks').insert(row).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateTask(id: string, fields: Partial<Task>): Promise<Task | null> {
    const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }
    if (fields.status === 'done') updates.completed_at = new Date().toISOString()
    const { data, error } = await this.client.from('tasks').update(updates).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async getTimeline(opts: { agents?: string[]; limit?: number } = {}): Promise<TimelineEvent[]> {
    let query = this.client
      .from('timeline_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(opts.limit || 100)
    if (opts.agents?.length) query = query.in('agent', opts.agents)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  }

  async insertEvent(event: Omit<TimelineEvent, 'id'>): Promise<void> {
    const { error } = await this.client.from('timeline_events').insert(event)
    if (error) throw new Error(error.message)
  }
}

// ── SQLite Implementation ────────────────────────────────────────────────────

class SQLiteDB implements DB {
  private dbPath: string
  private _db: any = null

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  private async db() {
    if (this._db) return this._db
    const Database = (await import('better-sqlite3')).default
    this._db = new Database(this.dbPath)
    this._db.pragma('journal_mode = WAL')
    this.initTables()
    return this._db
  }

  private initTables() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS agent_config (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT DEFAULT '',
        model TEXT DEFAULT '',
        status TEXT DEFAULT 'offline',
        emoji TEXT DEFAULT '🤖',
        color TEXT DEFAULT '#8c8c9a',
        last_active TEXT,
        session_key TEXT,
        session_count INTEGER DEFAULT 0,
        metadata TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        project TEXT,
        phase TEXT DEFAULT 'general',
        agent TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'todo',
        assigned_at TEXT,
        updated_at TEXT,
        completed_at TEXT,
        retries INTEGER DEFAULT 0,
        timeout_minutes INTEGER DEFAULT 30,
        metadata TEXT
      );
      CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT,
        event_type TEXT,
        title TEXT,
        description TEXT,
        timestamp TEXT,
        status TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_timeline_ts ON timeline_events(timestamp DESC);
    `)
  }

  async getAgents(): Promise<AgentConfig[]> {
    const d = await this.db()
    return d.prepare('SELECT * FROM agent_config ORDER BY display_name').all()
  }

  async upsertAgent(agent: Partial<AgentConfig> & { id: string }): Promise<void> {
    const d = await this.db()
    const cols = Object.keys(agent)
    const vals = Object.values(agent)
    const placeholders = cols.map(() => '?').join(',')
    const updates = cols.filter(c => c !== 'id').map(c => `${c}=excluded.${c}`).join(',')
    d.prepare(`INSERT INTO agent_config (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`).run(...vals)
  }

  async getTasks(opts: { status?: string; agent?: string; project?: string; includeArchived?: boolean; limit?: number; offset?: number } = {}): Promise<Task[]> {
    const d = await this.db()
    const where: string[] = []
    const params: any[] = []
    if (!opts.includeArchived) { where.push("status != ?"); params.push('archived') }
    if (opts.status) {
      const statuses = opts.status.split(',').map(s => s.trim())
      where.push(`status IN (${statuses.map(() => '?').join(',')})`)
      params.push(...statuses)
    }
    if (opts.agent) { where.push("agent = ?"); params.push(opts.agent) }
    if (opts.project) { where.push("project = ?"); params.push(opts.project) }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const limit = opts.limit || 100
    const offset = opts.offset || 0
    return d.prepare(`SELECT * FROM tasks ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
  }

  async createTask(task: Partial<Task> & { id: string; description: string }): Promise<Task> {
    const d = await this.db()
    const row = {
      id: task.id,
      description: task.description,
      project: task.project || null,
      agent: task.agent || null,
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retries: 0,
      timeout_minutes: 30,
      metadata: null,
      completed_at: null,
    }
    const cols = Object.keys(row)
    const placeholders = cols.map(() => '?').join(',')
    d.prepare(`INSERT INTO tasks (${cols.join(',')}) VALUES (${placeholders})`).run(...Object.values(row))
    return row as Task
  }

  async updateTask(id: string, fields: Partial<Task>): Promise<Task | null> {
    const d = await this.db()
    const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }
    if (fields.status === 'done') updates.completed_at = new Date().toISOString()
    const sets = Object.keys(updates).map(k => `${k}=?`).join(',')
    d.prepare(`UPDATE tasks SET ${sets} WHERE id=?`).run(...Object.values(updates), id)
    return d.prepare('SELECT * FROM tasks WHERE id=?').get(id)
  }

  async getTimeline(opts: { agents?: string[]; limit?: number } = {}): Promise<TimelineEvent[]> {
    const d = await this.db()
    const where: string[] = []
    const params: any[] = []
    if (opts.agents?.length) {
      where.push(`agent IN (${opts.agents.map(() => '?').join(',')})`)
      params.push(...opts.agents)
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const limit = opts.limit || 100
    return d.prepare(`SELECT * FROM timeline_events ${whereClause} ORDER BY timestamp DESC LIMIT ?`).all(...params, limit)
  }

  async insertEvent(event: Omit<TimelineEvent, 'id'>): Promise<void> {
    const d = await this.db()
    const cols = Object.keys(event)
    const placeholders = cols.map(() => '?').join(',')
    d.prepare(`INSERT INTO timeline_events (${cols.join(',')}) VALUES (${placeholders})`).run(...Object.values(event))
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

let _instance: DB | null = null

export function getDB(): DB {
  if (_instance) return _instance

  const mode = process.env.DB_MODE || 'supabase'

  if (mode === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || './data/agenthq.db'
    _instance = new SQLiteDB(dbPath)
  } else {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Set DB_MODE=sqlite for offline mode.')
    _instance = new SupabaseDB(url, key)
  }

  return _instance
}
