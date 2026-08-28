export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

export function formatUptime(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMemory(memory: number): string {
  return `${(memory / 1024 / 1024).toFixed(1)} MB`
}

export function colorizeLogLine(line: string): { text: string; color: string } {
  if (line.includes('[ERROR]') || line.includes('[FATAL]')) {
    return { text: line, color: 'text-red-400' }
  }
  if (line.includes('[WARN]')) {
    return { text: line, color: 'text-yellow-400' }
  }
  if (line.includes('[DEBUG]')) {
    return { text: line, color: 'text-blue-400' }
  }
  if (line.includes('[INFO]')) {
    return { text: line, color: 'text-zinc-300' }
  }
  if (line.startsWith('> ')) {
    return { text: line, color: 'text-emerald-400' }
  }
  return { text: line, color: 'text-zinc-400' }
}

export const BOOLEAN_KEYS = new Set([
  'allow-flight',
  'allow-nether',
  'broadcast-console-to-ops',
  'broadcast-rcon-to-ops',
  'enable-command-block',
  'enable-jmx-monitoring',
  'enable-query',
  'enable-rcon',
  'enforce-secure-profile',
  'enforce-whitelist',
  'entity-broadcast-range-percentage',
  'force-gamemode',
  'generate-structures',
  'hardcore',
  'hide-online-players',
  'online-mode',
  'pvp',
  'prevent-proxy-connections',
  'spawn-animals',
  'spawn-monsters',
  'spawn-npcs',
  'spawn-protection',
  'sync-chunk-writes',
  'use-native-transport',
  'white-list',
])