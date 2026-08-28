import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface JavaInstallProgress {
  status: 'downloading' | 'extracting' | 'completed' | 'failed'
  percent: number
  error?: string
}

const TEMURIN_JDK21_URLS: Record<string, string> = {
  'win32-x64':
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_windows_hotspot_21.0.6_7.zip',
  'darwin-x64':
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_mac_hotspot_21.0.6_7.tar.gz',
  'darwin-arm64':
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.6_7.tar.gz',
  'linux-x64':
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_linux_hotspot_21.0.6_7.tar.gz',
}

export class JavaInstaller {
  private readonly userDataPath: string
  private installing = false

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath
  }

  getCustomJavaPath(): string | null {
    const javaDir = path.join(this.userDataPath, 'java_21')
    if (!fs.existsSync(javaDir)) return null

    const binName = process.platform === 'win32' ? 'java.exe' : 'java'

    // Walk directory to find java binary
    function findJava(dir: string): string | null {
      const items = fs.readdirSync(dir, { withFileTypes: true })
      for (const item of items) {
        const full = path.join(dir, item.name)
        if (item.isDirectory()) {
          const res = findJava(full)
          if (res) return res
        } else if (item.name.toLowerCase() === binName) {
          if (path.basename(path.dirname(full)).toLowerCase() === 'bin') {
            return full
          }
        }
      }
      return null
    }

    return findJava(javaDir)
  }

  async installJava(
    onProgress: (progress: JavaInstallProgress) => void
  ): Promise<string> {
    if (this.installing) throw new Error('Java installation already in progress')
    this.installing = true

    try {
      const existing = this.getCustomJavaPath()
      if (existing) {
        onProgress({ status: 'completed', percent: 100 })
        this.installing = false
        return existing
      }

      const platformKey = `${process.platform}-${process.arch}`
      const url = TEMURIN_JDK21_URLS[platformKey]
      if (!url) {
        throw new Error(`Auto JDK 21 installer not supported for platform ${platformKey}`)
      }

      const installDir = path.join(this.userDataPath, 'java_21')
      fs.mkdirSync(installDir, { recursive: true })

      const archiveName = url.endsWith('.zip') ? 'jdk.zip' : 'jdk.tar.gz'
      const archivePath = path.join(installDir, archiveName)

      onProgress({ status: 'downloading', percent: 0 })

      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`)

      const total = Number(res.headers.get('content-length') ?? 0)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Failed to start download stream')

      const chunks: Buffer[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          received += value.byteLength
          chunks.push(Buffer.from(value))
          if (total > 0) {
            const pct = Math.round((received / total) * 100)
            onProgress({ status: 'downloading', percent: pct })
          }
        }
      }

      fs.writeFileSync(archivePath, Buffer.concat(chunks))

      onProgress({ status: 'extracting', percent: 100 })

      if (archiveName.endsWith('.zip')) {
        try {
          await execFileAsync('tar', ['-xf', archivePath, '-C', installDir], {
            timeout: 120000,
            windowsHide: true,
          })
        } catch {
          await execFileAsync(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${installDir}' -Force`,
            ],
            { timeout: 180000, windowsHide: true }
          )
        }
      } else {
        await execFileAsync('tar', ['-xzf', archivePath, '-C', installDir], {
          timeout: 120000,
          windowsHide: true,
        })
      }

      // Cleanup archive
      try {
        fs.unlinkSync(archivePath)
      } catch {
        /* ignore */
      }

      const installedJava = this.getCustomJavaPath()
      if (!installedJava) {
        throw new Error('Java installation failed: java executable not found after extraction')
      }

      if (process.platform !== 'win32') {
        fs.chmodSync(installedJava, 0o755)
      }

      onProgress({ status: 'completed', percent: 100 })
      return installedJava
    } catch (err) {
      const msg = (err as Error).message
      onProgress({ status: 'failed', percent: 0, error: msg })
      throw err
    } finally {
      this.installing = false
    }
  }
}
