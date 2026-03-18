'use client'
import { useEffect, useState } from 'react'
import { getAgentColor, getStatusColor, getStatusLabel, relativeTime } from '@/lib/constants'

interface Agent {
  id: string
  display_name: string
  role: string
  model: string
  status: string
  last_active: string | null
  session_count: number | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

interface Task {
  id: string
  description: string
  status: string
  project: string
  updated_at: string
}

function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const color = getAgentColor(agent.id)
  const statusColor = getStatusColor(agent.status, agent.last_active)
  const statusLabel = getStatusLabel(agent.status, agent.last_active)
  const initials = (agent.display_name || agent.id).slice(0, 2).toUpperCase()

  useEffect(() => {
    if (expanded && tasks.length === 0) {
      fetch(`/api/tasks?agent=${agent.id}&limit=5`)
        .then(r => r.json())
        .then(d => Array.isArray(d) && setTasks(d.slice(0, 5)))
        .catch(() => {})
    }
  }, [expanded, agent.id, tasks.length])

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: '#111118',
        border: '1px solid #1e1e2e',
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: color + '22',
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 16, color,
          flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.display_name}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: statusColor, textTransform: 'capitalize' }}>{statusLabel}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>{agent.role}</div>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{agent.model}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
        Last active: {relativeTime(agent.last_active)}
      </div>
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid #1e1e2e', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            Sessions: {agent.session_count ?? 0}
          </div>
          {tasks.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Recent tasks:</div>
              {tasks.map(t => (
                <div key={t.id} style={{
                  fontSize: 12, color: '#94a3b8', padding: '4px 0',
                  borderBottom: '1px solid #1e1e2e',
                }}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: t.status === 'done' ? '#10b981' : t.status === 'in-progress' ? '#f59e0b' : '#6b7280',
                    marginRight: 6, verticalAlign: 'middle',
                  }} />
                  {t.description?.slice(0, 60)}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAgents(d) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div style={{ color: '#64748b' }}>Loading agents...</div>
  if (agents.length === 0) return <div style={{ color: '#64748b' }}>No agents found.</div>

  return (
    <div>
      <div style={{ marginBottom: 20, color: '#64748b', fontSize: 13 }}>
        {agents.length} agent{agents.length !== 1 ? 's' : ''} · auto-refreshes every 30s
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {agents.map(a => <AgentCard key={a.id} agent={a} />)}
      </div>
    </div>
  )
}
