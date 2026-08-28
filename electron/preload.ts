import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // Server lifecycle
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  startServer: (opts?: { memoryMax?: number; memoryMin?: number }) =>
    ipcRenderer.invoke('start-server', opts),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  killServer: () => ipcRenderer.invoke('kill-server'),
  sendCommand: (command: string) => ipcRenderer.invoke('send-command', command),

  // Console
  getConsoleLogs: () => ipcRenderer.invoke('get-console-logs'),
  clearConsoleLogs: () => ipcRenderer.invoke('clear-console-logs'),
  onConsoleOutput: (callback: (data: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on('console-output', listener)
    return () => ipcRenderer.removeListener('console-output', listener)
  },
  onServerStatusChanged: (callback: (status: unknown) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('server-status-changed', listener)
    return () => ipcRenderer.removeListener('server-status-changed', listener)
  },
  onDownloadProgress: (callback: (progress: { type: string; version: string; percent: number }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, progress: { type: string; version: string; percent: number }) =>
      callback(progress)
    ipcRenderer.on('download-progress', listener)
    return () => ipcRenderer.removeListener('download-progress', listener)
  },

  // Server setup
  downloadServer: (type: string, version: string) =>
    ipcRenderer.invoke('download-server', type, version),
  getServerTypes: () => ipcRenderer.invoke('get-server-types'),
  getServerTypeStatus: () => ipcRenderer.invoke('get-server-type-status'),
  getJavaInfo: () => ipcRenderer.invoke('get-java-info'),
  installJava: () => ipcRenderer.invoke('install-java'),
  onJavaInstallProgress: (
    callback: (progress: { status: string; percent: number; error?: string }) => void
  ) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      progress: { status: string; percent: number; error?: string }
    ) => callback(progress)
    ipcRenderer.on('java-install-progress', listener)
    return () => ipcRenderer.removeListener('java-install-progress', listener)
  },

  // Config
  getServerConfig: () => ipcRenderer.invoke('get-server-config'),
  saveServerConfig: (config: Record<string, string>) =>
    ipcRenderer.invoke('save-server-config', config),

  // Plugins
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  installPlugin: (url: string) => ipcRenderer.invoke('install-plugin', url),
  deletePlugin: (name: string) => ipcRenderer.invoke('delete-plugin', name),

  // Files
  listFiles: (subpath?: string) => ipcRenderer.invoke('list-files', subpath),
  readFile: (filepath: string) => ipcRenderer.invoke('read-file', filepath),
  writeFile: (filepath: string, content: string) =>
    ipcRenderer.invoke('write-file', filepath, content),
  deleteFile: (filepath: string) => ipcRenderer.invoke('delete-file', filepath),
  createDirectory: (dirname: string) => ipcRenderer.invoke('create-directory', dirname),

  // Directory
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getServerDir: () => ipcRenderer.invoke('get-server-dir'),
  setServerDir: (dir: string) => ipcRenderer.invoke('set-server-dir', dir),

  // Servers (multi-server registry + history)
  getServers: () => ipcRenderer.invoke('get-servers'),
  removeServer: (id: string) => ipcRenderer.invoke('remove-server', id),
  setActiveServer: (id: string) => ipcRenderer.invoke('set-active-server', id),
  getActiveServer: () => ipcRenderer.invoke('get-active-server'),

  // Ngrok tunnel
  getNgrokStatus: () => ipcRenderer.invoke('ngrok-get-status'),
  setNgrokToken: (token: string) => ipcRenderer.invoke('ngrok-set-token', token),
  startNgrok: () => ipcRenderer.invoke('ngrok-start'),
  stopNgrok: () => ipcRenderer.invoke('ngrok-stop'),
  onNgrokStatusChanged: (callback: (status: unknown) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('ngrok-status-changed', listener)
    return () => ipcRenderer.removeListener('ngrok-status-changed', listener)
  },

  // Cloudflare tunnel
  getCfStatus: () => ipcRenderer.invoke('cf-get-status'),
  setCfToken: (token: string) => ipcRenderer.invoke('cf-set-token', token),
  startCfTunnel: () => ipcRenderer.invoke('cf-start'),
  stopCfTunnel: () => ipcRenderer.invoke('cf-stop'),
  onCfStatusChanged: (callback: (status: unknown) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('cf-status-changed', listener)
    return () => ipcRenderer.removeListener('cf-status-changed', listener)
  },

  // Plugin search (Spiget + Modrinth)
  searchPlugins: (query: string, limit?: number) => ipcRenderer.invoke('search-plugins', query, limit),
  installRemotePlugin: (source: string, id: string) =>
    ipcRenderer.invoke('install-remote-plugin', { source, id }),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI