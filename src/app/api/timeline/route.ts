import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentFilter = searchParams.get('agent')
  const typeFilter = searchParams.get('event_type')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('timeline_events')
    .select('*')
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (agentFilter) {
    const agents = agentFilter.split(',').map(a => a.trim())
    query = query.in('agent', agents)
  }
  if (typeFilter) {
    const types = typeFilter.split(',').map(t => t.trim())
    query = query.in('event_type', types)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
