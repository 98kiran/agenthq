// Shared API fetch helper
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  return res.json()
}

export function fetchAgents() {
  return apiFetch<Agent[]>('/api/agents')
}

export function fetchTasks() {
  return apiFetch<Task[]>('/api/tasks')
}

export function fetchTimeline(limit = 100) {
  return apiFetch<{ events: TimelineEvent[]; agents: Record<string, AgentMeta> } | TimelineEvent[]>(
    `/api/timeline?limit=${limit}`
  ).then(data => {
    if (Array.isArray(data)) return { events: data, agents: {} }
    return { events: data.events || [], agents: data.agents || {} }
  })
}

export function fetchHealth() {
  return apiFetch<HealthData>('/api/health')
}

// Types
export interface Agent {
  id: string
  display_name: string
  role: string
  model: string
  status: string
  last_active: string | null
  session_count: number | null
  emoji: string | null
  color: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

export interface Task {
  id: string
  description: string
  status: string
  project: string
  agent: string
  phase: string
  priority: string
  updated_at: string
  assigned_at: string | null
  completed_at: string | null
  retries: number | null
  timeout_minutes: number | null
  metadata: Record<string, unknown> | null
}

export interface TimelineEvent {
  id: string
  agent: string
  timestamp: number
  title: string
  type: string
}

export interface AgentMeta {
  emoji: string
  color: string
  display_name: string
}

export interface HealthData {
  disk: { percent: string; free: string; total: string }
  ram: { used: number; total: number; percent: string }
  uptime: string
  cpu: string
}
