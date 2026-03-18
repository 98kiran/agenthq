'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, GitBranch, FolderKanban, Zap, Sun, Moon, LogOut } from 'lucide-react'
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
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>AgentHQ</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {nav.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              marginBottom: 2,
              borderRadius: 8,
              color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
              background: active ? 'var(--accent-light)' : 'transparent',
              borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              transition: 'all 0.15s ease',
            }}>
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: health + theme + logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
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
              width: '100%', padding: '8px 10px',
              borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', fontWeight: 400,
            }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  )
}
