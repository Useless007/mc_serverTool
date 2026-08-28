import path from 'path'

export interface PluginSearchResult {
  source: 'spiget' | 'modrinth'
  id: string
  name: string
  description: string
  author: string
  downloads: number
  iconUrl: string | null
}

const SPIGET_BASE = 'https://api.spiget.org/v2'
const MODRINTH_BASE = 'https://api.modrinth.com/v2'
const USER_AGENT = 'minecraft-server-manager/1.0'

interface SpigetResource {
  id: number
  name?: string
  tag?: string
  downloads?: number
}

interface ModrinthHit {
  project_id: string
  title?: string
  description?: string
  author?: string
  downloads?: number
  icon_url?: string | null
}

interface SpigetVersion {
  name?: string
}

interface ModrinthVersionFile {
  url: string
  filename: string
}

interface ModrinthVersion {
  loaders?: string[]
  files?: ModrinthVersionFile[]
}

const SPIGET_ID = /^[0-9]+$/
const MODRINTH_ID = /^[A-Za-z0-9]+$/

/**
 * Hosts a plugin jar may actually be served from. Spiget resources can declare
 * an *external* download link, so the redirect target is attacker-chosen unless
 * it is checked here.
 */
const ALLOWED_JAR_HOSTS = new Set([
  'api.spiget.org',
  'www.spigotmc.org',
  'spigotmc.org',
  'cdn.modrinth.com',
])

function assertAllowedJarUrl(raw: string, base: string): string {
  const target = new URL(raw, base)
  if (target.protocol !== 'https:') {
    throw new Error(`Plugin download must use https (got ${target.protocol})`)
  }
  if (!ALLOWED_JAR_HOSTS.has(target.hostname)) {
    throw new Error(
      `Plugin download host not allowed: ${target.hostname}. ` +
        'Install it with the direct-URL field if you trust this source.'
    )
  }
  return target.toString()
}

async function searchSpiget(query: string, limit: number): Promise<PluginSearchResult[]> {
  const res = await fetch(
    `${SPIGET_BASE}/search/resources/${encodeURIComponent(query)}?field=name&size=${limit}`,
    { signal: AbortSignal.timeout(15000) }
  )
  if (!res.ok) throw new Error(`Spiget API error (HTTP ${res.status})`)
  const items = (await res.json()) as SpigetResource[]
  return items.map((item) => ({
    source: 'spiget' as const,
    id: String(item.id),
    name: item.name ?? `Resource ${item.id}`,
    description: item.tag ?? '',
    author: 'SpigotMC',
    downloads: item.downloads ?? 0,
    iconUrl: `${SPIGET_BASE}/resources/${item.id}/icon`,
  }))
}

async function searchModrinth(query: string, limit: number): Promise<PluginSearchResult[]> {
  const facets = encodeURIComponent(JSON.stringify([['project_type:plugin']]))
  const res = await fetch(
    `${MODRINTH_BASE}/search?query=${encodeURIComponent(query)}&facets=${facets}&limit=${limit}`,
    { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) }
  )
  if (!res.ok) throw new Error(`Modrinth API error (HTTP ${res.status})`)
  const body = (await res.json()) as { hits?: ModrinthHit[] }
  return (body.hits ?? []).map((hit) => ({
    source: 'modrinth' as const,
    id: hit.project_id,
    name: hit.title ?? 'Unknown plugin',
    description: (hit.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    author: hit.author ?? '',
    downloads: hit.downloads ?? 0,
    iconUrl: hit.icon_url && hit.icon_url.startsWith('http') ? hit.icon_url : null,
  }))
}

/**
 * Search both SpigotMC and Modrinth; a failing source is skipped as long as the
 * other one returns results.
 */
export async function searchPlugins(query: string, limit = 20): Promise<PluginSearchResult[]> {
  const [spiget, modrinth] = await Promise.allSettled([
    searchSpiget(query, limit),
    searchModrinth(query, limit),
  ])

  const results: PluginSearchResult[] = []
  const failures: string[] = []
  if (spiget.status === 'fulfilled') results.push(...spiget.value)
  else failures.push(`Spiget: ${(spiget.reason as Error).message}`)
  if (modrinth.status === 'fulfilled') results.push(...modrinth.value)
  else failures.push(`Modrinth: ${(modrinth.reason as Error).message}`)

  if (results.length === 0) {
    throw new Error(`Plugin search failed (${failures.join('; ')})`)
  }

  const seen = new Set<string>()
  const deduped = results.filter((r) => {
    const key = `${r.source}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped.sort((a, b) => b.downloads - a.downloads)
}

/** Resolve a plugin to a directly downloadable jar URL. */
export async function resolvePluginJar(
  source: 'spiget' | 'modrinth',
  id: string
): Promise<{ name: string; url: string }> {
  if (source === 'spiget') return resolveSpigetJar(id)
  return resolveModrinthJar(id)
}

async function resolveSpigetJar(id: string): Promise<{ name: string; url: string }> {
  if (!SPIGET_ID.test(id)) throw new Error(`Invalid Spiget resource id: ${id}`)
  let versionLabel = ''
  try {
    const res = await fetch(`${SPIGET_BASE}/resources/${encodeURIComponent(id)}/versions/latest`, {
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const version = (await res.json()) as SpigetVersion
      versionLabel = version.name ?? ''
    }
  } catch {
    // Version lookup is best-effort; fall back to the generic name.
  }

  const downloadUrl = `${SPIGET_BASE}/resources/${encodeURIComponent(id)}/download`
  const res = await fetch(downloadUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  })

  let url = downloadUrl
  let filename = ''
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get('location')
    if (location) {
      url = assertAllowedJarUrl(location, downloadUrl)
      // Decode first, then basename. The other order lets an encoded traversal
      // ("%2e%2e%2f") survive basename() and turn back into "../" afterwards.
      try {
        filename = path.basename(decodeURIComponent(new URL(url).pathname))
      } catch {
        // Unparseable location; keep the generic name.
      }
    }
  }

  const name = filename || (versionLabel ? `plugin-${id}-${versionLabel}.jar` : `plugin-${id}.jar`)
  return { name, url }
}

async function resolveModrinthJar(id: string): Promise<{ name: string; url: string }> {
  if (!MODRINTH_ID.test(id)) throw new Error(`Invalid Modrinth project id: ${id}`)
  const res = await fetch(`${MODRINTH_BASE}/project/${encodeURIComponent(id)}/version`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Modrinth API error (HTTP ${res.status})`)
  const versions = (await res.json()) as ModrinthVersion[]

  const compatible = versions.find((v) =>
    (v.loaders ?? []).some((l) => ['paper', 'spigot', 'bukkit'].includes(l))
  )
  const version = compatible ?? versions[0]
  const file = version?.files?.[0]
  if (!version || !file) throw new Error('No compatible plugin version found')
  return { name: file.filename, url: assertAllowedJarUrl(file.url, MODRINTH_BASE) }
}