import './style.css'
import { App } from './App.js'

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app')
  app.appendChild(App())
}
)
// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
