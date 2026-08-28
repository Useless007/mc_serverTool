import { useEffect, useState } from 'react'
import { Network, Key, Globe, Play, Square, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { TunnelStatus } from '@/types'

export default function NetworkTunnels() {
  // Ngrok state
  const [ngrokToken, setNgrokToken] = useState('')
  const [ngrokStatus, setNgrokStatus] = useState<TunnelStatus>({
    running: false,
    url: null,
    error: null,
    startedAt: null,
    tokenConfigured: false,
    binaryAvailable: false,
  })
  const [ngrokLoading, setNgrokLoading] = useState(false)
  const [ngrokMsg, setNgrokMsg] = useState('')

  // Cloudflare state
  const [cfToken, setCfToken] = useState('')
  const [cfStatus, setCfStatus] = useState<TunnelStatus>({
    running: false,
    url: null,
    error: null,
    startedAt: null,
    tokenConfigured: false,
    binaryAvailable: false,
  })
  const [cfLoading, setCfLoading] = useState(false)
  const [cfMsg, setCfMsg] = useState('')

  // Copy feedback
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      const [ng, cf] = await Promise.all([
        window.electronAPI.getNgrokStatus(),
        window.electronAPI.getCfStatus(),
      ])
      setNgrokStatus(ng)
      setCfStatus(cf)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadStatus()

    const unsubNg = window.electronAPI.onNgrokStatusChanged((s) => {
      setNgrokStatus(s as TunnelStatus)
    })
    const unsubCf = window.electronAPI.onCfStatusChanged((s) => {
      setCfStatus(s as TunnelStatus)
    })

    return () => {
      unsubNg()
      unsubCf()
    }
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(text)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  // Ngrok handlers
  const handleSaveNgrokToken = async () => {
    if (!ngrokToken.trim()) return
    setNgrokLoading(true)
    setNgrokMsg('')
    try {
      const res = await window.electronAPI.setNgrokToken(ngrokToken.trim())
      if (res.success) {
        setNgrokMsg('Ngrok authtoken saved successfully!')
        setNgrokToken('')
      } else {
        setNgrokMsg(`Error: ${res.error ?? 'Failed to set token'}`)
      }
    } finally {
      setNgrokLoading(false)
    }
  }

  const handleToggleNgrok = async () => {
    setNgrokLoading(true)
    setNgrokMsg('')
    try {
      if (ngrokStatus.running) {
        await window.electronAPI.stopNgrok()
      } else {
        const res = await window.electronAPI.startNgrok()
        if (!res.success) {
          setNgrokMsg(res.error ?? 'Failed to start Ngrok')
        }
      }
    } finally {
      setNgrokLoading(false)
    }
  }

  // Cloudflare handlers
  const handleSaveCfToken = async () => {
    if (!cfToken.trim()) return
    setCfLoading(true)
    setCfMsg('')
    try {
      const res = await window.electronAPI.setCfToken(cfToken.trim())
      if (res.success) {
        setCfMsg('Cloudflare token saved successfully!')
        setCfToken('')
      } else {
        setCfMsg(`Error: ${res.error ?? 'Failed to set token'}`)
      }
    } finally {
      setCfLoading(false)
    }
  }

  const handleToggleCf = async () => {
    setCfLoading(true)
    setCfMsg('')
    try {
      if (cfStatus.running) {
        await window.electronAPI.stopCfTunnel()
      } else {
        const res = await window.electronAPI.startCfTunnel()
        if (!res.success) {
          setCfMsg(res.error ?? 'Failed to start Cloudflare Tunnel')
        }
      }
    } finally {
      setCfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Network className="size-6 text-primary" />
          Network Tunnels
        </h1>
        <p className="text-sm text-muted-foreground">
          Expose your local Minecraft server to players over the Internet using Ngrok or Cloudflare Tunnel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* NGROK CARD */}
        <Card className="flex flex-col justify-between border-border bg-card">
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="size-5 text-indigo-400" />
                  Ngrok Tunnel
                </CardTitle>
                <Badge
                  variant={ngrokStatus.running ? 'default' : 'secondary'}
                  className={ngrokStatus.running ? 'bg-emerald-600 text-white' : ''}
                >
                  {ngrokStatus.running ? 'Online (TCP)' : 'Offline'}
                </Badge>
              </div>
              <CardDescription>
                Fast TCP tunneling service. Requires an authtoken from ngrok.com.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Token Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ngrok Authtoken</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={ngrokToken}
                    onChange={(e) => setNgrokToken(e.target.value)}
                    placeholder={
                      ngrokStatus.tokenConfigured ? '•••••••••••• (Token Configured)' : 'Paste Ngrok Token'
                    }
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={handleSaveNgrokToken}
                    disabled={ngrokLoading || !ngrokToken.trim()}
                    size="sm"
                    variant="outline"
                  >
                    Save
                  </Button>
                </div>
                {ngrokMsg && <p className="text-xs text-indigo-400">{ngrokMsg}</p>}
              </div>

              {/* Status Box */}
              {ngrokStatus.running && ngrokStatus.url && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400">Public Server Address</span>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="size-7 p-0 text-emerald-300 hover:text-white"
                      onClick={() => copyToClipboard(ngrokStatus.url!)}
                    >
                      {copiedUrl === ngrokStatus.url ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="font-mono text-sm font-bold text-white select-all">{ngrokStatus.url}</p>
                  <p className="text-[11px] text-muted-foreground">Players can use this address to connect directly in Minecraft.</p>
                </div>
              )}

              {ngrokStatus.error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-red-400">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{ngrokStatus.error}</span>
                </div>
              )}
            </CardContent>
          </div>

          <CardContent className="pt-0">
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {ngrokStatus.tokenConfigured ? 'Token configured' : 'Token required'}
              </span>
              <Button
                onClick={handleToggleNgrok}
                disabled={ngrokLoading || (!ngrokStatus.tokenConfigured && !ngrokStatus.running)}
                variant={ngrokStatus.running ? 'destructive' : 'default'}
                className={!ngrokStatus.running ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              >
                {ngrokLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : ngrokStatus.running ? (
                  <>
                    <Square className="size-4 mr-1" /> Stop Ngrok
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-1" /> Start Ngrok
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CLOUDFLARE TUNNEL CARD */}
        <Card className="flex flex-col justify-between border-border bg-card">
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="size-5 text-amber-400" />
                  Cloudflare Tunnel
                </CardTitle>
                <Badge
                  variant={cfStatus.running ? 'default' : 'secondary'}
                  className={cfStatus.running ? 'bg-amber-600 text-white' : ''}
                >
                  {cfStatus.running ? 'Active' : 'Offline'}
                </Badge>
              </div>
              <CardDescription>
                High-performance Cloudflare Zero Trust tunnel for stable connectivity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Token Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Cloudflare API Token</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={cfToken}
                    onChange={(e) => setCfToken(e.target.value)}
                    placeholder={
                      cfStatus.tokenConfigured ? '•••••••••••• (Token Configured)' : 'Paste Cloudflare API Token'
                    }
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={handleSaveCfToken}
                    disabled={cfLoading || !cfToken.trim()}
                    size="sm"
                    variant="outline"
                  >
                    Save
                  </Button>
                </div>
                {cfMsg && <p className="text-xs text-amber-400">{cfMsg}</p>}
              </div>

              {/* Status Box */}
              {cfStatus.running && cfStatus.url && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-400">Tunnel Address</span>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="size-7 p-0 text-amber-300 hover:text-white"
                      onClick={() => copyToClipboard(cfStatus.url!)}
                    >
                      {copiedUrl === cfStatus.url ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="font-mono text-sm font-bold text-white select-all">{cfStatus.url}</p>
                  <p className="text-[11px] text-muted-foreground">Tunnel active & connected to Cloudflare network.</p>
                </div>
              )}

              {cfStatus.error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-red-400">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{cfStatus.error}</span>
                </div>
              )}
            </CardContent>
          </div>

          <CardContent className="pt-0">
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {cfStatus.tokenConfigured ? 'Token configured' : 'Token required'}
              </span>
              <Button
                onClick={handleToggleCf}
                disabled={cfLoading || (!cfStatus.tokenConfigured && !cfStatus.running)}
                variant={cfStatus.running ? 'destructive' : 'default'}
                className={!cfStatus.running ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
              >
                {cfLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : cfStatus.running ? (
                  <>
                    <Square className="size-4 mr-1" /> Stop Cloudflare
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-1" /> Start Cloudflare
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
