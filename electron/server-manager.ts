import { spawn, spawnSync, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
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

const PLUGIN_NAME = /^[A-Za-z0-9._-]+\.jar$/
const LINEBREAK = new RegExp('[' + String.fromCharCode(13, 10) + ']')

export class ServerManager extends EventEmitter {
  private process: ChildProcess | null = null
  private serverDir: string = ''
  private serverType: ServerType | null = null
  private serverVersion: string | null = null
  private startedAt: number = 0
  private memoryMaxGB: number = 4
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

  restoreMeta(type: ServerType, version: string, memoryMaxGB?: number): void {
    this.serverType = type
    this.serverVersion = version
    if (memoryMaxGB && memoryMaxGB > 0) this.memoryMaxGB = Math.floor(memoryMaxGB)
  }

  getMemoryMax(): number {
    return this.memoryMaxGB
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
    // Must await: without it a second java process is spawned on the same
    // world directory while the first is still shutting down.
    await this.stopServer()
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
    // `version` is interpolated into a URL below; without this check the
    // renderer could point the download at any path on the CDN host.
    const known = SERVER_TYPES.find((t) => t.type === type)
    if (!known) throw new Error(`Unknown server type: ${type}`)
    if (!known.versions.includes(version)) {
      throw new Error(`Unknown ${known.label} version: ${version}`)
    }

    const { url, sha1 } = await this.resolveDownloadUrl(type, version)
    const target = path.join(destDir, 'server.jar')
    const partial = `${target}.part`
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

    // Download to a .part file and only swap it in on success, so a failed or
    // interrupted download can never destroy a working server.jar.
    const ws = fs.createWriteStream(partial)
    // Attach before any await: an unhandled 'error' on a write stream is a
    // hard crash of the main process, not a rejected promise.
    let streamError: Error | null = null
    ws.on('error', (err: Error) => {
      streamError = streamError ?? err
    })
    const hash = sha1 ? crypto.createHash('sha1') : null
    let received = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        received += value.byteLength
        hash?.update(value)
        if (!ws.write(Buffer.from(value))) {
          await new Promise<void>((r) => ws.once('drain', r))
        }
        if (total > 0) {
          this.emit('download-progress', {
            type,
            version,
            percent: Math.round((received / total) * 100),
          })
        }
      }
      await new Promise<void>((resolve) => ws.end(() => resolve()))
      if (streamError) throw streamError
    } catch (err) {
      ws.destroy()
      fs.rmSync(partial, { force: true })
      throw err
    }

    if (received === 0) {
      fs.rmSync(partial, { force: true })
      throw new Error('Download produced an empty file')
    }

    // This jar gets executed by `java -jar`. Mojang publishes a sha1 for it -
    // verify rather than trusting whatever came down the wire.
    if (hash && sha1) {
      const actual = hash.digest('hex')
      if (actual !== sha1) {
        fs.rmSync(partial, { force: true })
        throw new Error(
          `Checksum mismatch for ${type} ${version} - download rejected (expected ${sha1}, got ${actual})`
        )
      }
      this.appendLog('[INFO] Checksum verified (sha1)')
    }

    fs.renameSync(partial, target)
    this.emit('download-progress', { type, version, percent: 100 })
    this.appendLog(`[INFO] Downloaded server.jar (${(received / 1024 / 1024).toFixed(1)} MB)`)
  }

  private async resolveDownloadUrl(
    type: ServerType,
    version: string
  ): Promise<{ url: string; sha1?: string }> {
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
        const vData = (await vRes.json()) as {
          downloads: { server: { url: string; sha1?: string } }
        }
        return { url: vData.downloads.server.url, sha1: vData.downloads.server.sha1 }
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
        return { url: dl.url }
      }
      case 'spigot': {
        // getbukkit.org serves release jars from this stable CDN endpoint.
        // No checksum is published for these - see AGENT.md "Known gaps".
        return { url: `https://cdn.getbukkit.org/spigot/spigot-${version}.jar` }
      }
      case 'craftbukkit': {
        return { url: `https://cdn.getbukkit.org/craftbukkit/craftbukkit-${version}.jar` }
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
      // A line break in a value (e.g. motd) would inject extra properties
      // lines - "hi<LF>enable-rcon=true<LF>rcon.password=x" would silently
      // open a remote console on the next restart.
      if (LINEBREAK.test(key) || LINEBREAK.test(String(value))) {
        throw new Error(`Illegal line break in server.properties entry: ${key}`)
      }
      entries.push(`${key}=${value}`)
    }
    fs.writeFileSync(file, entries.join('\n') + '\n', 'utf-8')
  }

  getJavaInfo(customPath?: string): { version: string; path: string } {
    if (customPath && fs.existsSync(customPath)) {
      // spawnSync with an argv array: execSync runs the string through a shell,
      // and customPath contains the Windows account name. Reads stderr too,
      // because that is where `java -version` writes.
      const probe = spawnSync(customPath, ['-version'], { encoding: 'utf-8' })
      const output = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
      const match = output.match(/version "([^"]+)"/)
      // Report what was actually found - never a hardcoded version string.
      return { version: match?.[1] ?? 'unknown', path: customPath }
    }

    const which = process.platform === 'win32' ? 'where' : 'which'
    const locate = spawnSync(which, ['java'], { encoding: 'utf-8' })
    if (locate.status !== 0) return { version: 'Not found', path: '' }
    const javaPath = (locate.stdout || '').trim().split(LINEBREAK)[0].trim()

    // `java -version` writes to stderr, not stdout - read both so the version
    // is found regardless of which stream the installed JDK uses.
    const probe = spawnSync('java', ['-version'], { encoding: 'utf-8' })
    const output = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
    const match = output.match(/version "([^"]+)"/)
    return { version: match?.[1] ?? 'unknown', path: javaPath }
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
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid plugin URL')
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Plugin URL must be http(s)')
    }

    const filename = path.basename(parsed.pathname)
    if (!PLUGIN_NAME.test(filename)) {
      throw new Error('Plugin URL must point directly at a .jar file')
    }

    const pluginsDir = path.join(dir, 'plugins')
    fs.mkdirSync(pluginsDir, { recursive: true })
    // Route through resolvePath so a crafted filename cannot escape plugins/.
    const target = this.resolvePath(pluginsDir, filename)

    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`Plugin download failed: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(target, buf)
  }

  deletePlugin(dir: string, name: string): void {
    // Reject anything that is not a plain jar filename rather than silently
    // normalising it away - a traversal attempt should be a visible error.
    if (!PLUGIN_NAME.test(name)) throw new Error(`Invalid plugin name: ${name}`)
    const target = this.resolvePath(path.join(dir, 'plugins'), name)
    if (fs.existsSync(target)) fs.unlinkSync(target)
  }

  // ---------- File management ----------

  private resolvePath(dir: string, subpath: string): string {
    // path.resolve is purely lexical, so a symlink/junction inside the server
    // directory would pass the prefix check while pointing anywhere on disk.
    // Compare real paths so the containment check actually holds.
    const base = fs.existsSync(dir) ? fs.realpathSync(path.resolve(dir)) : path.resolve(dir)
    const lexical = path.resolve(base, subpath || '.')
    const target = fs.existsSync(lexical) ? fs.realpathSync(lexical) : lexical
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