export interface ServerStatus {
  running: boolean
  pid: number | null
  serverType: string | null
  version: string | null
  uptime: number
  memory: number
}

export interface ServerTypeInfo {
  type: string
  label: string
  versions: string[]
}

export interface FileEntry {
  name: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface PluginInfo {
  name: string
  size: number
}

export interface DownloadProgress {
  type: string
  version: string
  percent: number
}