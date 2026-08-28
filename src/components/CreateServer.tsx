import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Download, FolderOpen, CloudDownload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ServerTypeInfo } from '@/types'

interface CreateServerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverDir: string
  onSelectDir: () => Promise<void>
  onDone: () => void
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  vanilla: 'Official Mojang server. Most stable, no plugins.',
  paper: 'High-performance fork with plugin & optimization support.',
  spigot: 'Popular fork with plugin support.',
}

const STEP_LABELS = ['Type', 'Version', 'Memory']

export default function CreateServer({
  open,
  onOpenChange,
  serverDir,
  onSelectDir,
  onDone,
}: CreateServerProps) {
  const [step, setStep] = useState(0)
  const [types, setTypes] = useState<ServerTypeInfo[]>([])
  const [type, setType] = useState<string>('')
  const [version, setVersion] = useState<string>('')
  const [memory, setMemory] = useState('4')
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setType('')
    setVersion('')
    setMemory('4')
    setError('')
    setSuccess(false)
    setProgress(0)
    window.electronAPI.getServerTypes().then(setTypes).catch(() => {})
  }, [open])

  useEffect(() => {
    const unsub = window.electronAPI.onDownloadProgress((p) => {
      setProgress(p.percent)
    })
    return unsub
  }, [])

  const selectedType = types.find((t) => t.type === type)

  const handleDownload = async () => {
    if (!type || !version || !serverDir) return
    setDownloading(true)
    setError('')
    try {
      const res = await window.electronAPI.downloadServer(type, version)
      if (res.success) {
        setSuccess(true)
        onDone()
      } else {
        setError(res.error ?? 'Download failed')
      }
    } finally {
      setDownloading(false)
    }
  }

  const canNext = step === 0 ? type !== '' : step === 1 ? version !== '' : serverDir !== ''

  return (
    <Dialog open={open} onOpenChange={(o) => !downloading && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Server</DialogTitle>
          <DialogDescription>
            Download a Minecraft server and configure it in your directory.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-medium',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'bg-primary/20 text-foreground'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'text-xs',
                  i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && <div className="h-px w-4 bg-border" />}
            </div>
          ))}
        </div>

        <div className="min-h-[240px]">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-3">
              {types.map((t) => (
                <button
                  key={t.type}
                  onClick={() => {
                    setType(t.type)
                    setVersion('')
                  }}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors',
                    type === t.type
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-border hover:bg-accent/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{t.label}</p>
                    {type === t.type && <Badge>Selected</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TYPE_DESCRIPTIONS[t.type]}
                  </p>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Choose a Minecraft version for {selectedType?.label ?? type}.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedType?.versions.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVersion(v)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      version === v
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-accent/40'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Final configuration before download.</p>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Server directory</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-sm">{serverDir || 'Not selected'}</p>
                  <Button variant="outline" size="sm" onClick={onSelectDir}>
                    <FolderOpen className="size-4" />
                    Browse
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory">Memory allocation (GB)</Label>
                <Input
                  id="memory"
                  type="number"
                  min="1"
                  max="32"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Will download <span className="font-mono">{selectedType?.label} {version}</span> (~50 MB).
              </p>
            </div>
          )}

          {downloading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CloudDownload className="size-4 animate-pulse" />
                Downloading {type} {version}...
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
              Server downloaded successfully! Start it from the Dashboard.
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={downloading}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleDownload}
              disabled={!canNext || downloading}
            >
              <Download className="size-4" />
              {downloading ? 'Downloading...' : 'Download Server'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}