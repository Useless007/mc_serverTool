import { useEffect, useState } from 'react'
import { Play, Square, RefreshCw, Plus, Globe, Users, Swords } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatUptime, formatMemory } from '@/lib/format'
import type { ServerStatus } from '@/types'

interface DashboardProps {
  status: ServerStatus
  onRefresh: () => void
  onCreateServer: () => void
}

export default function Dashboard({ status, onRefresh, onCreateServer }: DashboardProps) {
  const [busy, setBusy] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})

  useEffect(() => {
    window.electronAPI.getServerConfig().then(setConfig).catch(() => {})
  }, [status.running])

  const handleStart = async () => {
    setBusy(true)
    try {
      await window.electronAPI.startServer()
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    try {
      await window.electronAPI.stopServer()
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const handleRestart = async () => {
    setBusy(true)
    try {
      await window.electronAPI.stopServer()
      await window.electronAPI.startServer()
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const port = config['server-port'] ?? '25565'
  const maxPlayers = config['max-players'] ?? '20'
  const gamemode = config['gamemode'] ?? 'survival'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your Minecraft server</p>
        </div>
        <Button onClick={onCreateServer}>
          <Plus className="size-4" />
          Create New Server
        </Button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span
                className={`size-2.5 rounded-full ${
                  status.running ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              Server Status
            </CardTitle>
            <CardDescription className="text-xl font-bold text-foreground">
              {status.running ? 'Running' : 'Stopped'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status.serverType && status.version && (
              <Badge variant="outline">
                {status.serverType} {status.version}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
            <CardDescription className="text-xl font-bold text-foreground">
              {status.running ? formatUptime(status.uptime) : '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {status.running ? `PID: ${status.pid}` : 'Server is not running'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Memory Usage</CardTitle>
            <CardDescription className="text-xl font-bold text-foreground">
              {status.running ? formatMemory(status.memory) : '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {status.running ? 'Allocated heap' : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Server Controls</CardTitle>
          <CardDescription>Start, stop, or restart your Minecraft server</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={handleStart} disabled={status.running || busy}>
            <Play className="size-4" />
            Start
          </Button>
          <Button variant="destructive" onClick={handleStop} disabled={!status.running || busy}>
            <Square className="size-4" />
            Stop
          </Button>
          <Button variant="outline" onClick={handleRestart} disabled={!status.running || busy}>
            <RefreshCw className="size-4" />
            Restart
          </Button>
        </CardContent>
      </Card>

      {/* Server info */}
      <Card>
        <CardHeader>
          <CardTitle>Server Information</CardTitle>
          <CardDescription>Connection details from server.properties</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">IP : Port</p>
              <p className="font-mono text-sm">localhost:{port}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Max Players</p>
              <p className="text-sm font-medium">{maxPlayers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Swords className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Game Mode</p>
              <p className="capitalize text-sm font-medium">{gamemode}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}