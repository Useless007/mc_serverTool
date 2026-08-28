import { useEffect, useState } from 'react'
import { Play, Square, RefreshCw, Plus, Globe, Users, Swords, Network, Key, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatUptime, formatMemory } from '@/lib/format'
import type { ServerStatus, TunnelStatus } from '@/types'

interface DashboardProps {
  status: ServerStatus
  onRefresh: () => void
  onCreateServer: () => void
}

export default function Dashboard({ status, onRefresh, onCreateServer }: DashboardProps) {
  const [busy, setBusy] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [ngrokStatus, setNgrokStatus] = useState<TunnelStatus | null>(null)
  const [cfStatus, setCfStatus] = useState<TunnelStatus | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const loadExtraData = async () => {
    try {
      const [cfg, ng, cf] = await Promise.all([
        window.electronAPI.getServerConfig(),
        window.electronAPI.getNgrokStatus(),
        window.electronAPI.getCfStatus(),
      ])
      setConfig(cfg)
      setNgrokStatus(ng)
      setCfStatus(cf)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadExtraData()

    const unsubNg = window.electronAPI.onNgrokStatusChanged((s) => setNgrokStatus(s as TunnelStatus))
    const unsubCf = window.electronAPI.onCfStatusChanged((s) => setCfStatus(s as TunnelStatus))

    return () => {
      unsubNg()
      unsubCf()
    }
  }, [status.running])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(text)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

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
          <p className="text-sm text-muted-foreground">Overview & controls of your Minecraft server</p>
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
                  status.running ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
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
          <Button onClick={handleStart} disabled={status.running || busy} className="bg-emerald-600 hover:bg-emerald-700">
            <Play className="size-4 mr-1" />
            Start Server
          </Button>
          <Button variant="destructive" onClick={handleStop} disabled={!status.running || busy}>
            <Square className="size-4 mr-1" />
            Stop Server
          </Button>
          <Button variant="outline" onClick={handleRestart} disabled={!status.running || busy}>
            <RefreshCw className="size-4 mr-1" />
            Restart
          </Button>
        </CardContent>
      </Card>

      {/* Network Tunnels Quick Status */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Key className="size-4 text-indigo-400" />
                Ngrok Tunnel
              </CardTitle>
              <Badge
                variant={ngrokStatus?.running ? 'default' : 'secondary'}
                className={ngrokStatus?.running ? 'bg-emerald-600 text-white' : ''}
              >
                {ngrokStatus?.running ? 'Running (TCP)' : 'Stopped'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {ngrokStatus?.running && ngrokStatus.url ? (
              <div className="flex items-center justify-between rounded bg-muted p-2 font-mono text-xs">
                <span className="truncate select-all">{ngrokStatus.url}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="size-6 p-0"
                  onClick={() => copyToClipboard(ngrokStatus.url!)}
                >
                  {copiedUrl === ngrokStatus.url ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {ngrokStatus?.tokenConfigured ? 'Ready to connect' : 'Authtoken not set'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="size-4 text-amber-400" />
                Cloudflare Tunnel
              </CardTitle>
              <Badge
                variant={cfStatus?.running ? 'default' : 'secondary'}
                className={cfStatus?.running ? 'bg-amber-600 text-white' : ''}
              >
                {cfStatus?.running ? 'Active' : 'Stopped'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {cfStatus?.running && cfStatus.url ? (
              <div className="flex items-center justify-between rounded bg-muted p-2 font-mono text-xs">
                <span className="truncate select-all">{cfStatus.url}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="size-6 p-0"
                  onClick={() => copyToClipboard(cfStatus.url!)}
                >
                  {copiedUrl === cfStatus.url ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {cfStatus?.tokenConfigured ? 'Ready to connect' : 'API Token not set'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Server info */}
      <Card>
        <CardHeader>
          <CardTitle>Server Information</CardTitle>
          <CardDescription>Connection details from server.properties</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Network className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Local IP : Port</p>
              <p className="font-mono text-sm font-semibold">localhost:{port}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Max Players</p>
              <p className="text-sm font-semibold">{maxPlayers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Swords className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Game Mode</p>
              <p className="capitalize text-sm font-semibold">{gamemode}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}