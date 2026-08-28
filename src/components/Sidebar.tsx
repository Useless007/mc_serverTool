import { useEffect, useState } from 'react'
import logoUrl from '/logo.png'
import type { ComponentType } from 'react'
import { LayoutDashboard, Terminal, Settings, Puzzle, Folder, Network, Server, ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { TabKey } from '../App'
import type { ServerProfile } from '../types'

interface SidebarProps {
  tab: TabKey
  setTab: (tab: TabKey) => void
  serverDir: string
  javaVersion: string
  serverType: string | null
  serverVersion: string | null
  running: boolean
  onCreateServer: () => void
  onServerSwitched?: () => void
}

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'console', label: 'Console', icon: Terminal },
  { key: 'tunnels', label: 'Network & Tunnels', icon: Network },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'plugins', label: 'Plugins', icon: Puzzle },
  { key: 'files', label: 'Files', icon: Folder },
]

export default function Sidebar({
  tab,
  setTab,
  serverDir,
  javaVersion,
  serverType,
  serverVersion,
  running,
  onCreateServer,
  onServerSwitched,
}: SidebarProps) {
  const [servers, setServers] = useState<ServerProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<ServerProfile | null>(null)

  const loadServerProfiles = async () => {
    try {
      const [list, active] = await Promise.all([
        window.electronAPI.getServers(),
        window.electronAPI.getActiveServer(),
      ])
      setServers(list)
      setActiveProfile(active)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadServerProfiles()
  }, [serverDir])

  const handleSelectServer = async (id: string) => {
    if (running) {
      alert('Please stop the current server before switching to another server!')
      return
    }
    const res = await window.electronAPI.setActiveServer(id)
    if (res.success) {
      await loadServerProfiles()
      onServerSwitched?.()
    }
  }

  const handleRemoveServer = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (running && activeProfile?.id === id) {
      alert('Cannot remove currently running server!')
      return
    }
    const res = await window.electronAPI.removeServer(id)
    if (res.success) {
      await loadServerProfiles()
      onServerSwitched?.()
    }
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* App header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Logo" className="size-8 rounded-lg object-cover" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">MC Manager</p>
            <p className="text-[11px] text-muted-foreground">Server Studio</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Multi-Server Profile Selector */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between gap-1 px-3 py-2 text-left text-xs font-normal"
            >
              <div className="flex items-center gap-2 truncate">
                <Server className="size-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium">
                  {activeProfile?.name ?? (serverDir ? 'Active Server' : 'Select Server')}
                </span>
              </div>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs">My Servers ({servers.length})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-48">
              {servers.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No saved servers yet
                </div>
              ) : (
                servers.map((srv) => (
                  <DropdownMenuItem
                    key={srv.id}
                    onClick={() => handleSelectServer(srv.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div className="truncate mr-2">
                      <p className={cn('font-medium truncate', activeProfile?.id === srv.id ? 'text-primary' : '')}>
                        {srv.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{srv.type} {srv.version}</p>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="size-5 p-0 opacity-60 hover:opacity-100 hover:text-red-400"
                      onClick={(e) => handleRemoveServer(e, srv.id)}
                      title="Remove from history"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateServer} className="text-xs font-medium text-primary cursor-pointer">
              + Add / Download Server
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Server info footer */}
      <div className="space-y-2 px-4 py-4">
        <div className="flex items-center gap-2">
          {running ? (
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          ) : (
            <span className="size-2 rounded-full bg-red-500" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {running ? 'Running' : 'Stopped'}
          </span>
        </div>
        {serverType && serverVersion && (
          <Badge variant="outline" className="text-xs">
            {serverType} {serverVersion}
          </Badge>
        )}
        <p className="truncate text-xs text-muted-foreground" title={serverDir || 'No server directory'}>
          {serverDir || 'No server directory'}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={javaVersion}>
          Java: {javaVersion || 'not found'}
        </p>
      </div>
    </aside>
  )
}