import { spawn, execFile, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface TunnelStatus {
  running: boolean
  url: string | null
  error: string | null
  startedAt: number | null
  tokenConfigured: boolean
  binaryAvailable: boolean
}

export interface CfTunnelState {
  accountId: string
  tunnelId: string
  tunnelToken: string
}

const API_BASE = 'https://api.cloudflare.com/client/v4'

const CLOUDFLARED_DOWNLOADS: Record<string, string> = {
  'win32-x64':
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  'darwin-x64':
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
  'darwin-arm64':
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz',
  'linux-x64':
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
  'linux-arm64':
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64',
}

/** Known install locations checked before falling back to a download. */
const KNOWN_WIN_PATHS = [
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
  'C:\\Program Files\\cloudflared\\cloudflared.exe',
]

interface CfApiEnvelope<T> {
  success?: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: T
}

async function findOnPath(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'where' : 'which',
      [cmd],
      { windowsHide: true }
    )
    const line = stdout.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0)
    return line ?? null
  } catch {
    return null
  }
}

async function cfRequest<T>(
  apiToken: string,
  method: string,
  pathname: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const json = (await res.json().catch(() => null)) as CfApiEnvelope<T> | null
  if (!res.ok || json?.success === false) {
    const msg = json?.errors?.[0]?.message ?? `Cloudflare API error (HTTP ${res.status})`
    throw new Error(msg)
  }
  return json?.result as T
}

export class CloudflareTunnelManager {
  private readonly userDataPath: string
  private readonly getPort: () => Promise<number> | number
  private readonly onStatus: (status: TunnelStatus) => void
  private readonly onTunnelState: (state: CfTunnelState | null) => void
  private apiToken: string | null = null
  private tunnel: CfTunnelState | null
  private child: ChildProcess | null = null
  private binaryPath: string | null = null
  private status: TunnelStatus

  constructor(opts: {
    userDataPath: string
    getPort: () => Promise<number> | number
    onStatus: (status: TunnelStatus) => void
    onTunnelState: (state: CfTunnelState | null) => void
    initialTunnel?: CfTunnelState | null
  }) {
    this.userDataPath = opts.userDataPath
    this.getPort = opts.getPort
    this.onStatus = opts.onStatus
    this.onTunnelState = opts.onTunnelState
    this.tunnel = opts.initialTunnel ?? null
    this.status = {
      running: false,
      url: null,
      error: null,
      startedAt: null,
      tokenConfigured: false,
      binaryAvailable: false,
    }
  }

  getStatus(): TunnelStatus {
    return { ...this.status }
  }

  getTunnelUrl(): string | null {
    return this.status.url
  }

  private emit(): void {
    this.onStatus({ ...this.status })
  }

  /** Verify the API token with Cloudflare; throws with the CF error message if invalid. */
  async setToken(apiToken: string): Promise<void> {
    await cfRequest<unknown>(apiToken, 'GET', '/user/tokens/verify')
    this.apiToken = apiToken
    this.status.tokenConfigured = true
    this.status.error = null
    this.emit()
  }

  /** Resolve the cloudflared binary: PATH -> known install locations -> GitHub release. */
  async ensureBinary(): Promise<string> {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) return this.binaryPath

    const found = await findOnPath('cloudflared')
    if (found) {
      this.binaryPath = found
      this.status.binaryAvailable = true
      this.emit()
      return found
    }

    if (process.platform === 'win32') {
      for (const candidate of KNOWN_WIN_PATHS) {
        if (fs.existsSync(candidate)) {
          this.binaryPath = candidate
          this.status.binaryAvailable = true
          this.emit()
          return candidate
        }
      }
    }

    const platformKey = `${process.platform}-${process.arch}` as keyof typeof CLOUDFLARED_DOWNLOADS
    const url = CLOUDFLARED_DOWNLOADS[platformKey]
    if (!url) throw new Error(`cloudflared is not available for ${platformKey}`)

    const dir = path.join(this.userDataPath, 'cloudflared')
    fs.mkdirSync(dir, { recursive: true })
    const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
    const binPath = path.join(dir, binName)

