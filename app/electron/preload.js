import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Convenience methods for server management (kept for consistency)
  checkDocker: () => ipcRenderer.invoke('server:check-docker'),
  startServer: (mode) => ipcRenderer.invoke('server:start', mode),
  stopServer: (mode) => ipcRenderer.invoke('server:stop', mode),
  getServerStatus: () => ipcRenderer.invoke('server:status'),
  checkServerHealth: () => ipcRenderer.invoke('server:health'),
  getConnectionInfo: () => ipcRenderer.invoke('server:connection-info'),
  getServerLogs: (service, lines) => ipcRenderer.invoke('server:logs', service, lines),
  checkDevServerStatus: () => ipcRenderer.invoke('server:check-dev-status'),

  // Managed / Dedicated cloud in-app updates (electron-updater)
  getUpdateState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),
  simulateUpdate: (payload) => ipcRenderer.invoke('updater:simulate', payload),
  startUpdateDownload: () => ipcRenderer.invoke('updater:start-download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  dismissUpdate: () => ipcRenderer.invoke('updater:dismiss'),
  openUpdateDownload: () => ipcRenderer.invoke('updater:open-download'),
  isPackaged: () => ipcRenderer.invoke('app:is-packaged'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  onUpdateState: (listener) => {
    const wrapped = (_event, state) => listener(state)
    ipcRenderer.on('updater:state', wrapped)
    return () => ipcRenderer.off('updater:state', wrapped)
  },

  // Note: For user management and other APIs, use invoke() directly:
  // window.ipcRenderer.invoke('users:search', searchParams, token)
  // window.ipcRenderer.invoke('users:get-by-id', userId, token)
  // etc.
})
