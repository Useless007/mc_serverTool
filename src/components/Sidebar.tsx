import type { ComponentType } from 'react'
import { Blocks, LayoutDashboard, Terminal, Settings, Puzzle, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TabKey } from '../App'

interface SidebarProps {
  tab: TabKey
  setTab: (tab: TabKey) => void
  serverDir: string
  javaVersion: string
  serverType: string | null
  serverVersion: string | null
  running: boolean
  onCreateServer: () => void
}

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'console', label: 'Console', icon: Terminal },
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
}: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* App header */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Blocks className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">MC Manager</p>
          <p className="text-xs text-muted-foreground">Minecraft Server</p>
        </div>
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

        <Button
          variant="default"
          size="sm"
          className="mt-4 w-full"
          onClick={onCreateServer}
        >
          + Create Server
        </Button>
      </ScrollArea>

      <Separator />

      {/* Server info footer */}
      <div className="space-y-2 px-4 py-4">
        <div className="flex items-center gap-2">
          {running ? (
            <span className="size-2 rounded-full bg-emerald-500" />
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