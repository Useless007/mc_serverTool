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

interface NgrokLogLine {
  msg?: string
  level?: string
  url?: string
  public_url?: string
  err?: string
  error?: string
}

interface DownloadSpec {
  file: string
  url: string
}

const NGROK_DOWNLOADS: Record<string, DownloadSpec> = {
  'win32-x64': {
    file: 'ngrok-v3-stable-windows-amd64.zip',
    url: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip',
  },
  'darwin-x64': {
    file: 'ngrok-v3-stable-darwin-amd64.zip',
    url: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip',
  },
  'darwin-arm64': {
    file: 'ngrok-v3-stable-darwin-arm64.zip',
    url: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip',
  },
  'linux-x64': {
    file: 'ngrok-v3-stable-linux-amd64.tgz',
    url: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz',
  },
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

export class NgrokManager {
  private readonly userDataPath: string
  private readonly getPort: () => Promise<number> | number
  private readonly onStatus: (status: TunnelStatus) => void
  private child: ChildProcess | null = null
  private binaryPath: string | null = null
  private token: string | null = null
  private logLines: string[] = []
  private status: TunnelStatus

  constructor(opts: {
    userDataPath: string
    getPort: () => Promise<number> | number
    onStatus: (status: TunnelStatus) => void
    initialTokenConfigured?: boolean
  }) {
    this.userDataPath = opts.userDataPath
    this.getPort = opts.getPort
    this.onStatus = opts.onStatus
    this.status = {
      running: false,
      url: null,
      error: null,
      startedAt: null,
      tokenConfigured: opts.initialTokenConfigured ?? false,
      binaryAvailable: false,
    }
  }

  getStatus(): TunnelStatus {
    return { ...this.status }
  }

  getLogs(): string[] {
    return [...this.logLines]
  }

  private emit(): void {
    this.onStatus({ ...this.status })
  }

  private pushLog(prefix: string, line: string): void {
    this.logLines.push(`${prefix} ${line}`)
    if (this.logLines.length > 30) {
      this.logLines.splice(0, this.logLines.length - 30)
    }
  }

  /** Resolve an ngrok binary: PATH first, then download the official v3 binary. */
  async ensureBinary(): Promise<string> {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) return this.binaryPath

    const found = await findOnPath('ngrok')
    if (found) {
      this.binaryPath = found
      this.status.binaryAvailable = true
      this.emit()
      return found
    }

    const platformKey = `${process.platform}-${process.arch}` as keyof typeof NGROK_DOWNLOADS
    const spec = NGROK_DOWNLOADS[platformKey]
    if (!spec) throw new Error(`ngrok is not available for ${platformKey}`)

    const dir = path.join(this.userDataPath, 'ngrok')
    fs.mkdirSync(dir, { recursive: true })
    const binName = process.platform === 'win32' ? 'ngrok.exe' : 'ngrok'
    const binPath = path.join(dir, binName)

    if (!fs.existsSync(binPath)) {
      const archive = path.join(dir, spec.file)
      this.pushLog('info', `Downloading ngrok from ${spec.url}`)
      const res = await fetch(spec.url)
      if (!res.ok) throw new Error(`Failed to download ngrok (HTTP ${res.status})`)
      const buf = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(archive, buf)
      await this.extractArchive(archive, dir)
      if (!fs.existsSync(binPath)) {
        throw new Error('ngrok archive did not contain the binary')
      }
      if (process.platform !== 'win32') fs.chmodSync(binPath, 0o755)
    }

    this.binaryPath = binPath
    this.status.binaryAvailable = true
    this.emit()
    return binPath
  }

  private async extractArchive(archive: string, dir: string): Promise<void> {
    if (archive.endsWith('.zip')) {
      try {
        await execFileAsync('tar', ['-xf', archive, '-C', dir], { timeout: 60000, windowsHide: true })
        return
      } catch {
        // Fall through to PowerShell Expand-Archive
      }
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          '& { param($a,$d) Expand-Archive -LiteralPath $a -DestinationPath $d -Force }',
          '-a',
          archive,
          '-d',
          dir,
        ],
        { timeout: 120000, windowsHide: true }
      )
    } else {
      await execFileAsync('tar', ['-xzf', archive, '-C', dir], { timeout: 60000, windowsHide: true })
    }
  }

  /**
   * Held in memory and passed to the child via NGROK_AUTHTOKEN.
   * `ngrok config add-authtoken <token>` would put the secret on the command
   * line, where any other process on the machine can read it (ps / procfs /
   * Win32_Process.CommandLine).
   */
  async setToken(token: string): Promise<void> {
    const trimmed = token.trim()
    if (!/^[A-Za-z0-9_]{20,}$/.test(trimmed)) {
      throw new Error('That does not look like an ngrok authtoken')
    }
    await this.ensureBinary()
    this.token = trimmed
    this.status.tokenConfigured = true
    this.emit()
  }

  async start(): Promise<void> {
    if (this.status.running) return

    const bin = await this.ensureBinary()
    if (!this.token) throw new Error('ngrok authtoken not configured')

    const port = Number(await this.getPort())
    if (!Number.isFinite(port) || port <= 0) throw new Error(`Invalid server port: ${port}`)

    const child = spawn(
      bin,
      ['tcp', String(port), '--log', 'stdout', '--log-level', 'info', '--log-format', 'json'],
      {
        windowsHide: true,
        env: { ...process.env, NGROK_AUTHTOKEN: this.token ?? '' },
      }
    )
    this.child = child
    this.status.running = true
    this.status.startedAt = Date.now()
    this.status.error = null
    this.emit()

    child.stdout?.on('data', (chunk: Buffer) => this.handleOutput('out', chunk))
    child.stderr?.on('data', (chunk: Buffer) => this.handleOutput('err', chunk))
    child.on('error', (err) => {
      this.pushLog('info', `ngrok process error: ${err.message}`)
      this.status.running = false
      this.status.error = err.message.slice(0, 200)
      this.child = null
      this.emit()
    })
    child.on('exit', (code) => {
      this.pushLog('info', `ngrok exited (code ${code ?? 'null'})`)
      this.status.running = false
      this.status.url = null
      this.child = null
      this.emit()
    })
  }

  private handleOutput(prefix: 'out' | 'err', chunk: Buffer): void {
    const text = chunk.toString('utf-8')
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      this.pushLog(prefix, line)
      if (prefix !== 'out') continue

      let parsed: NgrokLogLine | null = null
      try {
        parsed = JSON.parse(line) as NgrokLogLine
      } catch {
        // Non-JSON log line, skip
      }
      if (!parsed) continue

      const url = parsed.url ?? parsed.public_url
      if (typeof url === 'string' && url.length > 0) {
        this.status.url = url
        this.emit()
      }
      if (parsed.level === 'error' || (parsed.msg ?? '').toLowerCase().includes('error')) {
        this.status.error = (parsed.err ?? parsed.error ?? parsed.msg ?? 'ngrok error').slice(0, 200)
        this.emit()
      }
    }
  }

  async stop(): Promise<void> {
    const child = this.child
    if (!child || child.exitCode !== null) {
      this.status.running = false
      this.status.url = null
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
    this.status.url = null
    this.child = null
    this.emit()
  }
}