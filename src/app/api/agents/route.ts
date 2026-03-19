import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
export const dynamic = 'force-dynamic'

const PALETTE = [
  '#7c3aed', '#2563eb', '#dc2626', '#0ea5e9', '#14b8a6',
  '#d97706', '#8b5cf6', '#059669', '#e11d48', '#0284c7',
]

export async function GET() {
  try {
    const db = getDB()
    const agents = await db.getAgents()

    // Ensure every agent has color and emoji
    const enriched = agents.map((a, i) => ({
      ...a,
      color: a.color && a.color !== '#8c8c9a' ? a.color : PALETTE[i % PALETTE.length],
      emoji: a.emoji && a.emoji !== '🤖' ? a.emoji : '🤖',
      display_name: a.display_name || a.id.charAt(0).toUpperCase() + a.id.slice(1),
    }))

    return NextResponse.json(enriched)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
