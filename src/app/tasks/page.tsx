'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, RotateCw, ChevronRight, X, Plus, FolderKanban, Archive, ArchiveRestore } from 'lucide-react'
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

interface Agent { id: string; display_name: string; emoji?: string; color?: string }

const COLUMNS = [
  { key: 'todo',        label: 'Todo',        color: '#3b82f6' },
  { key: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'review',      label: 'Review',      color: '#7c3aed' },
  { key: 'done',        label: 'Done',        color: '#22c55e' },
]

// Agent data loaded dynamically from /api/agents -- no hardcoded agent lists

function SkeletonCard() {
  return (
    <div className="glass task-card animate-pulse" style={{ padding: 16, marginBottom: 10 }}>
      <div style={{ height: 13, width: '90%', borderRadius: 4, background: 'var(--border)', marginBottom: 10 }} />
      <div style={{ height: 13, width: '60%', borderRadius: 4, background: 'var(--border)', marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
        <div style={{ height: 24, width: 60, borderRadius: 12, background: 'var(--border)' }} />
        <div style={{ height: 24, width: 48, borderRadius: 12, background: 'var(--border)', marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

interface AgentFull { id: string; display_name: string; emoji?: string; color?: string }

function TaskCard({ task, onStatusChange, onArchive, agents }: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onArchive: (id: string) => void
  agents: AgentFull[]
}) {
  const [expanded, setExpanded] = useState(false)
  const matchedAgent = agents.find(a => a.id === task.agent)
  const agentColor = matchedAgent?.color || getAgentColor(task.agent)
  const priorityColor = PRIORITY_COLORS[task.priority] || 'var(--badge-slate)'
  const agentName = matchedAgent?.display_name || task.agent
  const agentEmoji = matchedAgent?.emoji || '🤖'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -1 }}
      className="glass task-card group"
      style={{ padding: 14, marginBottom: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Agent color strip */}
      <div style={{
        position: 'absolute', left: 0, top: 8, bottom: 8,
        width: 3, borderRadius: '0 3px 3px 0', background: agentColor,
      }} />

      <div style={{ paddingLeft: 10 }}>
        {/* Top row: agent badge + archive btn */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: agentColor + '22',
            }}>{agentEmoji}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: agentColor + '20', color: agentColor,
            }}>{agentName}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onArchive(task.id) }}
            style={{
              opacity: 0, color: 'var(--text-muted)', padding: 2, borderRadius: 4,
              background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0,
              transition: 'opacity 0.15s, color 0.15s',
            }}
            className="group-hover-archive"
            aria-label="Archive"
          >
            <X size={13} />
          </button>
        </div>

        {/* Project / description */}
        {task.project && (
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.35 }}>
            {task.project}
          </p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 8 }}>
          {task.description?.slice(0, 70)}{task.description?.length > 70 ? '…' : ''}
        </p>

        {/* Priority + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {task.priority && (
            <span className="badge" style={{
              background: priorityColor + '22', color: priorityColor,
              border: `1px solid ${priorityColor}44`, textTransform: 'capitalize',
              fontSize: 10,
            }}>{task.priority}</span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            <Clock size={10} />{relativeTime(task.assigned_at)}
          </span>
          {task.retries != null && task.retries > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#eab308' }}>
              <RotateCw size={10} />{task.retries}
            </span>
          )}
        </div>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                  {task.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
                  {task.project && <div>Project: {task.project}</div>}
                  {task.phase && <div>Phase: {task.phase}</div>}
                  {task.timeout_minutes && <div>Timeout: {task.timeout_minutes}m</div>}
                  {task.assigned_at && <div suppressHydrationWarning>Assigned: {new Date(task.assigned_at).toLocaleString()}</div>}
                  {task.updated_at && <div suppressHydrationWarning>Updated: {new Date(task.updated_at).toLocaleString()}</div>}
                  {task.completed_at && <div suppressHydrationWarning>Completed: {new Date(task.completed_at).toLocaleString()}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {COLUMNS.filter(c => c.key !== task.status).map(c => (
                    <button key={c.key} onClick={() => onStatusChange(task.id, c.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                        background: 'none', cursor: 'pointer',
                        border: `1px solid ${c.color}44`, color: c.color,
                        opacity: 0.7, transition: 'opacity 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                      onMouseOut={e => (e.currentTarget.style.opacity = '0.7')}
                    >
                      <ChevronRight size={10} /> {c.label}
                    </button>
                  ))}
                  {task.status === 'done' && (
                    <button onClick={() => onArchive(task.id)}
                      style={{
                        fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                        background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                      }}>
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        backdropFilter: 'blur(6px)',
      }} onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="card" style={{ padding: 28, width: 440, maxWidth: '90vw', borderRadius: 16 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: 'var(--text-primary)' }}>Add Task</div>
        {(['description', 'project'] as const).map(f => (
          <div key={f} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{f}</label>
            <input
              value={form[f]}
              onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              placeholder={f === 'description' ? 'Task description...' : 'Project name'}
              className="input-field"
            />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Agent</label>
          <select value={form.agent} onChange={e => setForm(p => ({ ...p, agent: e.target.value }))} className="input-field">
            <option value="">— None —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {(['priority', 'status'] as const).map(f => (
            <div key={f} style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{f}</label>
              <select value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="input-field">
                {f === 'priority'
                  ? ['low','medium','high','critical'].map(v => <option key={v} value={v}>{v}</option>)
                  : ['todo','in-progress','review','done'].map(v => <option key={v} value={v}>{v}</option>)
                }
              </select>
            </div>
          ))}
        </div>
        {error && (
          <div style={{
            color: 'var(--badge-red)', fontSize: 12, marginBottom: 12, padding: '8px 12px',
            background: 'color-mix(in srgb, var(--badge-red) 10%, transparent)', borderRadius: 6,
            border: '1px solid color-mix(in srgb, var(--badge-red) 25%, transparent)',
          }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Add Task'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterAgent, setFilterAgent] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    const [tasksRes, agentsRes, archivedRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/agents'),
      fetch('/api/tasks?include_archived=true'),
    ])
    const [tasksData, agentsData, allTasksData] = await Promise.all([tasksRes.json(), agentsRes.json(), archivedRes.json()])
    if (Array.isArray(tasksData)) setTasks(tasksData)
    if (Array.isArray(agentsData)) setAgents(agentsData)
    if (Array.isArray(allTasksData)) setArchivedTasks(allTasksData.filter((t: Task) => t.status === 'archived'))
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
    const task = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (task) setArchivedTasks(prev => [{ ...task, status: 'archived' }, ...prev])
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'archived' }),
    })
  }

  const unarchive = async (id: string) => {
    const task = archivedTasks.find(t => t.id === id)
    setArchivedTasks(prev => prev.filter(t => t.id !== id))
    if (task) setTasks(prev => [{ ...task, status: 'done' }, ...prev])
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
  }

  const projects = Array.from(new Set(tasks.map(t => t.project).filter(Boolean)))

  const filtered = tasks.filter(t => {
    if (filterAgent && t.agent !== filterAgent) return false
    if (filterProject && t.project !== filterProject) return false
    return true
  })

  const getColumn = (col: string) => {
    const colTasks = filtered.filter(t => t.status === col)
    // Limit done column to latest 5
    if (col === 'done') return colTasks.slice(0, 5)
    return colTasks
  }

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <FolderKanban size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Tasks</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {tasks.filter(t => t.status === 'in-progress').length} in progress
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
            className="input-field" style={{ width: 'auto' }}>
            <option value="">All agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="input-field" style={{ width: 'auto' }}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => setShowArchived(v => !v)}
            className={showArchived ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Archive size={14} /> {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      <div className="page-container" style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}>
          {COLUMNS.map(col => {
            const colTasks = getColumn(col.key)
            return (
              <div key={col.key} style={{ minWidth: 0 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingLeft: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    background: col.color + '18', color: col.color, marginLeft: 'auto',
                  }}>{col.key === 'done' ? `${colTasks.length}/${filtered.filter(t => t.status === 'done').length}` : colTasks.length}</span>
                </div>

                {/* Cards */}
                <AnimatePresence>
                  {loading
                    ? Array(2).fill(0).map((_, i) => <SkeletonCard key={i} />)
                    : colTasks.length === 0
                      ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          style={{
                            textAlign: 'center', padding: '32px 16px',
                            color: 'var(--text-muted)', fontSize: 12,
                            border: '1.5px dashed var(--border)', borderRadius: 12,
                          }}>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>—</div>
                          Empty
                        </motion.div>
                      )
                      : colTasks.map(t => (
                        <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onArchive={archive} agents={agents} />
                      ))
                  }
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        <AnimatePresence>
          {showModal && (
            <AddTaskModal
              agents={agents}
              onClose={() => setShowModal(false)}
              onAdd={task => setTasks(prev => [task, ...prev])}
            />
          )}
        </AnimatePresence>

        {/* Archived tasks section */}
        <AnimatePresence>
          {showArchived && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginTop: 32 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Archive size={15} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Archived Tasks
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                  background: 'var(--border)', color: 'var(--text-muted)', marginLeft: 4,
                }}>{archivedTasks.length}</span>
              </div>

              {archivedTasks.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '28px 16px',
                  color: 'var(--text-muted)', fontSize: 12,
                  border: '1.5px dashed var(--border)', borderRadius: 12,
                }}>
                  No archived tasks
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {archivedTasks.map(task => {
                    const matchedAgent = agents.find(a => a.id === task.agent)
                    const agentName = matchedAgent?.display_name || task.agent || '—'
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="glass"
                        style={{
                          padding: '10px 14px', borderRadius: 10,
                          display: 'flex', alignItems: 'center', gap: 12,
                          opacity: 0.65,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.project ? `${task.project} — ` : ''}{task.description}
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>Agent: {agentName}</span>
                            {task.completed_at && (
                              <span suppressHydrationWarning>Completed: {new Date(task.completed_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => unarchive(task.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                            background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                            border: '1px solid var(--border)', color: 'var(--text-muted)',
                            transition: 'color 0.15s, border-color 0.15s',
                          }}
                          onMouseOver={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                          <ArchiveRestore size={12} /> Unarchive
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .group:hover .group-hover-archive { opacity: 1 !important; }
        .group-hover-archive:hover { color: #ef4444 !important; }
      `}</style>
    </div>
  )
}
