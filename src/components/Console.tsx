import { useEffect, useRef, useState } from 'react'
import { Send, Trash2, Terminal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { colorizeLogLine } from '@/lib/format'
import type { ServerStatus } from '@/types'

const MAX_LOG_LINES = 4000

interface ConsoleProps {
  status: ServerStatus
}

export default function Console({ status }: ConsoleProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getConsoleLogs().then(setLogs).catch(() => {})
    const unsub = window.electronAPI.onConsoleOutput((line) => {
      // Main caps its buffer at 4000 lines; cap here too or a busy server grows
      // this array without bound for as long as the app stays open.
      setLogs((prev) => {
        const next = [...prev, line]
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [logs])

  const handleSend = async () => {
    const cmd = command.trim()
    if (!cmd) return
    await window.electronAPI.sendCommand(cmd)
    setCommand('')
  }

  const handleClear = async () => {
    await window.electronAPI.clearConsoleLogs()
    setLogs([])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Terminal className="size-6" />
            Console
          </h1>
          <p className="text-sm text-muted-foreground">Live server output and command input</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.running ? 'default' : 'secondary'} className="gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                status.running ? 'bg-emerald-500' : 'bg-zinc-500'
              }`}
            />
            {status.running ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="size-4" />
            Clear
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-3">
          <CardTitle className="text-sm font-medium">Server Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="bg-black/40 font-mono text-xs">
            <div className="h-[480px] p-4">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">
                  Server console output will appear here...
                </p>
              ) : (
                logs.map((line, i) => {
                  const { text, color } = colorizeLogLine(line)
                  return (
                    <div key={i} className={`whitespace-pre-wrap break-all ${color}`}>
                      {text}
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
      >
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={status.running ? 'Type a command... e.g. /help' : 'Start the server to send commands'}
          disabled={!status.running}
          className="font-mono"
        />
        <Button type="submit" disabled={!status.running || !command.trim()}>
          <Send className="size-4" />
          Send
        </Button>
      </form>
    </div>
  )
}