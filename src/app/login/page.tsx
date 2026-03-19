'use client'
import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push(from)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div className="card" style={{ padding: '40px 48px', width: 420, maxWidth: '90vw', borderRadius: 16 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
            border: '2px solid var(--accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 14,
          }}>⚡</div>
          <div className="gradient-text" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.4px' }}>AgentHQ</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Ops Dashboard</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              required
              className="input-field"
              style={error ? { borderColor: 'var(--badge-red)' } : {}}
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--badge-red)', fontSize: 13,
              marginBottom: 16, padding: '8px 12px',
              background: 'color-mix(in srgb, var(--badge-red) 10%, transparent)',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--badge-red) 25%, transparent)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
