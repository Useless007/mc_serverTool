import fs from 'fs'
import path from 'path'

export interface ServerProfile {
  id: string
  name: string
  dir: string
  type: string
  version: string
  createdAt: string
  lastUsedAt: string
}

export interface CfTunnelState {
  accountId: string
  tunnelId: string
  tunnelToken: string
}

export interface AppState {
  servers: ServerProfile[]
  activeServerId: string | null
  ngrokToken: string
  cfToken: string
  cfTunnel: CfTunnelState | null
}

const DEFAULT_STATE: AppState = {
  servers: [],
  activeServerId: null,
  ngrokToken: '',
  cfToken: '',
  cfTunnel: null,
}

function randomId(): string {
  return `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Persistent app state: server profiles (history), active server selection,
 * and tunnel tokens. Lives in userData/manager-state.json.
 */
export class Store {
  private readonly file: string
  private state: AppState

  constructor(userDataPath: string) {
    this.file = path.join(userDataPath, 'manager-state.json')
    this.state = { ...DEFAULT_STATE, ...this.read() }
  }

  private read(): Partial<AppState> {
    try {
      if (!fs.existsSync(this.file)) return {}
      return JSON.parse(fs.readFileSync(this.file, 'utf-8')) as Partial<AppState>
    } catch {
      return {}
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  getServers(): ServerProfile[] {
    return this.state.servers
  }

  getActiveServerId(): string | null {
    return this.state.activeServerId
  }

  getActiveServer(): ServerProfile | null {
    return this.state.servers.find((s) => s.id === this.state.activeServerId) ?? null
  }

  addServer(profile: Omit<ServerProfile, 'id' | 'createdAt' | 'lastUsedAt'>): ServerProfile {
    const now = new Date().toISOString()
    const record: ServerProfile = { ...profile, id: randomId(), createdAt: now, lastUsedAt: now }
    this.state.servers = [record, ...this.state.servers]
    this.persist()
    return record
  }

  removeServer(id: string): ServerProfile | null {
    const index = this.state.servers.findIndex((s) => s.id === id)
    if (index === -1) return null
    const [removed] = this.state.servers.splice(index, 1)
    if (this.state.activeServerId === id) {
      this.state.activeServerId = this.state.servers[0]?.id ?? null
    }
    this.persist()
    return removed
  }

  setActiveServer(id: string): ServerProfile | null {
    const profile = this.state.servers.find((s) => s.id === id)
    if (!profile) return null
    this.state.activeServerId = id
    profile.lastUsedAt = new Date().toISOString()
    this.persist()
    return profile
  }

  getNgrokToken(): string {
    return this.state.ngrokToken
  }

  setNgrokToken(token: string): void {
    this.state.ngrokToken = token.trim()
    this.persist()
  }

  getCfToken(): string {
    return this.state.cfToken
  }

  setCfToken(token: string): void {
    this.state.cfToken = token.trim()
    this.persist()
  }

  getCfTunnel(): CfTunnelState | null {
    return this.state.cfTunnel
  }

  setCfTunnel(state: CfTunnelState | null): void {
    this.state.cfTunnel = state
    this.persist()
  }

  /** Migrate the pre-multi-server cache (server-dir.json + server-meta.json) into a profile. */
  seedFromLegacy(legacy: { dir: string; type: string; version: string }): void {
    if (this.state.servers.length > 0) return
    const profile = this.addServer({
      name: path.basename(legacy.dir) || 'Minecraft Server',
      dir: legacy.dir,
      type: legacy.type || 'vanilla',
      version: legacy.version || '',
    })
    this.setActiveServer(profile.id)
  }
}