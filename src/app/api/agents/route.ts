import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('agent_config')
    .select('*')
    .order('display_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
