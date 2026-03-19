import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const db = getDB()
    const data = await db.getTasks({
      status: searchParams.get('status') || undefined,
      agent: searchParams.get('agent') || undefined,
      project: searchParams.get('project') || undefined,
      includeArchived: searchParams.get('include_archived') === 'true',
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, description, project, agent, priority, status } = body
    if (!id || !description) {
      return NextResponse.json({ error: 'id and description are required' }, { status: 400 })
    }
    const db = getDB()
    const data = await db.createTask({ id, description, project, agent, priority, status })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const db = getDB()
    const data = await db.updateTask(id, fields)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
