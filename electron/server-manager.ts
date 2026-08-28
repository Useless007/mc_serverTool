import { spawn, ChildProcess, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

export type ServerType = 'vanilla' | 'paper' | 'spigot' | 'craftbukkit'

export interface ServerStatus {
  running: boolean
  pid: number | null
  serverType: ServerType | null
  version: string | null
  uptime: number
  memory: number
}

export interface ServerTypeInfo {
  type: ServerType
  label: string
  versions: string[]
}

export interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface ServerConfig {
  [key: string]: string
}

const VANILLA_VERSIONS = [
  '26.2', '26.1.2', '26.1.1', '26.1',
  '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1',
  '1.19.4', '1.19.2', '1.18.2', '1.17.1',
  '1.16.5', '1.15.2', '1.12.2',
]

const PAPER_VERSIONS = [
  '26.2', '26.1.2', '26.1.1',
  '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.1', '1.21',
  '1.20.6', '1.20.5', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.18.2', '1.17.1',
  '1.16.5', '1.12.2', '1.8.8',
]

const SPIGOT_VERSIONS = [
  '1.21.11', '1.21.10', '1.21.8', '1.21.5', '1.21.4', '1.21.3', '1.21.1',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1',
  '1.19.4', '1.19.2', '1.18.2', '1.17.1',
  '1.16.5', '1.15.2', '1.12.2',
]

const CRAFTBUKKIT_VERSIONS = [
  '1.21.11', '1.21.10', '1.21.8', '1.21.5', '1.21.4', '1.21.3', '1.21.1',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1',
  '1.19.4', '1.19.2', '1.18.2', '1.17.1',
  '1.16.5', '1.15.2', '1.12.2',
]

const SERVER_TYPES: ServerTypeInfo[] = [
  {
    type: 'vanilla',
    label: 'Vanilla',
    versions: VANILLA_VERSIONS,
  },
  {
    type: 'paper',
    label: 'Paper',
    versions: PAPER_VERSIONS,
  },
  {
    type: 'spigot',
    label: 'Spigot',
    versions: SPIGOT_VERSIONS,
  },
  {
    type: 'craftbukkit',
    label: 'CraftBukkit',
    versions: CRAFTBUKKIT_VERSIONS,
  },
]

export const SERVER_TYPES_LABELS: Record<ServerType, string> = {
  vanilla: 'Vanilla',
  paper: 'Paper',
  spigot: 'Spigot',
  craftbukkit: 'CraftBukkit',
}

export class ServerManager extends EventEmitter {
  private process: ChildProcess | null = null
  private serverDir: string = ''
  private serverType: ServerType | null = null
  private serverVersion: string | null = null
  private startedAt: number = 0
  private consoleBuffer: string[] = []
  private readonly maxBufferLines = 4000

  constructor() {
    super()
  }

  getServerDir(): string {
    return this.serverDir
  }

  setServerDir(dir: string): void {
    this.serverDir = dir
  }

  restoreMeta(type: ServerType, version: string): void {
    this.serverType = type
    this.serverVersion = version
  }

  getStatus(): ServerStatus {
    return {
      running: this.process !== null,
      pid: this.process?.pid ?? null,
      serverType: this.serverType,
      version: this.serverVersion,
      uptime: this.process ? Date.now() - this.startedAt : 0,
      memory: this.process ? process.memoryUsage().heapUsed : 0,
    }
  }

  getConsoleLogs(): string[] {
    return [...this.consoleBuffer]
  }

  clearConsoleLogs(): void {
    this.consoleBuffer = []
    this.emit('console-clear')
  }

  async startServer(
    dir: string,
    type: ServerType,
    version: string,
    memoryMaxGB: number,
    memoryMinGB: number,
    customJavaPath?: string
  ): Promise<void> {
    this.stopServer()
    const serverJar = path.join(dir, 'server.jar')
    if (!fs.existsSync(serverJar)) {
      throw new Error('server.jar not found. Please download the server first.')
    }
    const minMem = Math.max(1, Math.floor(memoryMinGB || 1))
    const maxMem = Math.max(minMem, Math.floor(memoryMaxGB || 4))

    this.appendLog(`[INFO] Starting ${type} ${version} server...`)
    this.appendLog(`[INFO] Memory: ${minMem}G min / ${maxMem}G max`)

    const javaCmd = customJavaPath && fs.existsSync(customJavaPath) ? customJavaPath : 'java'
    this.appendLog(`[INFO] Java executable: ${javaCmd}`)

    const javaArgs = [
      `-Xms${minMem}G`,
      `-Xmx${maxMem}G`,
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-jar',
      'server.jar',
      'nogui',
    ]

    let child: ChildProcess
    try {
      child = spawn(javaCmd, javaArgs, {
        cwd: dir,
        shell: false,
      })
    } catch (err) {
      this.appendLog(`[ERROR] Failed to start Java: ${(err as Error).message}`)
      throw new Error(
        'Failed to launch Java. Make sure Java 17+ is installed and on PATH.'
      )
    }

    this.process = child
    this.serverType = type
    this.serverVersion = version
    this.startedAt = Date.now()

    child.stdout?.on('data', (chunk: Buffer) => {
      this.handleOutput(chunk.toString())
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      this.handleOutput(chunk.toString())
    })
    child.on('error', (err: Error) => {
      this.appendLog(`[ERROR] ${err.message}`)
    })
    child.on('exit', (code, signal) => {
      this.appendLog(`[INFO] Server stopped (code: ${code ?? signal})`)
      this.process = null
      this.emit('status-changed', this.getStatus())
    })

    this.emit('status-changed', this.getStatus())
  }

  private handleOutput(text: string): void {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
    for (const line of lines) {
      this.appendLog(line)
    }
  }

  private appendLog(line: string): void {
    this.consoleBuffer.push(line)
    if (this.consoleBuffer.length > this.maxBufferLines) {
      this.consoleBuffer.splice(0, this.consoleBuffer.length - this.maxBufferLines)
    }
    this.emit('console-output', line)
  }

  private sendStdin(command: string): boolean {
    if (!this.process || !this.process.stdin?.writable) return false
    this.process.stdin.write(command + '\n')
    return true
  }

  async stopServer(): Promise<void> {
    if (!this.process) return
    this.appendLog('[INFO] Sending stop command...')
    this.sendStdin('stop')
    const proc = this.process
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (proc === this.process && this.process) {
          try {
            this.process.kill()
          } catch {
            /* already dead */
          }
          this.process = null
        }
        resolve()
      }, 15000)
      proc.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  async killServer(): Promise<void> {
    if (!this.process) return
    this.appendLog('[WARN] Force killing server...')
    try {
      this.process.kill()
    } catch {
      /* ignore */
    }
    this.process = null
    this.emit('status-changed', this.getStatus())
  }

  sendCommand(command: string): boolean {
    if (!this.process) return false
    this.appendLog(`> ${command}`)
    return this.sendStdin(command)
  }

  // ---------- Server types ----------

  getServerTypes(): ServerTypeInfo[] {
    return SERVER_TYPES
  }

  async checkServerTypeApis(): Promise<Array<{ type: ServerType; online: boolean }>> {
    const endpoints: Record<ServerType, string> = {
      vanilla: 'https://launchermeta.mojang.com/mc/game/version_manifest.json',
      paper: 'https://fill.papermc.io/v3/projects/paper/versions',
      spigot: 'https://cdn.getbukkit.org/spigot/spigot-1.21.4.jar',
      craftbukkit: 'https://cdn.getbukkit.org/craftbukkit/craftbukkit-1.21.4.jar',
    }
    const checks = (Object.keys(endpoints) as ServerType[]).map(async (type) => {
      try {
        const res = await fetch(endpoints[type], {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        })
        return { type, online: res.ok }
      } catch {
        return { type, online: false }
      }
    })
    return Promise.all(checks)
  }

  // ---------- Downloads ----------

  async downloadServer(type: ServerType, version: string, destDir: string): Promise<void> {
    const url = await this.resolveDownloadUrl(type, version)
    const target = path.join(destDir, 'server.jar')
    fs.mkdirSync(destDir, { recursive: true })

    this.appendLog(`[INFO] Downloading ${type} ${version}...`)
    this.appendLog(`[INFO] ${url}`)

    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Minecraft-Server-Manager/1.0' },
    })
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`)
    }

    const total = Number(res.headers.get('content-length') ?? 0)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Failed to read download stream')

    const ws = fs.createWriteStream(target)
    const chunks: Buffer[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        chunks.push(Buffer.from(value))
        if (total > 0) {
          const pct = Math.round((received / total) * 100)
          this.emit('download-progress', { type, version, percent: pct })
        }
      }
    }
    const buf = Buffer.concat(chunks)
    ws.write(buf)
    await new Promise<void>((r) => ws.end(() => r()))

    this.emit('download-progress', { type, version, percent: 100 })
    this.appendLog(`[INFO] Downloaded server.jar (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
  }

  private async resolveDownloadUrl(type: ServerType, version: string): Promise<string> {
    switch (type) {
      case 'vanilla': {
        const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
        if (!manifestRes.ok) throw new Error('Failed to fetch Minecraft version manifest')
        const manifest = (await manifestRes.json()) as {
          versions: Array<{ id: string; url: string }>
        }
        const entry = manifest.versions.find((v) => v.id === version)
        if (!entry) throw new Error(`Version ${version} not found in Mojang manifest`)
        const vRes = await fetch(entry.url)
        if (!vRes.ok) throw new Error(`Failed to fetch version info for ${version}`)
        const vData = (await vRes.json()) as { downloads: { server: { url: string } } }
        return vData.downloads.server.url
      }
      case 'paper': {
        // v3 of the PaperMC API: returns array of builds, newest first.
        // Each build carries a direct "server:default" download URL.
        const api = `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`
        const res = await fetch(api)
        if (!res.ok) throw new Error(`Paper API error: ${res.status} for version ${version}`)
        const builds = (await res.json()) as Array<{
          id: number
          channel: string
          downloads: { 'server:default'?: { name: string; url: string } }
        }>
        const latest = builds.find((b) => b.channel === 'STABLE') ?? builds[0]
        if (!latest) throw new Error(`No Paper builds found for ${version}`)
        const dl = latest.downloads['server:default']
        if (!dl?.url) throw new Error(`No Paper download available for ${version}`)
        return dl.url
      }
      case 'spigot': {
        // getbukkit.org serves release jars from this stable CDN endpoint
        return `https://cdn.getbukkit.org/spigot/spigot-${version}.jar`
      }
      case 'craftbukkit': {
        return `https://cdn.getbukkit.org/craftbukkit/craftbukkit-${version}.jar`
      }
    }
  }

  // ---------- server.properties ----------

  readServerConfig(dir: string): ServerConfig {
    const file = path.join(dir, 'server.properties')
    const config: ServerConfig = {}
    if (!fs.existsSync(file)) return config
    const raw = fs.readFileSync(file, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      config[key] = value
    }
    return config
  }

  writeServerConfig(dir: string, config: ServerConfig): void {
    const file = path.join(dir, 'server.properties')
    const entries: string[] = []
    for (const [key, value] of Object.entries(config)) {
      entries.push(`${key}=${value}`)
    }
    fs.writeFileSync(file, entries.join('\n') + '\n', 'utf-8')
  }

  getJavaInfo(customPath?: string): { version: string; path: string } {
    if (customPath && fs.existsSync(customPath)) {
      try {
        const versionOut = execSync(`"${customPath}" -version`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        const match = versionOut.match(/version "([^"]+)"/)
        return { version: match?.[1] ?? '21.0.6 (Auto Installed)', path: customPath }
      } catch {
        return { version: '21.0.6 (Auto Installed)', path: customPath }
      }
    }

    const which = process.platform === 'win32' ? 'where' : 'which'
    try {
      const javaPath = execSync(`${which} java`, { encoding: 'utf-8' })
        .split(/\r?\n/)[0]
        .trim()
      const versionOut = execSync('java -version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
      const match = versionOut.match(/version "([^"]+)"/)
      return { version: match?.[1] ?? 'unknown', path: javaPath }
    } catch {
      return { version: 'Not found', path: '' }
    }
  }

  // ---------- Plugins ----------

  listPlugins(dir: string): Array<{ name: string; size: number }> {
    const pluginsDir = path.join(dir, 'plugins')
    if (!fs.existsSync(pluginsDir)) return []
    return fs
      .readdirSync(pluginsDir)
      .filter((f) => f.endsWith('.jar'))
      .map((f) => {
        const stat = fs.statSync(path.join(pluginsDir, f))
        return { name: f, size: stat.size }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async installPlugin(dir: string, url: string): Promise<void> {
    const pluginsDir = path.join(dir, 'plugins')
    fs.mkdirSync(pluginsDir, { recursive: true })
    const filename = path.basename(new URL(url).pathname) || `plugin-${Date.now()}.jar`
    const target = path.join(pluginsDir, filename)

    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`Plugin download failed: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(target, buf)
  }

  deletePlugin(dir: string, name: string): void {
    const target = path.join(dir, 'plugins', name)
    if (fs.existsSync(target)) fs.unlinkSync(target)
  }

  // ---------- File management ----------

  private resolvePath(dir: string, subpath: string): string {
    const base = path.resolve(dir)
    const target = path.resolve(base, subpath || '.')
    if (!target.startsWith(base + path.sep) && target !== base) {
      throw new Error('Path escapes server directory')
    }
    return target
  }

  listFiles(dir: string, subpath = ''): FileEntry[] {
    const target = this.resolvePath(dir, subpath)
    if (!fs.existsSync(target)) return []
    return fs
      .readdirSync(target, { withFileTypes: true })
      .map((entry) => {
        const full = path.join(target, entry.name)
        let size = 0
        let modified = ''
        try {
          const stat = fs.statSync(full)
          size = entry.isDirectory() ? 0 : stat.size
          modified = stat.mtime.toISOString()
        } catch {
          /* ignore per-entry errors */
        }
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size,
          modified,
        }
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  readFile(dir: string, filepath: string): string {
    const target = this.resolvePath(dir, filepath)
    if (!fs.existsSync(target)) throw new Error('File not found')
    return fs.readFileSync(target, 'utf-8')
  }

  writeFile(dir: string, filepath: string, content: string): void {
    const target = this.resolvePath(dir, filepath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf-8')
  }

  deleteFile(dir: string, filepath: string): void {
    const target = this.resolvePath(dir, filepath)
    if (!fs.existsSync(target)) throw new Error('Path not found')
    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true })
    } else {
      fs.unlinkSync(target)
    }
  }

  createDirectory(dir: string, dirname: string): void {
    const target = this.resolvePath(dir, dirname)
    fs.mkdirSync(target, { recursive: true })
  }
}