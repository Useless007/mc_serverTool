import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BOOLEAN_KEYS } from '@/lib/format'

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

  useEffect(() => {
    window.electronAPI.getServerConfig().then(setConfig).catch(() => {})
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

  if (Object.keys(config).length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No server.properties found. Select a server directory and download a server first.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Edit server.properties. Changes require a server restart.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

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
                  const isBool = BOOLEAN_KEYS.has(key) || value === 'true' || value === 'false'
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
    </div>
  )
}