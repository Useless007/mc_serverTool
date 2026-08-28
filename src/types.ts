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

export interface ServerProfile {
  id: string
  name: string
  dir: string
  type: string
  version: string
  createdAt: string
  lastUsedAt: string
}

export interface TunnelStatus {
  running: boolean
  url: string | null
  error: string | null
  startedAt: number | null
  tokenConfigured: boolean
  binaryAvailable: boolean
}

export interface PluginSearchResult {
  source: 'spiget' | 'modrinth'
  id: string
  name: string
  description: string
  author: string
  downloads: number
  iconUrl: string | null
}