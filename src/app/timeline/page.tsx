'use client'
import { useEffect, useState, useCallback } from 'react'
import { getAgentColor, EVENT_TYPE_COLORS, relativeTime } from '@/lib/constants'

interface Event {
  id: string
  agent: string
  event_type: string
  title: string
  description: string
  timestamp: string
  metadata: Record<string, unknown> | null
}

const EVENT_TYPES = ['spawn', 'completion', 'error', 'assignment', 'deploy', 'system', 'cron']

export default function Timeline() {
  const [events, setEvents] = useState<Event[]>([])
  const [agents, setAgents] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const buildUrl = useCallback((off: number) => {
    const params = new URLSearchParams()
    if (selectedAgents.length) params.set('agent', selectedAgents.join(','))
    if (selectedTypes.length) params.set('event_type', selectedTypes.join(','))
    params.set('limit', '50')
    params.set('offset', String(off))
    return `/api/timeline?${params}`
  }, [selectedAgents, selectedTypes])

  const load = useCallback(async (off: number, append = false) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(off))
      const data = await res.json()
      if (!Array.isArray(data)) return
      if (append) setEvents(prev => [...prev, ...data])
      else setEvents(data)
      setHasMore(data.length === 50)
      // collect unique agents
      setAgents(prev => {
        const all = new Set([...prev, ...data.map((e: Event) => e.agent).filter(Boolean)])
        return Array.from(all).sort()
      })
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    setOffset(0)
    load(0)
  }, [selectedAgents, selectedTypes, load])

  // auto-refresh: prepend new events
  useEffect(() => {
    const t = setInterval(() => load(0), 30000)
    return () => clearInterval(t)
  }, [load])

  const loadMore = () => {
    const newOff = offset + 50
    setOffset(newOff)
    load(newOff, true)
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleAgent = (a: string) => {
    setSelectedAgents(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }
  const toggleType = (t: string) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>AGENT</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {agents.map(a => (
              <button key={a} onClick={() => toggleAgent(a)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: selectedAgents.includes(a) ? getAgentColor(a) : '#1e1e2e',
                color: selectedAgents.includes(a) ? '#fff' : '#94a3b8',
                border: 'none',
              }}>{a}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>TYPE</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EVENT_TYPES.map(t => (
              <button key={t} onClick={() => toggleType(t)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: selectedTypes.includes(t) ? (EVENT_TYPE_COLORS[t] || '#6b7280') : '#1e1e2e',
                color: selectedTypes.includes(t) ? '#fff' : '#94a3b8',
                border: 'none',
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map(ev => {
          const agentColor = getAgentColor(ev.agent)
          const typeColor = EVENT_TYPE_COLORS[ev.event_type] || '#6b7280'
          const isExp = expanded.has(ev.id)
          const longDesc = ev.description && ev.description.length > 120

          return (
            <div key={ev.id} style={{
              background: '#111118',
              border: '1px solid #1e1e2e',
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span title={new Date(ev.timestamp).toLocaleString()} style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>
                  {relativeTime(ev.timestamp)}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: agentColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: agentColor }}>{ev.agent}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11,
                  background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44`,
                }}>{ev.event_type}</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{ev.title}</span>
              </div>
              {ev.description && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                  {longDesc && !isExp
                    ? <>{ev.description.slice(0, 120)}... <button onClick={() => toggleExpand(ev.id)} style={{ color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>more</button></>
                    : <>{ev.description}{longDesc && <button onClick={() => toggleExpand(ev.id)} style={{ color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, marginLeft: 4 }}>less</button>}</>
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      {loading && <div style={{ color: '#64748b', marginTop: 16 }}>Loading...</div>}
      {!loading && hasMore && (
        <button onClick={loadMore} style={{
          marginTop: 16, padding: '8px 20px', background: '#1e1e2e',
          color: '#94a3b8', border: '1px solid #2e2e3e', borderRadius: 6, cursor: 'pointer', fontSize: 13,
        }}>Load more</button>
      )}
      {!loading && events.length === 0 && <div style={{ color: '#64748b' }}>No events found.</div>}
    </div>
  )
}
