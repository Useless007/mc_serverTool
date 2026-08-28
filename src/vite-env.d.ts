/// <reference types="vite/client" />

interface ElectronAPI {
  // Server lifecycle
  getServerStatus(): Promise<{
    running: boolean
    pid: number | null
    serverType: string | null
    version: string | null
    uptime: number
    memory: number
  }>
  startServer(opts?: { memoryMax?: number; memoryMin?: number }): Promise<{ success: boolean; error?: string }>
  stopServer(): Promise<{ success: boolean }>
  killServer(): Promise<{ success: boolean }>
  sendCommand(command: string): Promise<{ success: boolean }>

  // Console
  getConsoleLogs(): Promise<string[]>
  clearConsoleLogs(): Promise<{ success: boolean }>
  onConsoleOutput(callback: (data: string) => void): () => void
  onServerStatusChanged(callback: (status: unknown) => void): () => void
  onDownloadProgress(
    callback: (progress: { type: string; version: string; percent: number }) => void
  ): () => void

  // Server setup
  downloadServer(type: string, version: string): Promise<{ success: boolean; error?: string }>
  getServerTypes(): Promise<Array<{ type: string; label: string; versions: string[] }>>
  getServerTypeStatus(): Promise<Array<{ type: string; online: boolean }>>
  getJavaInfo(): Promise<{ version: string; path: string }>
  installJava(): Promise<{ success: boolean; path?: string; error?: string }>
  onJavaInstallProgress(
    callback: (progress: { status: string; percent: number; error?: string }) => void
  ): () => void

  // Config
  getServerConfig(): Promise<Record<string, string>>
  saveServerConfig(config: Record<string, string>): Promise<{ success: boolean }>

  // Plugins
  getPlugins(): Promise<Array<{ name: string; size: number }>>
  installPlugin(url: string): Promise<{ success: boolean; error?: string }>
  deletePlugin(name: string): Promise<{ success: boolean }>

  // Files
  listFiles(
    subpath?: string
  ): Promise<Array<{ name: string; isDirectory: boolean; size: number; modified: string }>>
  readFile(filepath: string): Promise<{ success: boolean; content?: string; error?: string }>
  writeFile(filepath: string, content: string): Promise<{ success: boolean }>
  deleteFile(filepath: string): Promise<{ success: boolean }>
  createDirectory(dirname: string): Promise<{ success: boolean }>

  // Directory
  selectDirectory(): Promise<string | null>
  getServerDir(): Promise<string>
  setServerDir(dir: string): Promise<{ success: boolean }>

  // Servers (multi-server registry + history)
  getServers(): Promise<
    Array<{
      id: string
      name: string
      dir: string
      type: string
      version: string
      createdAt: string
      lastUsedAt: string
    }>
  >
  removeServer(id: string): Promise<{ success: boolean; error?: string }>
  setActiveServer(id: string): Promise<{ success: boolean; error?: string }>
  getActiveServer(): Promise<{
    id: string
    name: string
    dir: string
    type: string
    version: string
    createdAt: string
    lastUsedAt: string
  } | null>

  // Ngrok tunnel
  getNgrokStatus(): Promise<{
    running: boolean
    url: string | null
    error: string | null
    startedAt: number | null
    tokenConfigured: boolean
    binaryAvailable: boolean
  }>
  setNgrokToken(token: string): Promise<{ success: boolean; error?: string }>
  startNgrok(): Promise<{ success: boolean; error?: string }>
  stopNgrok(): Promise<{ success: boolean }>
  onNgrokStatusChanged(
    callback: (status: {
      running: boolean
      url: string | null
      error: string | null
      startedAt: number | null
      tokenConfigured: boolean
      binaryAvailable: boolean
    }) => void
  ): () => void

  // Cloudflare tunnel
  getCfStatus(): Promise<{
    running: boolean
    url: string | null
    error: string | null
    startedAt: number | null
    tokenConfigured: boolean
    binaryAvailable: boolean
  }>
  setCfToken(token: string): Promise<{ success: boolean; error?: string }>
  startCfTunnel(): Promise<{ success: boolean; error?: string }>
  stopCfTunnel(): Promise<{ success: boolean }>
  onCfStatusChanged(
    callback: (status: {
      running: boolean
      url: string | null
      error: string | null
      startedAt: number | null
      tokenConfigured: boolean
      binaryAvailable: boolean
    }) => void
  ): () => void

  // Plugin search (Spiget + Modrinth)
  searchPlugins(
    query: string,
    limit?: number
  ): Promise<
    Array<{
      source: 'spiget' | 'modrinth'
      id: string
      name: string
      description: string
      author: string
      downloads: number
      iconUrl: string | null
    }>
  >
  installRemotePlugin(
    source: string,
    id: string
  ): Promise<{ success: boolean; error?: string; name?: string }>
}

interface Window {
  electronAPI: ElectronAPI
}