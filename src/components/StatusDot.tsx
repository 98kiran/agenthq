'use client'
import { getStatusColor } from '@/lib/constants'

export function StatusDot({ status, lastActive }: { status: string; lastActive: string | null }) {
  const color = getStatusColor(status, lastActive)
  const isOnline = status === 'active' || status === 'online'
  return (
    <span className="relative inline-flex" style={{ width: 10, height: 10 }}>
      {isOnline && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ background: color }} />
      )}
      <span className="relative inline-flex rounded-full"
        style={{ width: 10, height: 10, background: color, boxShadow: isOnline ? `0 0 8px ${color}90` : 'none' }} />
    </span>
  )
}
