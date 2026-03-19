/**
 * Gateway WebSocket RPC client for live session data.
 * Connects to the OpenClaw gateway via WebSocket JSON-RPC protocol.
 */
import WebSocket from 'ws'

const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789'
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || ''
const GATEWAY_ORIGIN = process.env.GATEWAY_ORIGIN || 'https://hq.theagentcrew.org'

interface GatewaySession {
  key: string
  model: string
  modelProvider: string
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  totalTokensFresh?: boolean
  updatedAt: number
  displayName?: string
  kind?: string
  channel?: string
  sessionId?: string
  contextTokens?: number
}

interface SessionsListResult {
  ts: number
  count: number
  sessions: GatewaySession[]
  defaults: {
    model: string
    modelProvider: string
    contextTokens: number
  }
}

async function gatewayRPC(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('Gateway RPC timeout'))
    }, 15000)

    const ws = new WebSocket(GATEWAY_URL, { origin: GATEWAY_ORIGIN })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    let connected = false

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())

      if (msg.type === 'event' && msg.event === 'connect.challenge' && !connected) {
        // Send connect handshake
        ws.send(JSON.stringify({
          type: 'req',
          id: 'connect',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            scopes: ['operator.read'],
            client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'node', mode: 'ui' },
            auth: GATEWAY_TOKEN ? { token: GATEWAY_TOKEN } : undefined,
          },
        }))
        return
      }

      if (msg.id === 'connect') {
        if (!msg.ok) {
          clearTimeout(timeout)
          ws.close()
          reject(new Error(`Gateway connect failed: ${msg.error?.message || 'unknown'}`))
          return
        }
        connected = true
        // Now send the actual RPC call
        ws.send(JSON.stringify({
          type: 'req',
          id: 'rpc',
          method,
          params,
        }))
        return
      }

      if (msg.id === 'rpc') {
        clearTimeout(timeout)
        ws.close()
        if (msg.ok) {
          resolve(msg.payload)
        } else {
          reject(new Error(`Gateway RPC error: ${msg.error?.message || 'unknown'}`))
        }
      }
    })
  })
}

export interface LiveAgent {
  id: string
  display_name: string
  model: string
  model_provider: string
  status: 'active' | 'online' | 'idle' | 'offline'
  total_tokens: number
  last_active: string
  session_count: number
}

export async function getLiveSessions(): Promise<SessionsListResult | null> {
  try {
    const result = await gatewayRPC('sessions.list') as SessionsListResult
    return result
  } catch {
    return null
  }
}

export function deriveAgentStatus(session: GatewaySession): 'active' | 'online' | 'idle' | 'offline' {
  const now = Date.now()
  const age = now - session.updatedAt
  const THIRTY_SEC = 30_000
  const FIVE_MIN = 5 * 60_000
  const ONE_HOUR = 60 * 60_000

  if (!session.totalTokensFresh && age < THIRTY_SEC) return 'active'
  if (age < FIVE_MIN) return 'online'
  if (age < ONE_HOUR) return 'idle'
  return 'offline'
}

export async function getLiveAgents(): Promise<LiveAgent[]> {
  const result = await getLiveSessions()
  if (!result) return []

  // Group sessions by agent, merging 'nova' into 'main'
  const agentMap = new Map<string, GatewaySession[]>()
  for (const s of result.sessions) {
    const parts = s.key.split(':')
    let agentId = parts[1] || parts[0]
    // 'agent:main:*' and 'agent:nova:*' are both Nova (main agent)
    if (agentId === 'nova') agentId = 'main'
    if (!agentMap.has(agentId)) agentMap.set(agentId, [])
    agentMap.get(agentId)!.push(s)
  }

  const agents: LiveAgent[] = []
  for (const [id, sessions] of agentMap) {
    // Pick the most recently active session for status
    const sorted = sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    const primary = sorted[0]
    const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)

    // For model: prefer the primary persistent session (telegram/discord/main), not cron sessions
    const persistentSession = sessions.find(s =>
      s.key.includes(':telegram:') || s.key.includes(':discord:') ||
      (s.key.endsWith(':main') && !s.key.includes(':cron:'))
    )
    const modelSession = persistentSession || primary

    agents.push({
      id,
      display_name: primary.displayName || id,
      model: modelSession.model,
      model_provider: modelSession.modelProvider,
      status: deriveAgentStatus(primary),
      total_tokens: totalTokens,
      last_active: new Date(primary.updatedAt).toISOString(),
      session_count: sessions.length,
    })
  }

  return agents
}
