import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// POST /api/auth  → login
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}))

  const authPassword = process.env.AUTH_PASSWORD
  const authSecret = process.env.AUTH_SECRET

  if (!authPassword || !authSecret) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  if (password !== authPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Detect HTTPS from request (works behind nginx/proxy and direct HTTPS)
  const isHttps = req.headers.get('x-forwarded-proto') === 'https' ||
    req.url.startsWith('https://')

  const res = NextResponse.json({ ok: true })
  res.cookies.set('agenthq_auth', authSecret, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}

// DELETE /api/auth  → logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('agenthq_auth', '', { maxAge: 0, path: '/' })
  return res
}
