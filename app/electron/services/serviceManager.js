import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { app } from 'electron'
import { apiFetch } from '../config/apiFetch.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isWin = process.platform === 'win32'

/**
 * Build PATH for spawned processes. When the app is launched from Finder/Dock,
 * PATH is minimal and often lacks node/npm. Include common install locations.
 */
function buildSpawnEnv(baseEnv) {
  const existingPath = baseEnv.PATH || baseEnv.Path || process.env.PATH || ''
  if (isWin) {
    const extraPaths = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs'),
      path.join(process.env.APPDATA || '', 'npm')
    ].filter(Boolean)
    const pathEntries = [...extraPaths, existingPath]
    return { ...baseEnv, PATH: pathEntries.filter(Boolean).join(';') }
  }
  const extraPaths = ['/usr/local/bin', '/opt/homebrew/bin']
  const pathEntries = [...extraPaths, existingPath || '/usr/bin:/bin']
  return { ...baseEnv, PATH: pathEntries.join(':') }
}

/**
 * Find node binary. In packaged apps launched from Finder/Dock, node may not be in PATH.
 */
function findNodeBinary(env) {
  const envWithPath = buildSpawnEnv(env || process.env)
  const findCmd = isWin ? 'where node' : 'which node'
  try {
    const result = execSync(findCmd, { encoding: 'utf8', env: envWithPath, windowsHide: true })
    const line = (result || '').trim().split('\n')[0]
    if (line && fs.existsSync(line.trim())) return line.trim()
  } catch (_) {}
  if (isWin) {
    const winCandidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe')
    ]
    for (const p of winCandidates) {
      if (p && fs.existsSync(p)) return p
    }
  } else {
    const candidates = ['/usr/local/bin/node', '/opt/homebrew/bin/node']
    for (const p of candidates) {
      if (fs.existsSync(p)) return p
    }
  }
  return 'node' // fallback — may fail
}

function findProjectRoot(startPath) {
  let current = path.resolve(startPath)
  const root = path.parse(current).root
  while (current !== root) {
    const apiDir = path.join(current, 'api')
    if (fs.existsSync(apiDir)) return current
    current = path.dirname(current)
  }
  return null
}

function resolveApiDir() {
  if (process.env.API_DIR && fs.existsSync(process.env.API_DIR)) {
    return process.env.API_DIR
  }

  const resourceCandidates = [
    path.join(process.resourcesPath || '', 'api'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'api')
  ]
  for (const candidate of resourceCandidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }

  const rootDir = findProjectRoot(__dirname)
  if (rootDir) {
    const projectApiDir = path.join(rootDir, 'api')
    if (fs.existsSync(projectApiDir)) return projectApiDir
  }

  return null
}

const API_DIR = resolveApiDir()

class ServerManager {
  constructor() {
    this.apiProcess = null
    this.lastLogs = []
  }

  _appendLog(line) {
    this.lastLogs.push(line)
    if (this.lastLogs.length > 2000) this.lastLogs.shift()
  }

