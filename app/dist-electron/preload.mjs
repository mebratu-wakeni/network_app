"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  checkDocker: () => electron.ipcRenderer.invoke("server:check-docker"),
  startServer: (mode) => electron.ipcRenderer.invoke("server:start", mode),
  stopServer: (mode) => electron.ipcRenderer.invoke("server:stop", mode),
  getServerStatus: () => electron.ipcRenderer.invoke("server:status"),
  checkServerHealth: () => electron.ipcRenderer.invoke("server:health"),
  getServerLogs: (service, lines) => electron.ipcRenderer.invoke("server:logs", service, lines),
  checkDevServerStatus: () => electron.ipcRenderer.invoke("server:check-dev-status")
  // You can expose other APTs you need here.
  // ...
});
