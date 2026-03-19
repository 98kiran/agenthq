// AgentHQ constants - auto-generated colors and helpers
// Auto-generated color palette for agents without custom colors
const PALETTE = [
  '#7c3aed', '#2563eb', '#dc2626', '#0ea5e9', '#14b8a6',
  '#d97706', '#8b5cf6', '#059669', '#e11d48', '#0284c7',
  '#7c2d12', '#4f46e5', '#15803d', '#b91c1c', '#0369a1',
]

// Simple hash for consistent color assignment
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// Dynamic agent color -- consistent per agent ID, no hardcoded mapping
export function getAgentColor(agentId: string | null | undefined): string {
  if (!agentId || agentId === 'system') return '#8c8c9a'
  return PALETTE[hashCode(agentId) % PALETTE.length]
}

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function getStatusColor(status: string, lastActive?: string | null): string {
  if (status === 'active') return '#7c3aed'  // purple pulse = processing
  if (status === 'online') return '#22c55e'
  if (status === 'idle') return '#eab308'
  if (status === 'busy') return '#f97316'
  return '#6b7280'
}

export function getStatusLabel(status: string, lastActive?: string | null): string {
  if (status === 'active') return 'Working...'
  if (status === 'online') return 'Online'
  if (status === 'idle') return 'Idle'
  if (status === 'busy') return 'Busy'
  if (lastActive) return relativeTime(lastActive)
  return 'Offline'
}

export const SYSTEM_AGENT = {
  id: 'system',
  label: 'System',
  emoji: '🤖',
  color: '#8c8c9a',
}
