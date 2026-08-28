import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Folder,
  File,
  FolderPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { formatBytes, formatDate } from '@/lib/format'
import type { FileEntry } from '@/types'

export default function FileManager() {
  const [path, setPath] = useState<string[]>([])
  const [files, setFiles] = useState<FileEntry[]>([])
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)

  const currentPath = path.join('/')

  const load = async (subpath?: string) => {
    setError('')
    try {
      const list = await window.electronAPI.listFiles(subpath ?? currentPath)
      setFiles(list)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath])

  const navigate = (dir: string) => setPath((p) => [...p, dir])
  const goUp = () => setPath((p) => p.slice(0, -1))
  const goTo = (index: number) => setPath((p) => p.slice(0, index + 1))

  const handleCreate = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const target = currentPath ? `${currentPath}/${name}` : name
    await window.electronAPI.createDirectory(target)
    setCreateOpen(false)
    setNewFolderName('')
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = currentPath ? `${currentPath}/${deleteTarget.name}` : deleteTarget.name
    await window.electronAPI.deleteFile(target)
    setDeleteTarget(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground">Browse and manage server files</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="size-4" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5"
          onClick={() => setPath([])}
        >
          Server
        </Button>
        {path.map((part, i) => (
          <div key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground" />
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => goTo(i)}>
              {part}
            </Button>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {currentPath ? `/${currentPath}` : '/'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {path.length > 0 && (
            <button
              onClick={goUp}
              className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent/40"
            >
              <Folder className="size-4" />
              ..
            </button>
          )}
          {files.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              This folder is empty.
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.name}
                className="group flex items-center justify-between border-b px-4 py-2.5 last:border-b-0 hover:bg-accent/40"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onDoubleClick={() => file.isDirectory && navigate(file.name)}
                  onClick={() => file.isDirectory && navigate(file.name)}
                >
                  {file.isDirectory ? (
                    <Folder className="size-4 shrink-0 text-yellow-500" />
                  ) : (
                    <File className="size-4 shrink-0 text-blue-400" />
                  )}
                  <span className="truncate text-sm">{file.name}</span>
                </button>
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                  {!file.isDirectory && <span>{formatBytes(file.size)}</span>}
                  <span className="hidden sm:inline">{formatDate(file.modified)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => setDeleteTarget(file)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder in {currentPath ? `/${currentPath}` : 'the server root'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="my-folder"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.isDirectory ? 'folder' : 'file'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-mono">{deleteTarget?.name}</span>? This cannot be undone.
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