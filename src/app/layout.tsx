import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'AgentHQ',
  description: 'Agent Operations Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
