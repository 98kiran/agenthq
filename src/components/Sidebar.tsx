'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/timeline', label: 'Timeline', icon: '◷' },
  { href: '/tasks', label: 'Tasks', icon: '☰' },
]

export default function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname()
  return (
    <aside style={{
      width: 220,
      background: '#111118',
      borderRight: '1px solid #1e1e2e',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1e1e2e' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed' }}>⚡ AgentHQ</span>
      </div>
      <nav style={{ marginTop: 16, flex: 1 }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              color: active ? '#7c3aed' : '#94a3b8',
              background: active ? 'rgba(124,58,237,0.1)' : 'transparent',
              borderLeft: active ? '2px solid #7c3aed' : '2px solid transparent',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: active ? 600 : 400,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      {onLogout && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #1e1e2e',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#64748b',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ← Sign out
          </button>
        </div>
      )}
    </aside>
  )
}
