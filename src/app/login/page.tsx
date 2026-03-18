'use client'
import { useState, FormEvent, useEffect, Suspense } from 'react'
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
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#111118',
        border: '1px solid #1e1e2e',
        borderRadius: 12,
        padding: '40px 48px',
        width: 360,
        maxWidth: '90vw',
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#7c3aed22',
            border: '2px solid #7c3aed',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, marginBottom: 12,
          }}>⚡</div>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 20, letterSpacing: '-0.3px' }}>AgentHQ</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Ops Dashboard</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              required
              style={{
                width: '100%',
                background: '#0a0a0f',
                border: `1px solid ${error ? '#ef4444' : '#1e1e2e'}`,
                borderRadius: 8,
                padding: '10px 14px',
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#7c3aed' }}
              onBlur={e => { if (!error) e.target.style.borderColor = '#1e1e2e' }}
            />
          </div>

          {error && (
            <div style={{
              color: '#ef4444', fontSize: 13,
              marginBottom: 16, padding: '8px 12px',
              background: '#ef444411', borderRadius: 6,
              border: '1px solid #ef444433',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#4c1d95' : '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
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
