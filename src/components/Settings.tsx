import { useEffect, useState } from 'react'
import { Save, Coffee, Download, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SettingsProps {
  onRefresh: () => void
}

const SECTIONS: Array<{ key: string; label: string; keys: string[] }> = [
  {
    key: 'server',
    label: 'Server Settings',
    keys: [
      'server-name',
      'motd',
      'server-port',
      'max-players',
      'gamemode',
      'difficulty',
      'level-name',
      'level-seed',
      'level-type',
    ],
  },
  {
    key: 'world',
    label: 'World Settings',
    keys: [
      'allow-nether',
      'spawn-monsters',
      'spawn-animals',
      'spawn-npcs',
      'pvp',
      'view-distance',
      'simulation-distance',
      'spawn-protection',
      'hardcore',
      'generate-structures',
    ],
  },
  {
    key: 'network',
    label: 'Network Settings',
    keys: [
      'online-mode',
      'white-list',
      'enforce-whitelist',
      'server-port',
      'network-compression-threshold',
      'enable-query',
      'enable-rcon',
      'rcon.port',
      'rcon.password',
    ],
  },
  {
    key: 'performance',
    label: 'Performance Settings',
    keys: [
      'view-distance',
      'simulation-distance',
      'max-tick-time',
      'entity-broadcast-range-percentage',
      'max-players',
      'max-world-size',
      'max-threads',
    ],
  },
]

export default function Settings({ onRefresh }: SettingsProps) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Java state
  const [javaInfo, setJavaInfo] = useState({ version: '', path: '' })
  const [installingJava, setInstallingJava] = useState(false)
  const [javaProgress, setJavaProgress] = useState<{ status: string; percent: number; error?: string } | null>(null)

  const loadData = async () => {
    try {
      const [cfg, jv] = await Promise.all([
        window.electronAPI.getServerConfig(),
        window.electronAPI.getJavaInfo(),
      ])
      setConfig(cfg)
      setJavaInfo(jv)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadData()
    const unsub = window.electronAPI.onJavaInstallProgress((p) => {
      setJavaProgress(p)
    })
    return () => unsub()
  }, [])

  const setValue = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.electronAPI.saveServerConfig(config)
      setSaved(true)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleInstallJava = async () => {
    setInstallingJava(true)
    setJavaProgress({ status: 'downloading', percent: 0 })
    try {
      const res = await window.electronAPI.installJava()
      if (res.success) {
        await loadData()
        onRefresh()
      } else {
        alert(`Java Auto-Installer failed: ${res.error}`)
      }
    } finally {
      setInstallingJava(false)
    }
  }

  const isJavaAvailable = !!javaInfo.path && javaInfo.version !== 'Not found'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings & Environment</h1>
          <p className="text-sm text-muted-foreground">
            Configure Minecraft Java Runtime environment and server.properties.
          </p>
        </div>
        {Object.keys(config).length > 0 && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1" />
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        )}
      </div>

      {/* JAVA ENVIRONMENT CARD */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Coffee className="size-5 text-amber-500" />
              Java Runtime Environment (JDK)
            </CardTitle>
            <Badge
              variant={isJavaAvailable ? 'default' : 'destructive'}
              className={isJavaAvailable ? 'bg-emerald-600 text-white' : ''}
            >
              {isJavaAvailable ? 'Java Ready' : 'Java Missing / Required'}
            </Badge>
          </div>
          <CardDescription>
            Minecraft 1.20+ requires Java 17 or Java 21 LTS to start properly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Detected Java: <span className="font-mono text-primary">{javaInfo.version || 'Not Detected'}</span>
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                Path: {javaInfo.path || 'No executable path found on system'}
              </p>
            </div>

            <Button
              onClick={handleInstallJava}
              disabled={installingJava}
              variant={isJavaAvailable ? 'outline' : 'default'}
              className={!isJavaAvailable ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
            >
              {installingJava ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  Installing JDK 21...
                </>
              ) : isJavaAvailable ? (
                <>
                  <Check className="size-4 mr-1 text-emerald-400" />
                  Re-install Temurin JDK 21
                </>
              ) : (
                <>
                  <Download className="size-4 mr-1" />
                  1-Click Auto-Install Temurin JDK 21
                </>
              )}
            </Button>
          </div>

          {/* Progress bar */}
          {installingJava && javaProgress && (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center justify-between text-xs font-medium text-amber-300">
                <span className="capitalize">{javaProgress.status}...</span>
                <span>{javaProgress.percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${javaProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {!isJavaAvailable && !installingJava && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                No Java installation detected on PATH. Click "1-Click Auto-Install" above to automatically download Eclipse Temurin OpenJDK 21.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SERVER CONFIGURATION TABS */}
      {Object.keys(config).length > 0 && (
        <>
          {saved && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
              Settings saved. Restart the server to apply changes.
            </div>
          )}

          <Tabs defaultValue="server">
            <TabsList className="flex-wrap">
              {SECTIONS.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {SECTIONS.map((section) => (
              <TabsContent key={section.key} value={section.key}>
                <Card>
                  <CardHeader>
                    <CardTitle>{section.label}</CardTitle>
                    <CardDescription>Configure server behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {section.keys.map((key) => {
                      const value = config[key]
                      if (value === undefined) return null
                      const isBool = value === 'true' || value === 'false'
                      if (isBool) {
                        return (
                          <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label htmlFor={`switch-${key}`} className="font-mono text-sm">
                                {key}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {value === 'true' ? 'Enabled' : 'Disabled'}
                              </p>
                            </div>
                            <Switch
                              id={`switch-${key}`}
                              checked={value === 'true'}
                              onCheckedChange={(checked) => setValue(key, String(checked))}
                            />
                          </div>
                        )
                      }
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label htmlFor={`input-${key}`} className="font-mono text-sm">
                            {key}
                          </Label>
                          <Input
                            id={`input-${key}`}
                            type={key.endsWith('password') ? 'password' : 'text'}
                            autoComplete="off"
                            value={value}
                            onChange={(e) => setValue(key, e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  )
}