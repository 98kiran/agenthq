'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/timeline': 'Timeline',
  '/tasks': 'Tasks',
}

export default function TopBar() {
  const pathname = usePathname()
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const utc = now.toUTCString().replace(' GMT', ' UTC')
      const local = now.toLocaleTimeString()
      setTime(`${local} · ${utc.slice(17, 25)} UTC`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header style={{
      height: 52,
      background: '#111118',
      borderBottom: '1px solid #1e1e2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{titles[pathname] || 'AgentHQ'}</span>
      <span style={{ fontSize: 12, color: '#64748b' }}>{time}</span>
    </header>
  )
}
