import { useEffect, useState } from 'react'
import { Download, Puzzle, Trash2, PackageOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatBytes } from '@/lib/format'
import type { PluginInfo } from '@/types'

export default function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [url, setUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadPlugins = () => {
    window.electronAPI.getPlugins().then(setPlugins).catch(() => {})
  }

  useEffect(loadPlugins, [])

  const handleInstall = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setInstalling(true)
    setError('')
    try {
      const res = await window.electronAPI.installPlugin(trimmed)
      if (!res.success) {
        setError(res.error ?? 'Failed to install plugin')
      } else {
        setUrl('')
        loadPlugins()
      }
    } finally {
      setInstalling(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await window.electronAPI.deletePlugin(deleteTarget)
    setDeleteTarget(null)
    loadPlugins()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Puzzle className="size-6" />
          Plugins
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage server plugins. Plugins are only supported on Paper and Spigot servers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Install Plugin</CardTitle>
          <CardDescription>Paste the direct download URL of a plugin .jar</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/plugin.jar"
            className="font-mono"
          />
          <Button onClick={handleInstall} disabled={installing || !url.trim()}>
            <Download className="size-4" />
            {installing ? 'Installing...' : 'Install'}
          </Button>
        </CardContent>
        {error && <CardContent className="py-0 text-sm text-red-400">{error}</CardContent>}
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Installed Plugins ({plugins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {plugins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <PackageOpen className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No plugins installed. Add plugins from SpigotMC or Bukkit.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <div
                  key={plugin.name}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Puzzle className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{plugin.name.replace(/\.jar$/, '')}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(plugin.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(plugin.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plugin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono">{deleteTarget}</span>? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}