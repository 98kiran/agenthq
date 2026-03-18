export const AGENT_COLORS: Record<string, string> = {
  nova: '#7c3aed',
  samdev: '#06b6d4',
  marty: '#f59e0b',
  scout: '#10b981',
  quill: '#8b5cf6',
  raven: '#ef4444',
  dexter: '#3b82f6',
}

export const EVENT_TYPE_COLORS: Record<string, string> = {
  spawn: '#06b6d4',
  completion: '#10b981',
  error: '#ef4444',
  assignment: '#7c3aed',
  deploy: '#f59e0b',
  system: '#6b7280',
  cron: '#3b82f6',
}

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#6b7280',
}

export function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId?.toLowerCase()] || '#6b7280'
}

export function getStatusColor(status: string, lastActive: string | null): string {
  if (status === 'error') return '#ef4444'
  if (!lastActive) return '#6b7280'
  const diff = Date.now() - new Date(lastActive).getTime()
  const mins = diff / 60000
  if (mins < 5) return '#10b981'
  if (mins < 60) return '#f59e0b'
  return '#6b7280'
}

export function getStatusLabel(status: string, lastActive: string | null): string {
  if (status === 'error') return 'error'
  if (!lastActive) return 'offline'
  const diff = Date.now() - new Date(lastActive).getTime()
  const mins = diff / 60000
  if (mins < 5) return 'online'
  if (mins < 60) return 'idle'
  return 'offline'
}

export function relativeTime(ts: string | null): string {
  if (!ts) return 'never'
  const diff = Date.now() - new Date(ts).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
