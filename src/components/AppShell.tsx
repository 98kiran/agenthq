'use client'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { ThemeProvider } from './ThemeProvider'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') {
    return (
      <ThemeProvider>
        <div style={{ width: '100vw', minHeight: '100vh', background: 'var(--bg)' }}>{children}</div>
      </ThemeProvider>
    )
  }

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <ThemeProvider>
      <Sidebar onLogout={handleLogout} />
      <div style={{ marginLeft: 220, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1, padding: '24px', background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}
