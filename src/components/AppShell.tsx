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
      <div className="sidebar-layout">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}
