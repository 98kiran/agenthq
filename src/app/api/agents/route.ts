import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getLiveAgents } from '@/lib/gateway'
export const dynamic = 'force-dynamic'

const PALETTE = [
  '#7c3aed', '#2563eb', '#dc2626', '#0ea5e9', '#14b8a6',
  '#d97706', '#8b5cf6', '#059669', '#e11d48', '#0284c7',
]

export async function GET() {
  try {
    const db = getDB()
    const agents = await db.getAgents()

    // Get live data from gateway (non-blocking -- falls back to DB data)
    let liveAgents: Awaited<ReturnType<typeof getLiveAgents>> = []
    try {
      liveAgents = await getLiveAgents()
    } catch {
      // Gateway unavailable -- use DB data only
    }
    const liveMap = new Map(liveAgents.map(a => [a.id, a]))

    // Merge: DB provides emoji/color/display_name, gateway provides live status/model/tokens
    const enriched = agents.map((a, i) => {
      const live = liveMap.get(a.id)
      return {
        ...a,
        color: a.color && a.color !== '#8c8c9a' ? a.color : PALETTE[i % PALETTE.length],
        emoji: a.emoji && a.emoji !== '🤖' ? a.emoji : '🤖',
        display_name: a.display_name || a.id.charAt(0).toUpperCase() + a.id.slice(1),
        // Live data overrides (if gateway available)
        // Model: prefer DB value (manually set, correct) over gateway (session store, may be wrong due to OpenClaw bug)
        ...(live ? {
          status: live.status,
          model: a.model || live.model,
          last_active: live.last_active,
          session_count: live.session_count,
          total_tokens: live.total_tokens,
        } : {}),
      }
    })

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
