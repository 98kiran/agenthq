'use client'
import { useEffect, useState, useCallback } from 'react'
import { getAgentColor, PRIORITY_COLORS, relativeTime } from '@/lib/constants'

interface Task {
  id: string
  project: string
  phase: string
  agent: string
  description: string
  status: string
  priority: string
  assigned_at: string | null
  updated_at: string | null
  completed_at: string | null
  retries: number | null
  timeout_minutes: number | null
  metadata: Record<string, unknown> | null
}

interface Agent { id: string; display_name: string }

const COLUMNS = [
  { key: 'todo', label: 'Todo' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

function TaskCard({ task, onStatusChange, onArchive, agents }: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onArchive: (id: string) => void
  agents: Agent[]
}) {
  const [expanded, setExpanded] = useState(false)
  const agentColor = getAgentColor(task.agent)
  const priorityColor = PRIORITY_COLORS[task.priority] || '#6b7280'
  const agentName = agents.find(a => a.id === task.agent)?.display_name || task.agent
  const initials = (agentName || '?').slice(0, 2).toUpperCase()

  return (
    <div style={{
      background: '#0a0a0f',
      border: '1px solid #1e1e2e',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      cursor: 'pointer',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
        {task.description?.slice(0, 80)}{task.description?.length > 80 ? '…' : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: agentColor + '22', border: `1.5px solid ${agentColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: agentColor, flexShrink: 0,
        }}>{initials}</div>
        <span style={{ fontSize: 11, color: agentColor }}>{agentName}</span>
        <span style={{
          padding: '1px 7px', borderRadius: 20, fontSize: 10,
          background: priorityColor + '22', color: priorityColor, border: `1px solid ${priorityColor}44`,
          textTransform: 'capitalize',
        }}>{task.priority}</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
          {relativeTime(task.assigned_at)}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1e1e2e', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{task.description}</div>
          <div style={{ fontSize: 11, color: '#64748b', lineHeight: 2 }}>
            {task.project && <div>Project: {task.project}</div>}
            {task.phase && <div>Phase: {task.phase}</div>}
            {task.retries != null && <div>Retries: {task.retries}</div>}
            {task.timeout_minutes && <div>Timeout: {task.timeout_minutes}m</div>}
            {task.assigned_at && <div>Assigned: {new Date(task.assigned_at).toLocaleString()}</div>}
            {task.updated_at && <div>Updated: {new Date(task.updated_at).toLocaleString()}</div>}
            {task.completed_at && <div>Completed: {new Date(task.completed_at).toLocaleString()}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {COLUMNS.filter(c => c.key !== task.status).map(c => (
              <button key={c.key} onClick={() => onStatusChange(task.id, c.key)} style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 5,
                background: '#1e1e2e', color: '#94a3b8', border: '1px solid #2e2e3e', cursor: 'pointer',
              }}>→ {c.label}</button>
            ))}
            {task.status === 'done' && (
              <button onClick={() => onArchive(task.id)} style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 5,
                background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', cursor: 'pointer',
              }}>Archive</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AddTaskModal({ agents, onClose, onAdd }: {
  agents: Agent[]
  onClose: () => void
  onAdd: (task: Task) => void
}) {
  const [form, setForm] = useState({
    description: '', project: '', agent: '', priority: 'medium', status: 'todo',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.description.trim()) { setError('Description is required'); return }
    setSaving(true)
    const id = `task-${Date.now()}`
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Failed'); return }
    onAdd(data)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12,
        padding: 28, width: 440, maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Add Task</div>
        {(['description', 'project'] as const).map(f => (
          <div key={f} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{f}</label>
            <input
              value={form[f]}
              onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              placeholder={f === 'description' ? 'Task description...' : 'Project name'}
              style={{
                width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e',
                color: '#e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 13,
              }}
            />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Agent</label>
          <select value={form.agent} onChange={e => setForm(p => ({ ...p, agent: e.target.value }))} style={{
            width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e',
            color: '#e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 13,
          }}>
            <option value="">— None —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {(['priority', 'status'] as const).map(f => (
            <div key={f} style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{f}</label>
              <select value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} style={{
                width: '100%', background: '#0a0a0f', border: '1px solid #1e1e2e',
                color: '#e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 13,
              }}>
                {f === 'priority'
                  ? ['low','medium','high','critical'].map(v => <option key={v} value={v}>{v}</option>)
                  : ['todo','in-progress','review','done'].map(v => <option key={v} value={v}>{v}</option>)
                }
              </select>
            </div>
          ))}
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', background: '#1e1e2e', color: '#94a3b8',
            border: '1px solid #2e2e3e', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{
            padding: '8px 18px', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>{saving ? 'Saving…' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterAgent, setFilterAgent] = useState('')
  const [filterProject, setFilterProject] = useState('')

  const load = useCallback(async () => {
    const [tasksRes, agentsRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/agents'),
    ])
    const [tasksData, agentsData] = await Promise.all([tasksRes.json(), agentsRes.json()])
    if (Array.isArray(tasksData)) setTasks(tasksData)
    if (Array.isArray(agentsData)) setAgents(agentsData)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  const updateStatus = async (id: string, status: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
  }

  const archive = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'archived' }),
    })
  }

  const projects = Array.from(new Set(tasks.map(t => t.project).filter(Boolean)))

  const filtered = tasks.filter(t => {
    if (filterAgent && t.agent !== filterAgent) return false
    if (filterProject && t.project !== filterProject) return false
    return true
  })

  const getColumn = (col: string) => filtered.filter(t => t.status === col)

  if (loading) return <div style={{ color: '#64748b' }}>Loading tasks...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={{
          background: '#111118', border: '1px solid #1e1e2e', color: '#94a3b8',
          borderRadius: 6, padding: '6px 12px', fontSize: 13,
        }}>
          <option value="">All agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{
          background: '#111118', border: '1px solid #1e1e2e', color: '#94a3b8',
          borderRadius: 6, padding: '6px 12px', fontSize: 13,
        }}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} style={{
          marginLeft: 'auto', padding: '7px 18px', background: '#7c3aed',
          color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}>+ Add Task</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        alignItems: 'start',
      }}>
        {COLUMNS.map(col => {
          const colTasks = getColumn(col.key)
          return (
            <div key={col.key} style={{
              background: '#111118',
              border: '1px solid #1e1e2e',
              borderRadius: 10,
              padding: 14,
              minHeight: 200,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{col.label}</span>
                <span style={{
                  background: '#1e1e2e', borderRadius: 20, padding: '1px 8px',
                  fontSize: 11, color: '#64748b',
                }}>{colTasks.length}</span>
              </div>
              {colTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onStatusChange={updateStatus}
                  onArchive={archive}
                  agents={agents}
                />
              ))}
              {colTasks.length === 0 && (
                <div style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', paddingTop: 20 }}>
                  Empty
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <AddTaskModal
          agents={agents}
          onClose={() => setShowModal(false)}
          onAdd={task => setTasks(prev => [task, ...prev])}
        />
      )}
    </div>
  )
}
