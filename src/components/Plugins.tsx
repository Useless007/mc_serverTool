import { useEffect, useState } from 'react'
import { Download, Puzzle, Trash2, PackageOpen, Search, Globe, Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { PluginInfo, PluginSearchResult } from '@/types'

export default function Plugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [url, setUrl] = useState('')
  const [installingUrl, setInstallingUrl] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [urlError, setUrlError] = useState('')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PluginSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [installingIds, setInstallingIds] = useState<Record<string, boolean>>({})
  const [installedRemoteIds, setInstalledRemoteIds] = useState<Record<string, boolean>>({})

  const loadPlugins = () => {
    window.electronAPI.getPlugins().then(setPlugins).catch(() => {})
  }

  useEffect(loadPlugins, [])

  const handleInstallUrl = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setInstallingUrl(true)
    setUrlError('')
    try {
      const res = await window.electronAPI.installPlugin(trimmed)
      if (!res.success) {
        setUrlError(res.error ?? 'Failed to install plugin')
      } else {
        setUrl('')
        loadPlugins()
      }
    } finally {
      setInstallingUrl(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await window.electronAPI.deletePlugin(deleteTarget)
    setDeleteTarget(null)
    loadPlugins()
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const results = await window.electronAPI.searchPlugins(searchQuery.trim(), 24)
      setSearchResults(results)
    } catch (err) {
      setSearchError((err as Error).message ?? 'Failed to search plugins')
    } finally {
      setSearching(false)
    }
  }

  const handleInstallRemote = async (plugin: PluginSearchResult) => {
    const key = `${plugin.source}:${plugin.id}`
    setInstallingIds((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await window.electronAPI.installRemotePlugin(plugin.source, plugin.id)
      if (res.success) {
        setInstalledRemoteIds((prev) => ({ ...prev, [key]: true }))
        loadPlugins()
      } else {
        alert(`Failed to install ${plugin.name}: ${res.error}`)
      }
    } finally {
      setInstallingIds((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Puzzle className="size-6 text-primary" />
          Plugins Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse, search online, and manage server plugins (Paper & Spigot supported).
        </p>
      </div>

      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="online" className="flex items-center gap-2">
            <Globe className="size-4" />
            Browse Online Plugins
          </TabsTrigger>
          <TabsTrigger value="installed" className="flex items-center gap-2">
            <Puzzle className="size-4" />
            Installed ({plugins.length})
          </TabsTrigger>
        </TabsList>

        {/* BROWSE ONLINE TAB */}
        <TabsContent value="online" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Plugins</CardTitle>
              <CardDescription>
                Search over 100,000+ Minecraft plugins directly from SpigotMC and Modrinth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plugins (e.g. EssentialsX, Vault, WorldEdit, LuckPerms)..."
                    className="pl-9"
                  />
                </div>
                <Button type="submit" disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
                </Button>
              </form>
              {searchError && <p className="mt-2 text-xs text-red-400">{searchError}</p>}
            </CardContent>
          </Card>

          {/* Direct URL installer accordion inside Browse */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Install via Direct URL</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2 pt-0">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/plugin.jar"
                className="font-mono text-xs"
              />
              <Button onClick={handleInstallUrl} disabled={installingUrl || !url.trim()} size="sm">
                <Download className="size-4 mr-1" />
                {installingUrl ? 'Installing...' : 'Install Jar'}
              </Button>
            </CardContent>
            {urlError && <CardContent className="py-0 text-xs text-red-400">{urlError}</CardContent>}
          </Card>

          {/* Results Grid */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((item) => {
                const itemKey = `${item.source}:${item.id}`
                const isInstalling = !!installingIds[itemKey]
                const isInstalled = !!installedRemoteIds[itemKey]
                const isAlreadyPresent = plugins.some((p) =>
                  p.name.toLowerCase().includes(item.name.toLowerCase())
                )

                return (
                  <Card key={itemKey} className="flex flex-col justify-between border-border bg-card">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start gap-3">
                        {item.iconUrl ? (
                          <img
                            src={item.iconUrl}
                            alt={item.name}
                            className="size-10 rounded-lg object-contain bg-background p-1 border border-border shrink-0"
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground shrink-0">
                            <Puzzle className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="truncate font-semibold text-sm" title={item.name}>
                              {item.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-mono shrink-0"
                            >
                              {item.source}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            By {item.author || 'Unknown'} • {item.downloads.toLocaleString()} downloads
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 py-2 text-xs text-muted-foreground line-clamp-2">
                      {item.description || 'No description available for this plugin.'}
                    </CardContent>
                    <div className="p-4 pt-2">
                      <Button
                        size="sm"
                        className="w-full"
                        variant={isInstalled || isAlreadyPresent ? 'outline' : 'default'}
                        disabled={isInstalling || isInstalled}
                        onClick={() => handleInstallRemote(item)}
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="size-4 mr-1 animate-spin" /> Installing...
                          </>
                        ) : isInstalled ? (
                          <>
                            <Check className="size-4 mr-1 text-emerald-400" /> Installed
                          </>
                        ) : (
                          <>
                            <Download className="size-4 mr-1" /> 1-Click Install
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* INSTALLED TAB */}
        <TabsContent value="installed" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Installed Plugins ({plugins.length})</CardTitle>
              <CardDescription>Plugins currently present in `/plugins` folder.</CardDescription>
            </CardHeader>
            <CardContent>
              {plugins.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <PackageOpen className="size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No plugins installed. Search online plugins tab to install!
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
                        <Puzzle className="size-4 text-primary" />
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
        </TabsContent>
      </Tabs>

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