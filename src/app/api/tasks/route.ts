import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const agentFilter = searchParams.get('agent')
  const projectFilter = searchParams.get('project')
  const includeArchived = searchParams.get('include_archived') === 'true'
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase.from('tasks').select('*').range(offset, offset + limit - 1)

  if (!includeArchived) {
    query = query.neq('status', 'archived')
  }
  if (statusFilter) {
    const statuses = statusFilter.split(',').map(s => s.trim())
    query = query.in('status', statuses)
  }
  if (agentFilter) query = query.eq('agent', agentFilter)
  if (projectFilter) query = query.eq('project', projectFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, description, project, agent, priority, status } = body

  if (!id || !description) {
    return NextResponse.json({ error: 'id and description are required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('tasks').insert({
    id,
    description,
    project: project || null,
    agent: agent || null,
    priority: priority || 'medium',
    status: status || 'todo',
    assigned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retries: 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.status === 'done') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
