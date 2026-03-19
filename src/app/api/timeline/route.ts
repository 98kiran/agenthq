import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
export const dynamic = 'force-dynamic'

const PALETTE = [
  '#7c3aed', '#2563eb', '#dc2626', '#0ea5e9', '#14b8a6',
  '#d97706', '#8b5cf6', '#059669', '#e11d48', '#0284c7',
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentFilter = searchParams.get('agents')
    const limit = parseInt(searchParams.get('limit') || '100')
    const db = getDB()

    const agents = agentFilter ? agentFilter.split(',').map(a => a.trim()) : undefined
    const data = await db.getTimeline({ agents, limit })

    // Build agent list from DB
    let agentList: { id: string; label: string; emoji: string; color: string }[] = []
    try {
      const dbAgents = await db.getAgents()
      if (dbAgents.length > 0) {
        agentList = dbAgents.map((a, i) => ({
          id: a.id,
          label: a.display_name || a.id,
          emoji: a.emoji || '🤖',
          color: (a.color && a.color !== '#8c8c9a') ? a.color : PALETTE[i % PALETTE.length],
        }))
      }
    } catch { /* empty list is fine */ }

    // Always include system agent
    if (!agentList.find(a => a.id === 'system')) {
      agentList.push({ id: 'system', label: 'System', emoji: '🤖', color: '#8c8c9a' })
    }

    const events = (data || []).map((e: any) => ({
      id: e.id,
      agent: e.agent || 'system',
      timestamp: new Date(e.timestamp).getTime(),
      title: e.title || '',
      description: e.description || '',
      type: e.event_type || 'system',
      status: e.status || '',
    }))

    return NextResponse.json({ events, agents: agentList })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
