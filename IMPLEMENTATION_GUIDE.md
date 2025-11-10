# Implementation Guide: Electron Server App

## Overview

This guide walks through implementing an Electron app that manages your Express API server and PostgreSQL database using Docker, and provides an admin dashboard.

## Architecture

```
Electron App (Main Process)
  ├─ Service Manager (manages Docker services)
  ├─ IPC Handlers (communication with renderer)
  └─ Network Detection (LAN IP detection)

Electron App (Renderer Process)
  └─ Admin Dashboard (React/Vue UI)
      ├─ Service Status
      ├─ User Management
      ├─ System Monitoring
      └─ Settings
```

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd app
npm install --save axios
npm install --save-dev @types/node
```

### Step 2: Create Service Manager

**File: `app/electron/services/ServerManager.js`**

```javascript
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../../..')

class ServerManager {
  constructor() {
    this.composeFile = path.join(ROOT_DIR, 'docker-compose.yml')
    this.isRunning = false
  }

  /**
   * Check if Docker is installed and running
   */
  async checkDocker() {
    try {
      await execAsync('docker --version')
      await execAsync('docker ps')
      return { installed: true, running: true }
    } catch (error) {
      if (error.message.includes('docker: command not found')) {
        return { installed: false, running: false, error: 'Docker not installed' }
      }
      return { installed: true, running: false, error: 'Docker not running' }
    }
  }

  /**
   * Start Docker services
   */
  async startServices() {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFile}" up -d`,
        { cwd: ROOT_DIR }
      )
      
      if (stderr && !stderr.includes('Creating')) {
        throw new Error(stderr)
      }
      
      this.isRunning = true
      return { success: true, message: 'Services started successfully' }
    } catch (error) {
      this.isRunning = false
      return { success: false, error: error.message }
    }
  }

  /**
   * Stop Docker services
   */
  async stopServices() {
    try {
      const { stdout, stderr } = await execAsync(
        `docker compose -f "${this.composeFile}" down`,
        { cwd: ROOT_DIR }
      )
      
      this.isRunning = false
      return { success: true, message: 'Services stopped successfully' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      const { stdout } = await execAsync(
        `docker compose -f "${this.composeFile}" ps --format json`,
        { cwd: ROOT_DIR }
      )
      
      const services = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
      
      return {
        success: true,
        services: services.map(svc => ({
          name: svc.Name,
          status: svc.State,
          health: svc.Health || 'unknown'
        }))
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Check API health
   */
  async checkApiHealth() {
    try {
      const response = await fetch('http://localhost:4000/health')
      const data = await response.json()
      return { success: true, healthy: data.ok === true }
    } catch (error) {
      return { success: false, healthy: false, error: error.message }
    }
  }

  /**
   * Get service logs
   */
  async getLogs(service = 'backend', lines = 100) {
    try {
      const { stdout } = await execAsync(
        `docker compose -f "${this.composeFile}" logs --tail=${lines} ${service}`,
        { cwd: ROOT_DIR }
      )
      return { success: true, logs: stdout }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

export default ServerManager
```

### Step 3: Update Electron Main Process

**File: `app/electron/main.js`**

```javascript
import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ServerManager from './services/ServerManager.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL 
  ? path.join(process.env.APP_ROOT, 'public') 
  : RENDERER_DIST

let win
const serverManager = new ServerManager()

const iconPath = path.join(__dirname, '..', 'public', 'masatech-logo.png')
const iconImage = nativeImage.createFromPath(iconPath)
app.dock.setIcon(iconImage)

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }
}

// IPC Handlers for service management
ipcMain.handle('server:check-docker', async () => {
  return await serverManager.checkDocker()
})

ipcMain.handle('server:start', async () => {
  return await serverManager.startServices()
})

ipcMain.handle('server:stop', async () => {
  return await serverManager.stopServices()
})

ipcMain.handle('server:status', async () => {
  return await serverManager.getServiceStatus()
})

ipcMain.handle('server:health', async () => {
  return await serverManager.checkApiHealth()
})

ipcMain.handle('server:logs', async (event, service, lines) => {
  return await serverManager.getLogs(service, lines)
})

// Handle app lifecycle
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  // Optionally stop services when app quits
  // await serverManager.stopServices()
})

app.whenReady().then(createWindow)
```

### Step 4: Update Preload Script

**File: `app/electron/preload.js`**

```javascript
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process
// to use the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Server management
  checkDocker: () => ipcRenderer.invoke('server:check-docker'),
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  getServerStatus: () => ipcRenderer.invoke('server:status'),
  checkServerHealth: () => ipcRenderer.invoke('server:health'),
  getServerLogs: (service, lines) => ipcRenderer.invoke('server:logs', service, lines),
})
```

### Step 5: Create Admin Dashboard Component

**File: `app/src/components/ServerManager.jsx`**

```javascript
import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:4000/api'

