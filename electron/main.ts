import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  ServerManager,
  ServerType,
} from './server-manager'
import { Store } from './store'
import { NgrokManager } from './ngrok'
import { CloudflareTunnelManager } from './cloudflare-tunnel'
import { searchPlugins, resolvePluginJar } from './plugin-search'
import { JavaInstaller } from './java-installer'

const serverManager = new ServerManager()
const store = new Store(app.getPath('userData'))
const javaInstaller = new JavaInstaller(app.getPath('userData'))
const ngrokManager = new NgrokManager({
  userDataPath: app.getPath('userData'),
  getPort: () => getServerPort(),
  onStatus: (status) => sendToRenderer('ngrok-status-changed', status),
  initialTokenConfigured: store.getNgrokToken() !== '',
})
const cfManager = new CloudflareTunnelManager({
  userDataPath: app.getPath('userData'),
  getPort: () => getServerPort(),
  onStatus: (status) => sendToRenderer('cf-status-changed', status),
  onTunnelState: (state) => store.setCfTunnel(state),
  initialTunnel: store.getCfTunnel(),
})
let mainWindow: BrowserWindow | null = null

/** Port the active server listens on (from server.properties, default 25565). */
function getServerPort(): number {
  try {
    const dir = serverManager.getServerDir()
    if (!dir) return 25565
    const config = serverManager.readServerConfig(dir)
    const port = Number(config['server-port'])
    return Number.isFinite(port) && port > 0 ? port : 25565
  } catch {
    return 25565
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Minecraft Server Manager',
    backgroundColor: '#0a0a14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------- Event forwarding to renderer ----------
function sendToRenderer(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

serverManager.on('console-output', (line: string) => {
  sendToRenderer('console-output', line)
})

serverManager.on('status-changed', (status: unknown) => {
  sendToRenderer('server-status-changed', status)
})

serverManager.on('download-progress', (progress: unknown) => {
  sendToRenderer('download-progress', progress)
})

// ---------- IPC handlers ----------
function registerIpcHandlers(): void {
  ipcMain.handle('get-server-status', () => serverManager.getStatus())

  ipcMain.handle('get-server-dir', () => serverManager.getServerDir())

  ipcMain.handle('set-server-dir', (_e, dir: string) => {
    serverManager.setServerDir(dir)
    return { success: true }
  })

  ipcMain.handle('select-directory', async () => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Minecraft Server Directory',
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    serverManager.setServerDir(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('start-server', async (_e, opts: { memoryMax?: number; memoryMin?: number }) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false, error: 'No server directory selected' }
    const status = serverManager.getStatus()
    const customJava = javaInstaller.getCustomJavaPath() ?? undefined
    try {
      await serverManager.startServer(
        dir,
        (status.serverType ?? 'vanilla') as ServerType,
        status.version ?? '1.20.4',
        opts?.memoryMax ?? 4,
        opts?.memoryMin ?? 2,
        customJava
      )
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('stop-server', async () => {
    await serverManager.stopServer()
    return { success: true }
  })

  ipcMain.handle('kill-server', async () => {
    await serverManager.killServer()
    return { success: true }
  })

  ipcMain.handle('send-command', (_e, command: string) => {
    const ok = serverManager.sendCommand(command)
    return { success: ok }
  })

  ipcMain.handle('get-console-logs', () => serverManager.getConsoleLogs())

  ipcMain.handle('clear-console-logs', () => {
    serverManager.clearConsoleLogs()
    return { success: true }
  })

  ipcMain.handle('download-server', async (_e, type: ServerType, version: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false, error: 'No server directory selected' }
    try {
      await serverManager.downloadServer(type, version, dir)
      serverManager.setServerDir(dir)
      // Persist type/version so start-server knows what to run
      const metaFile = path.join(dir, 'server-meta.json')
      fs.writeFileSync(metaFile, JSON.stringify({ type, version }), 'utf-8')
      // Register in the multi-server history and make it active
      const profile = store.addServer({
        name: path.basename(dir) || 'Minecraft Server',
        dir,
        type,
        version,
      })
      store.setActiveServer(profile.id)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('get-server-types', () => serverManager.getServerTypes())

  ipcMain.handle('get-server-type-status', () => serverManager.checkServerTypeApis())

  ipcMain.handle('get-server-config', () => {
    const dir = serverManager.getServerDir()
    if (!dir) return {}
    return serverManager.readServerConfig(dir)
  })

  ipcMain.handle('save-server-config', (_e, config: Record<string, string>) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false }
    try {
      serverManager.writeServerConfig(dir, config)
      return { success: true }
    } catch (err) {
      return { success: false }
    }
  })

  ipcMain.handle('get-plugins', () => {
    const dir = serverManager.getServerDir()
    if (!dir) return []
    return serverManager.listPlugins(dir)
  })

  ipcMain.handle('install-plugin', async (_e, url: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false, error: 'No server directory selected' }
    try {
      await serverManager.installPlugin(dir, url)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('delete-plugin', (_e, name: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false }
    try {
      serverManager.deletePlugin(dir, name)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('list-files', (_e, subpath = '') => {
    const dir = serverManager.getServerDir()
    if (!dir) return []
    return serverManager.listFiles(dir, subpath)
  })

  ipcMain.handle('read-file', (_e, filepath: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false, error: 'No server directory selected' }
    try {
      return { success: true, content: serverManager.readFile(dir, filepath) }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('write-file', (_e, filepath: string, content: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false }
    try {
      serverManager.writeFile(dir, filepath, content)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('delete-file', (_e, filepath: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false }
    try {
      serverManager.deleteFile(dir, filepath)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('create-directory', (_e, dirname: string) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false }
    try {
      serverManager.createDirectory(dir, dirname)
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('get-java-info', () => {
    const customJava = javaInstaller.getCustomJavaPath() ?? undefined
    return serverManager.getJavaInfo(customJava)
  })

  ipcMain.handle('install-java', async () => {
    try {
      const installedPath = await javaInstaller.installJava((progress) => {
        sendToRenderer('java-install-progress', progress)
      })
      return { success: true, path: installedPath }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ---------- Multi-server registry / history ----------
  ipcMain.handle('get-servers', () => store.getServers())

  ipcMain.handle('get-active-server', () => store.getActiveServer())

  ipcMain.handle('set-active-server', (_e, id: string) => {
    const profile = store.setActiveServer(id)
    if (!profile) return { success: false, error: 'Server not found' }
    serverManager.setServerDir(profile.dir)
    serverManager.restoreMeta((profile.type as ServerType) || 'vanilla', profile.version)
    return { success: true }
  })

  ipcMain.handle('remove-server', (_e, id: string) => {
    const removed = store.removeServer(id)
    if (!removed) return { success: false, error: 'Server not found' }
    const next = store.getActiveServer()
    if (next) {
      serverManager.setServerDir(next.dir)
      serverManager.restoreMeta((next.type as ServerType) || 'vanilla', next.version)
    } else {
      serverManager.setServerDir('')
    }
    return { success: true }
  })

  // ---------- ngrok tunnel ----------
  ipcMain.handle('ngrok-get-status', () => ngrokManager.getStatus())

  ipcMain.handle('ngrok-set-token', async (_e, token: string) => {
    try {
      await ngrokManager.setToken(token)
      store.setNgrokToken(token)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('ngrok-start', async () => {
    try {
      await ngrokManager.start()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('ngrok-stop', async () => {
    await ngrokManager.stop()
    return { success: true }
  })

  // ---------- Cloudflare tunnel ----------
  ipcMain.handle('cf-get-status', () => cfManager.getStatus())

  ipcMain.handle('cf-set-token', async (_e, token: string) => {
    try {
      await cfManager.setToken(token)
      store.setCfToken(token)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('cf-start', async () => {
    try {
      await cfManager.start()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('cf-stop', async () => {
    await cfManager.stop()
    return { success: true }
  })

  // ---------- Plugin search (Spiget + Modrinth) ----------
  ipcMain.handle('search-plugins', async (_e, query: string, limit?: number) => {
    if (!query || query.trim().length < 2) return []
    try {
      return await searchPlugins(query.trim(), limit ?? 20)
    } catch (err) {
      throw new Error((err as Error).message)
    }
  })

  ipcMain.handle('install-remote-plugin', async (_e, opts: { source: 'spiget' | 'modrinth'; id: string }) => {
    const dir = serverManager.getServerDir()
    if (!dir) return { success: false, error: 'No server directory selected' }
    try {
      const jar = await resolvePluginJar(opts.source, opts.id)
      await serverManager.installPlugin(dir, jar.url)
      return { success: true, name: jar.name }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Persist server type/version metadata
function loadServerMeta(): void {
  const dir = serverManager.getServerDir()
  if (!dir) return
  const metaFile = path.join(dir, 'server-meta.json')
  if (!fs.existsSync(metaFile)) return
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as {
      type: ServerType
      version: string
    }
    if (meta.type && meta.version) {
      serverManager.restoreMeta(meta.type, meta.version)
    }
  } catch {
    /* ignore corrupt meta */
  }
}

// Try to restore last server dir from a small cache file
const cacheFile = path.join(app.getPath('userData'), 'server-dir.json')
try {
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as { dir: string }
    if (cached.dir && fs.existsSync(cached.dir)) {
      serverManager.setServerDir(cached.dir)
      loadServerMeta()
    }
  }
} catch {
  /* ignore */
}

app.on('before-quit', () => {
  try {
    const dir = serverManager.getServerDir()
    if (dir) {
      fs.writeFileSync(cacheFile, JSON.stringify({ dir }), 'utf-8')
    }
    serverManager.killServer()
  } catch {
    /* ignore */
  }
})