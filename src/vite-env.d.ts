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
  getJavaInfo(): Promise<{ version: string; path: string }>

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
}

interface Window {
  electronAPI: ElectronAPI
}