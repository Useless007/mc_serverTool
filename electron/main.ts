import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  ServerManager,
  ServerType,
} from './server-manager'

const serverManager = new ServerManager()
let mainWindow: BrowserWindow | null = null

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
    try {
      await serverManager.startServer(
        dir,
        (status.serverType ?? 'vanilla') as ServerType,
        status.version ?? '1.20.4',
        opts?.memoryMax ?? 4,
        opts?.memoryMin ?? 2
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

  ipcMain.handle('get-java-info', () => serverManager.getJavaInfo())
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