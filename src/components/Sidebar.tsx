'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, GitBranch, FolderKanban, Zap, Sun, Moon, LogOut, ChevronRight } from 'lucide-react'
import { useTheme } from './ThemeProvider'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/timeline', label: 'Timeline', icon: GitBranch },
  { href: '/tasks', label: 'Tasks', icon: FolderKanban },
]

interface HealthData {
  disk?: { percent?: string }
  ram?: { percent?: number }
  cpu?: { percent?: number }
  uptime?: string
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const color = value > 85 ? '#ef4444' : value > 65 ? '#f59e0b' : '#10b981'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{value}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${value}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function Sidebar({ onLogout }: { onLogout?: () => void }) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health')
        if (res.ok) setHealth(await res.json())
      } catch {}
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  const diskVal = health?.disk?.percent ? parseInt(health.disk.percent) || 0 : 0
  const ramVal = health?.ram?.percent ?? 0
  const cpuVal = health?.cpu?.percent ?? 0

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: 220,
      height: '100vh',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
          }}>
            <Zap size={14} color="#fff" fill="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1, color: 'var(--text-primary)' }}>AgentHQ</p>
            <p style={{ fontSize: 10, marginTop: 2, color: 'var(--text-muted)' }}>Agent HQ</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {nav.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={active ? '' : 'sidebar-nav-link'}
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 2,
              borderRadius: 6,
              minHeight: 44,
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
              background: active ? 'var(--accent-light)' : 'transparent',
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              transition: 'all 0.15s ease',
              position: 'relative',
            }}>
              {active && (
                <span style={{
                  position: 'absolute', left: 0, top: 4, bottom: 4,
                  width: 2, borderRadius: '0 2px 2px 0',
                  background: 'var(--accent)',
                }} />
              )}
              <Icon size={16} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: health + theme + logout */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--sidebar-border)' }}>
        {/* Health bars */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            System
          </div>
          <HealthBar label="Disk" value={diskVal} />
          <HealthBar label="CPU" value={cpuVal} />
          <HealthBar label="RAM" value={ramVal} />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', marginBottom: 6,
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-secondary)',
            fontSize: 13, cursor: 'pointer', fontWeight: 500,
          }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 10px', marginTop: 6,
              borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
              background: 'transparent', color: '#ef4444',
              fontSize: 13, cursor: 'pointer', fontWeight: 400,
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  )
}
