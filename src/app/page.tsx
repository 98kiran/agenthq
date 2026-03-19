'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, FolderKanban, GitBranch, CheckCircle2, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getAgentColor, getStatusColor, getStatusLabel, relativeTime } from '@/lib/constants'
import { fetchAgents, fetchTasks, fetchTimeline, type Agent, type Task, type TimelineEvent } from '@/lib/api'
import { StatusDot } from '@/components/StatusDot'

function StatCardSkeleton() {
  return (
    <div className="card animate-pulse" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--border)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 22, width: 48, borderRadius: 6, background: 'var(--border)', marginBottom: 6 }} />
        <div style={{ height: 11, width: 80, borderRadius: 4, background: 'var(--border)' }} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, href, delay }: {
  label: string; value: number | string; sub?: string
  icon: React.ElementType; color: string; href: string; delay?: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay ?? 0 }}>
      <Link href={href} className="block group">
        <div className="card" style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
          borderColor: `${color}30`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{value}</p>
            <p style={{ fontSize: 11, marginTop: 2, color: 'var(--text-muted)' }}>{label}</p>
            {sub && <p style={{ fontSize: 10, color, marginTop: 1 }}>{sub}</p>}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function AgentCardSkeleton() {
  return (
    <div className="card animate-pulse" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: 100, borderRadius: 4, background: 'var(--border)', marginBottom: 6 }} />
          <div style={{ height: 11, width: 60, borderRadius: 4, background: 'var(--border)' }} />
        </div>
      </div>
      <div style={{ height: 28, borderRadius: 8, background: 'var(--border)' }} />
    </div>
  )
}

function AgentCard({ agent, recentTask, delay }: { agent: Agent; recentTask?: Task | null; delay: number }) {
  const color = getAgentColor(agent.id)
  const statusColor = getStatusColor(agent.status, agent.last_active)
  const statusLabel = getStatusLabel(agent.status, agent.last_active)
  const initials = (agent.display_name || agent.id).slice(0, 2).toUpperCase()

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: color + '1a', border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, color, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{agent.display_name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>{agent.role}</div>
        </div>
        <StatusDot status={agent.status} lastActive={agent.last_active} />
      </div>

      {/* Status + last active */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="badge" style={{
          background: statusColor + '20', color: statusColor,
          border: `1px solid ${statusColor}44`, textTransform: 'capitalize',
        }}>{statusLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {relativeTime(agent.last_active)}
        </span>
      </div>

      {/* Recent task */}
      {recentTask && (
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', padding: '7px 10px',
          background: 'var(--bg-subtle)', borderRadius: 8, lineHeight: 1.4,
          borderLeft: `3px solid ${color}`,
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'block', marginBottom: 2 }}>
            {recentTask.status === 'in-progress' ? '⚡ Working on' : '📋 Last task'}
          </span>
          {recentTask.description?.slice(0, 60)}{recentTask.description?.length > 60 ? '…' : ''}
        </div>
      )}

      {/* Model tag */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {agent.model}
      </div>
    </motion.div>
  )
}

function ActivityRowSkeleton() {
  return (
    <div className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '70%', borderRadius: 4, background: 'var(--border)', marginBottom: 4 }} />
        <div style={{ height: 10, width: 40, borderRadius: 4, background: 'var(--border)' }} />
      </div>
      <div style={{ width: 32, height: 10, borderRadius: 4, background: 'var(--border)' }} />
    </div>
  )
}

