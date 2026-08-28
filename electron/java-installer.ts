import { execFile } from 'child_process'
import crypto from 'crypto'
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

/** Published by Adoptium alongside each asset as <asset>.sha256.txt. */
const TEMURIN_JDK21_SHA256: Record<string, string> = {
  'win32-x64': '897c8eebb0f85a99ccecbd482ebae9a45d88c19d6077054f6529ebab49b6d259',
  'darwin-x64': '7aacfc400078ad65b7c7de3ec75ff74bf5c2077d6740b350f85ae10be4f71e76',
  'darwin-arm64': '4ef4083919126a3d93e603284b405c7493905497485a92b375f5d6c3e8f7e8f2',
  'linux-x64': 'a2650fba422283fbed20d936ce5d2a52906a5414ec17b2f7676dddb87201dbae',
}

export class JavaInstaller {
  private readonly userDataPath: string
  private installing = false
  private cachedJavaPath: string | null = null

  constructor(userDataPath: string) {
    this.userDataPath = userDataPath
  }

  /**
   * Cached: this walks an entire JDK tree (~20k files) synchronously, and it is
   * called on every get-java-info and every server start, which blocks the
   * main process - and therefore the whole UI - each time.
   */
  getCustomJavaPath(): string | null {
    if (this.cachedJavaPath && fs.existsSync(this.cachedJavaPath)) return this.cachedJavaPath

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

    this.cachedJavaPath = findJava(javaDir)
    return this.cachedJavaPath
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
      const partialPath = `${archivePath}.part`

      onProgress({ status: 'downloading', percent: 0 })

      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`)

      const total = Number(res.headers.get('content-length') ?? 0)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Failed to start download stream')

      // Stream to disk. Buffering the whole JDK and then Buffer.concat-ing it
      // peaks at roughly twice its ~200MB size in the main process.
      const ws = fs.createWriteStream(partialPath)
      let streamError: Error | null = null
      ws.on('error', (err: Error) => {
        streamError = streamError ?? err
      })
      const hash = crypto.createHash('sha256')
      let received = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          received += value.byteLength
          hash.update(value)
          if (!ws.write(Buffer.from(value))) {
            await new Promise<void>((r) => ws.once('drain', r))
          }
          if (total > 0) {
            onProgress({ status: 'downloading', percent: Math.round((received / total) * 100) })
          }
        }
        await new Promise<void>((resolve) => ws.end(() => resolve()))
        if (streamError) throw streamError
      } catch (err) {
        ws.destroy()
        fs.rmSync(partialPath, { force: true })
        throw err
      }

      // This archive becomes the JVM that runs the server. Verify it before
      // anything unpacks or executes it.
      const expected = TEMURIN_JDK21_SHA256[platformKey]
      const actual = hash.digest('hex')
      if (expected && actual !== expected) {
        fs.rmSync(partialPath, { force: true })
        throw new Error(`JDK checksum mismatch - download rejected (expected ${expected}, got ${actual})`)
      }
      fs.renameSync(partialPath, archivePath)

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
              '& { param($a,$d) Expand-Archive -LiteralPath $a -DestinationPath $d -Force }',
              '-a',
              archivePath,
              '-d',
              installDir,
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

      this.cachedJavaPath = null
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