  async startServer(options = {}) {
    console.log('[serviceManager] startServer API_DIR=', API_DIR, 'port=', options.port, 'dbFile=', options.dbFile)
    if (this.apiProcess && !this.apiProcess.killed) {
      return { success: true, message: 'Server already running' }
    }

    if (!API_DIR || !fs.existsSync(API_DIR)) {
      return {
        success: false,
        error: `API directory not found. Looked for packaged resources and project-local /api directory.`
      }
    }

    const port = Number(options.port || process.env.PORT || 4000)
    const dbFile = options.dbFile || process.env.DB_FILE
    const baseEnv = {
      ...process.env,
      PORT: String(port),
      DB_FILE: dbFile || '',
      DB_CLIENT: 'sqlite3',
    }
    const env = buildSpawnEnv(baseEnv)
    if (dbFile) fs.mkdirSync(path.dirname(dbFile), { recursive: true })
    const shouldSeed = !!dbFile && !fs.existsSync(dbFile)
    // Always run migrate:latest so any new migrations are applied even when
    // the DB file already exists (e.g. after updating the packaged app).
    // Seed only runs once, when the database file is brand-new.
    const nodeBin = findNodeBinary(env)
    const knexCli = path.join(API_DIR, 'node_modules', 'knex', 'bin', 'cli.js')
    try {
      console.log('[serviceManager] running migrations...')
      if (fs.existsSync(knexCli)) {
        execSync(`"${nodeBin}" "${knexCli}" migrate:latest --knexfile db/knexfile.js`, { cwd: API_DIR, env, stdio: 'inherit' })
      } else {
        execSync('npm run migrate', { cwd: API_DIR, env, stdio: 'inherit' })
      }
      console.log('[serviceManager] migrations done, spawning API...')
      if (shouldSeed) {
        if (fs.existsSync(knexCli)) {
          execSync(`"${nodeBin}" "${knexCli}" seed:run --knexfile db/knexfile.js`, { cwd: API_DIR, env, stdio: 'inherit' })
        } else {
          execSync('npm run seed', { cwd: API_DIR, env, stdio: 'inherit' })
        }
      }
    } catch (error) {
      return { success: false, error: `Failed to run migrations: ${error.message}` }
    }

    const apiEntry = path.join(API_DIR, 'src', 'index.js')
    const useNodeDirect = fs.existsSync(apiEntry) && (app.isPackaged || process.env.NODE_ENV === 'production')
    const spawnOptions = { cwd: API_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] }
    if (useNodeDirect) {
      this.apiProcess = spawn(nodeBin, [apiEntry], spawnOptions)
    } else {
      this.apiProcess = spawn('npm', ['run', process.env.NODE_ENV === 'production' ? 'start' : 'dev'], { ...spawnOptions, shell: true })
    }

    this.apiProcess.stdout.on('data', (data) => {
      this._appendLog(`[API] ${String(data)}`)
    })
    this.apiProcess.stderr.on('data', (data) => {
      this._appendLog(`[API_ERR] ${String(data)}`)
      console.error(`[API_ERR] ${String(data)}`)
    })
    this.apiProcess.on('close', (code) => {
      this._appendLog(`[API_EXIT] exited with code ${code}`)
      this.apiProcess = null
    })
    this.apiProcess.on('error', (err) => {
      this._appendLog(`[API_ERROR] ${err.message}`)
      this.apiProcess = null
    })

    // Give process a moment to fail fast if startup is broken.
    await new Promise((resolve) => setTimeout(resolve, 800))
    if (!this.apiProcess || this.apiProcess.killed) {
      return { success: false, error: 'Failed to start API server process' }
    }
    return { success: true, message: 'API server started', port, dbFile }
  }

  async stopServer() {
    if (!this.apiProcess) return { success: true, message: 'Server already stopped' }
    const proc = this.apiProcess
    if (!proc.killed) proc.kill('SIGTERM')
    setTimeout(() => {
      if (this.apiProcess && !this.apiProcess.killed) this.apiProcess.kill('SIGKILL')
    }, 3000)
    this.apiProcess = null
    return { success: true, message: 'API server stopped' }
  }

  async getServiceStatus() {
    const running = !!(this.apiProcess && !this.apiProcess.killed)
    return {
      success: true,
      services: [{ name: 'api', status: running ? 'running' : 'stopped', health: 'unknown' }],
    }
  }

  async checkApiHealth(apiRoot = 'http://localhost:4000', timeoutMs = 15000) {
    const url = `${String(apiRoot || '').replace(/\/+$/, '')}/health`
    console.log('[health-check] probing', url)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await apiFetch(url, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      console.log('[health-check] response', res.status, data)
      return { success: true, healthy: data.ok === true }
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('[health-check] failed', url, error.message, error.cause?.message || '')
      return { success: false, healthy: false, error: error.message }
    }
  }

  async getLogs(_service = 'api', lines = 200) {
    const take = Number(lines) > 0 ? Number(lines) : 200
    return { success: true, logs: this.lastLogs.slice(-take).join('') }
  }

  // Compatibility shims (legacy IPC calls)
  async checkDocker() {
    return { installed: false, running: false, error: 'Docker mode removed in sqlite-only branch' }
  }
  async startDevServer(opts = {}) { return this.startServer(opts) }
  async stopDevServer() { return this.stopServer() }
  async checkDevServerStatus() {
    const running = !!(this.apiProcess && !this.apiProcess.killed)
    return { success: true, running }
  }
  async startServices(opts = {}) { return this.startServer(opts) }
  async stopServices() { return this.stopServer() }
}

export default ServerManager