function RecentEventRow({ event }: { event: TimelineEvent }) {
  const color = getAgentColor(event.agent)
  const initials = (event.agent || '?').slice(0, 2).toUpperCase()
  const timeAgo = () => {
    if (!event.timestamp) return '—'
    const diff = Date.now() - event.timestamp
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: color + '1a', border: `1.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color, flexShrink: 0,
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
          {event.title?.slice(0, 60)}{event.title?.length > 60 ? '…' : ''}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{event.agent}</div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo()}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 15_000,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    refetchInterval: 30_000,
  })

  const { data: timelineData, isLoading: eventsLoading } = useQuery({
    queryKey: ['timeline', 10],
    queryFn: () => fetchTimeline(10),
    refetchInterval: 30_000,
  })

  const events = timelineData?.events ?? []
  const loading = agentsLoading || tasksLoading || eventsLoading

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }, [])

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  }, [])

  const inProgress = tasks.filter(t => t.status === 'in-progress')
  const todo = tasks.filter(t => t.status === 'todo')
  const done = tasks.filter(t => t.status === 'done')
  const online = agents.filter(a => a.status === 'active' || a.status === 'online')

  const getAgentTask = (agentId: string) =>
    inProgress.find(t => t.agent === agentId) ||
    tasks.filter(t => t.agent === agentId && t.status !== 'done').sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0] || null

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky-header">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}
              suppressHydrationWarning>
              {greeting ? `${greeting} 👋` : 'Dashboard'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}
              suppressHydrationWarning>{dateStr || '\u00a0'}</p>
          </div>
          <Link href="/tasks">
            <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
                background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)',
                color: '#9f6ef5',
              }}>
              <FolderKanban size={14} /> Task Board
            </motion.span>
          </Link>
        </motion.div>
      </div>

      <div className="page-container">
        {/* Briefing */}
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 24,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderLeft: '4px solid var(--accent)',
            }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
              🧠 Status
            </span>
            <p style={{ fontSize: 13, marginTop: 4, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {inProgress.length > 0
                ? `${inProgress[0].agent} is working on "${inProgress[0].description?.slice(0, 50) ?? inProgress[0].project}". ${todo.length} task${todo.length !== 1 ? 's' : ''} queued.`
                : todo.length > 0
                  ? `${todo.length} task${todo.length !== 1 ? 's' : ''} waiting to be assigned.`
                  : `All clear — ${done.length} task${done.length !== 1 ? 's' : ''} completed.`
              }
              {' '}{online.length > 0
                ? `${online.length} agent${online.length !== 1 ? 's' : ''} online.`
                : 'All agents idle.'}
            </p>
          </motion.div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
          {loading
            ? Array(4).fill(0).map((_, i) => <StatCardSkeleton key={i} />)
            : <>
                <StatCard label="Agents" value={agents.length} sub={`${online.length} online`}
                  icon={Users} color="#7c3aed" href="/" delay={0.1} />
                <StatCard label="In Progress" value={inProgress.length} icon={Clock} color="#f59e0b" href="/tasks" delay={0.13}
                  sub={inProgress.length > 0 ? inProgress.map(t => t.agent).join(', ') : undefined} />
                <StatCard label="Queued" value={todo.length} icon={FolderKanban} color="#3b82f6" href="/tasks" delay={0.16} />
                <StatCard label="Completed" value={done.length} icon={CheckCircle2} color="#10b981" href="/tasks" delay={0.19} />
              </>
          }
        </div>

        {/* Two-column: agents + recent activity */}
        <div className="dashboard-grid" style={{ display: 'grid', gap: 24, alignItems: 'start' }}>
          {/* Agents grid */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Agents
            </div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {Array(4).fill(0).map((_, i) => <AgentCardSkeleton key={i} />)}
              </div>
            ) : agents.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Users size={28} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                <p>No agents registered yet</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {agents.map((a, i) => <AgentCard key={a.id} agent={a} recentTask={getAgentTask(a.id)} delay={0.22 + i * 0.05} />)}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent Activity
              </div>
              <Link href="/timeline" style={{ fontSize: 11, color: 'var(--accent)' }}>
                View all →
              </Link>
            </div>
            <div className="card" style={{ padding: '8px 16px' }}>
              {loading
                ? Array(5).fill(0).map((_, i) => <ActivityRowSkeleton key={i} />)
                : events.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    <GitBranch size={22} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  events.slice(0, 8).map(ev => <RecentEventRow key={ev.id} event={ev} />)
                )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard-grid { grid-template-columns: 1fr 320px; }
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