    if (!fs.existsSync(binPath)) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to download cloudflared (HTTP ${res.status})`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (url.endsWith('.tgz')) {
        const archive = path.join(dir, 'cloudflared.tgz')
        fs.writeFileSync(archive, buf)
        try {
          await execFileAsync('tar', ['-xzf', archive, '-C', dir], { timeout: 60000, windowsHide: true })
        } catch (err) {
          throw new Error(`Failed to extract cloudflared: ${(err as Error).message}`)
        }
      } else {
        fs.writeFileSync(binPath, buf)
      }
      if (!fs.existsSync(binPath)) {
        throw new Error('cloudflared download did not produce the binary')
      }
      if (process.platform !== 'win32') fs.chmodSync(binPath, 0o755)
    }

    this.binaryPath = binPath
    this.status.binaryAvailable = true
    this.emit()
    return binPath
  }

  async start(): Promise<void> {
    if (this.status.running) return

    const bin = await this.ensureBinary()
    if (!this.apiToken) throw new Error('Cloudflare API token not configured')

    const port = Number(await this.getPort())
    if (!Number.isFinite(port) || port <= 0) throw new Error(`Invalid server port: ${port}`)

    let tunnel = this.tunnel
    if (!tunnel) {
      // Auto-create a remote-managed named tunnel on the token's first account.
      const accounts = await cfRequest<Array<{ id: string; name?: string }>>(
        this.apiToken,
        'GET',
        '/accounts'
      )
      const accountId = accounts[0]?.id
      if (!accountId) throw new Error('Cloudflare API token has no account access')

      const name = `mc-manager-${Math.random().toString(16).slice(2, 6)}`
      const created = await cfRequest<{ id: string }>(
        this.apiToken,
        'POST',
        `/accounts/${accountId}/cfd_tunnel`,
        { name, config_src: 'cloudflare' }
      )
      const tokenResult = await cfRequest<{ token: string }>(
        this.apiToken,
        'GET',
        `/accounts/${accountId}/cfd_tunnel/${created.id}/token`
      )
      if (!tokenResult.token) throw new Error('Cloudflare did not return a tunnel token')

      tunnel = { accountId, tunnelId: created.id, tunnelToken: tokenResult.token }
      this.tunnel = tunnel
      this.onTunnelState(tunnel)
    }

    // Point the tunnel's stable subdomain at the MC server port. Non-fatal: the
    // tunnel still runs; only the routing would be wrong.
    try {
      const hostname = `${tunnel.tunnelId}.cfargotunnel.com`
      await cfRequest<unknown>(
        this.apiToken,
        'PATCH',
        `/accounts/${tunnel.accountId}/cfd_tunnel/${tunnel.tunnelId}/configurations`,
        {
          config: {
            ingress: [
              { hostname, service: `http://localhost:${port}` },
              { service: 'http_status:404' },
            ],
          },
        }
      )
    } catch (err) {
      console.error('[cloudflare-tunnel] route config failed:', (err as Error).message)
    }

    const child = spawn(bin, ['tunnel', 'run', '--token', tunnel.tunnelToken], {
      windowsHide: true,
    })
    this.child = child
    this.status.running = true
    this.status.startedAt = Date.now()
    this.status.error = null
    this.status.url = `https://${tunnel.tunnelId}.cfargotunnel.com`
    this.emit()

    child.stdout?.on('data', (chunk: Buffer) => this.handleOutput(chunk))
    child.stderr?.on('data', (chunk: Buffer) => this.handleOutput(chunk))
    child.on('error', (err) => {
      this.status.running = false
      this.status.error = err.message.slice(0, 200)
      this.child = null
      this.emit()
    })
    child.on('exit', (code) => {
      this.status.running = false
      this.child = null
      if (code !== 0) {
        this.status.error = this.status.error ?? `cloudflared exited with code ${code ?? 'unknown'}`
      }
      this.emit()
    })
  }

  private handleOutput(chunk: Buffer): void {
    const text = chunk.toString('utf-8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue

      if (line.includes('Registered tunnel connection')) {
        this.status.running = true
        this.status.error = null
        this.emit()
        continue
      }
      if (/ERR\s+/.test(line) || line.includes('level=error') || line.includes('X ERR')) {
        this.status.error = line.slice(0, 200)
        this.emit()
      }
    }
  }

  async stop(): Promise<void> {
    const child = this.child
    if (!child || child.exitCode !== null) {
      this.status.running = false
      this.emit()
      return
    }

    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5000))

    child.kill()
    const winner = await Promise.race([exited, timeout])

    if (winner === 'timeout' && process.platform === 'win32' && child.pid) {
      try {
        await execFileAsync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          timeout: 10000,
          windowsHide: true,
        })
      } catch {
        // Process already gone
      }
    }

    this.status.running = false
    this.child = null
    this.emit()
  }
}