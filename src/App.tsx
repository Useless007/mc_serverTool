import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Console from './components/Console'
import Settings from './components/Settings'
import Plugins from './components/Plugins'
import FileManager from './components/FileManager'
import CreateServer from './components/CreateServer'
import type { ServerStatus } from './types'

export type TabKey = 'dashboard' | 'console' | 'settings' | 'plugins' | 'files'

export default function App() {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [serverDir, setServerDir] = useState('')
  const [javaInfo, setJavaInfo] = useState({ version: '', path: '' })
  const [status, setStatus] = useState<ServerStatus>({
    running: false,
    pid: null,
    serverType: null,
    version: null,
    uptime: 0,
    memory: 0,
  })
  const [showCreate, setShowCreate] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      const [dir, java, st] = await Promise.all([
        window.electronAPI.getServerDir(),
        window.electronAPI.getJavaInfo(),
        window.electronAPI.getServerStatus(),
      ])
      if (!mounted) return
      setServerDir(dir)
      setJavaInfo(java)
      setStatus(st)
    }
    refresh()

    const unsubStatus = window.electronAPI.onServerStatusChanged((s) => {
      if (!mounted) return
      setStatus(s as ServerStatus)
    })

    return () => {
      mounted = false
      unsubStatus()
    }
  }, [refreshKey])

  const refreshAll = () => setRefreshKey((k) => k + 1)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        tab={tab}
        setTab={setTab}
        serverDir={serverDir}
        javaVersion={javaInfo.version}
        serverType={status.serverType}
        serverVersion={status.version}
        running={status.running}
        onCreateServer={() => setShowCreate(true)}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {tab === 'dashboard' && (
          <Dashboard status={status} onRefresh={refreshAll} onCreateServer={() => setShowCreate(true)} />
        )}
        {tab === 'console' && <Console status={status} />}
        {tab === 'settings' && <Settings onRefresh={refreshAll} />}
        {tab === 'plugins' && <Plugins />}
        {tab === 'files' && <FileManager />}
      </main>

      <CreateServer
        open={showCreate}
        onOpenChange={setShowCreate}
        serverDir={serverDir}
        onSelectDir={async () => {
          const dir = await window.electronAPI.selectDirectory()
          if (dir) setServerDir(dir)
        }}
        onDone={refreshAll}
      />
    </div>
  )
}