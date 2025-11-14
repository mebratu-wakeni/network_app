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
  getServerLogs: (service, lines) => ipcRenderer.invoke('server:logs', service, lines),
  checkDevServerStatus: () => ipcRenderer.invoke('server:check-dev-status'),

  // Note: For user management and other APIs, use invoke() directly:
  // window.ipcRenderer.invoke('users:search', searchParams, token)
  // window.ipcRenderer.invoke('users:get-by-id', userId, token)
  // etc.
})