export default function ServerManager() {
  const [dockerStatus, setDockerStatus] = useState(null)
  const [serverStatus, setServerStatus] = useState(null)
  const [apiHealth, setApiHealth] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const checkStatus = async () => {
    // Check Docker
    const docker = await window.electronAPI.checkDocker()
    setDockerStatus(docker)

    // Check server status
    const status = await window.electronAPI.getServerStatus()
    setServerStatus(status)

    // Check API health
    const health = await window.electronAPI.checkServerHealth()
    setApiHealth(health)
  }

  const handleStart = async () => {
    setLoading(true)
    const result = await window.electronAPI.startServer()
    if (result.success) {
      setTimeout(checkStatus, 2000) // Wait 2 seconds then check status
    }
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    const result = await window.electronAPI.stopServer()
    if (result.success) {
      setTimeout(checkStatus, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Server Management</h1>

      {/* Docker Status */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Docker Status</h2>
        {dockerStatus ? (
          <div>
            <p>Installed: {dockerStatus.installed ? '✅ Yes' : '❌ No'}</p>
            <p>Running: {dockerStatus.running ? '✅ Yes' : '❌ No'}</p>
            {dockerStatus.error && (
              <p className="text-red-600">Error: {dockerStatus.error}</p>
            )}
          </div>
        ) : (
          <p>Checking...</p>
        )}
      </div>

      {/* Server Status */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Server Status</h2>
        {serverStatus?.services?.map(service => (
          <div key={service.name} className="mb-2">
            <p>
              {service.name}:{' '}
              <span className={service.status === 'running' ? 'text-green-600' : 'text-red-600'}>
                {service.status}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* API Health */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">API Health</h2>
        <p>
          Status:{' '}
          {apiHealth?.healthy ? (
            <span className="text-green-600">✅ Healthy</span>
          ) : (
            <span className="text-red-600">❌ Unhealthy</span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Start Server
        </button>
        <button
          onClick={handleStop}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Stop Server
        </button>
        <button
          onClick={checkStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Refresh Status
        </button>
      </div>
    </div>
  )
}
```

### Step 6: Update App.js

**File: `app/src/App.js`**

```javascript
import ServerManager from './components/ServerManager'
import './style.css'

function App() {
  return (
    <div className="App">
      <ServerManager />
    </div>
  )
}

export default App
```

## Testing

1. **Start Electron app:**
   ```bash
   cd app
   npm run dev
   ```

2. **Test service management:**
   - Click "Start Server" - should start Docker services
   - Check status - should show services as "running"
   - Check API health - should show "Healthy"
   - Click "Stop Server" - should stop services

3. **Test API access:**
   ```bash
   curl http://localhost:4000/health
   ```

## Next Steps

1. **Add network detection** - Show LAN IP for clients
2. **Add user management UI** - Integrate with your user APIs
3. **Add log viewing** - Display service logs in dashboard
4. **Add error handling** - Better error messages and recovery
5. **Add auto-start** - Option to auto-start services on app launch
6. **Add notifications** - Notify when services start/stop

## Troubleshooting

### Docker not found
- Install Docker Desktop
- Make sure Docker is running
- Check PATH includes Docker

### Services won't start
- Check Docker Compose file path
- Check Docker daemon is running
- Check ports 4000 and 5433 are available

### API health check fails
- Wait a few seconds after starting services
- Check API server logs
- Verify API is accessible at localhost:4000

