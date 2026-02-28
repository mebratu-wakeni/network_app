import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function findProjectRoot(startPath) {
  let current = path.resolve(startPath)
  const root = path.parse(current).root
  while (current !== root) {
    const apiDir = path.join(current, 'api')
    if (fs.existsSync(apiDir)) return current
    current = path.dirname(current)
  }
  throw new Error('Could not find project root containing /api directory.')
}

const ROOT_DIR = findProjectRoot(__dirname)
const API_DIR = path.join(ROOT_DIR, 'api')

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
    if (this.apiProcess && !this.apiProcess.killed) {
      return { success: true, message: 'Server already running' }
    }

    if (!fs.existsSync(API_DIR)) {
      return { success: false, error: `API directory not found: ${API_DIR}` }
    }

    const port = Number(options.port || process.env.PORT || 4000)
    const dbFile = options.dbFile || process.env.DB_FILE
    const env = {
      ...process.env,
      PORT: String(port),
      DB_FILE: dbFile || '',
      DB_CLIENT: 'sqlite3',
    }
    if (dbFile) fs.mkdirSync(path.dirname(dbFile), { recursive: true })
    const shouldSeed = !!dbFile && !fs.existsSync(dbFile)

    try {
      execSync('npm run migrate', { cwd: API_DIR, env, stdio: 'inherit' })
      if (shouldSeed) {
        execSync('npm run seed', { cwd: API_DIR, env, stdio: 'inherit' })
      }
    } catch (error) {
      return { success: false, error: `Failed to run migrations: ${error.message}` }
    }

    const command = process.env.NODE_ENV === 'production' ? ['run', 'start'] : ['run', 'dev']
    this.apiProcess = spawn('npm', command, {
      shell: true,
      cwd: API_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

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

  async checkApiHealth(apiRoot = 'http://localhost:4000') {
    try {
      const res = await fetch(`${apiRoot.replace(/\/+$/, '')}/health`)
      const data = await res.json()
      return { success: true, healthy: data.ok === true }
    } catch (error) {
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