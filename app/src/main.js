import './style.css'
import { defineCustomElements as defineIonicons } from 'ionicons/loader';

// Ionicons resourcesUrl configuration
// Solution: Copy ionicons/dist/* to public/ionicons/ so it's accessible in both dev and production
// In development: Vite serves public folder at root (/ionicons/)
// In production: Electron serves public folder, so /ionicons/ works
// This avoids the node_modules path issue in production builds
// Note: After installing/updating ionicons, run: cp -r node_modules/ionicons/dist/* public/ionicons/
const IONICONS_RESOURCES_URL = '/ionicons/';

import { App } from './App.js'

function renderBootProgress(root, percent, label) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0))
  root.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
      <div style="width:min(420px,86vw);font-family:Inter,Arial,sans-serif;color:#111827;">
        <div style="font-size:20px;font-weight:700;margin-bottom:8px;">MaSaTech</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">${label}</div>
        <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${safePercent}%;background:#4f46e5;transition:width 180ms ease;"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:8px;">${safePercent}%</div>
      </div>
    </div>
  `
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded');
  const app = document.getElementById('app')
  if (!app) return
  const bootStartedAt = Date.now()
  const minimumBootMs = 700

  try {
    renderBootProgress(app, 15, 'Initializing...')
    await Promise.resolve()

    renderBootProgress(app, 45, 'Registering icons...')
    await defineIonicons(window, {
      resourcesUrl: IONICONS_RESOURCES_URL
    })

    renderBootProgress(app, 75, 'Loading application...')
    const appRoot = App()

    renderBootProgress(app, 95, 'Rendering UI...')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const elapsedMs = Date.now() - bootStartedAt
    if (elapsedMs < minimumBootMs) {
      await new Promise((resolve) => setTimeout(resolve, minimumBootMs - elapsedMs))
    }

    app.replaceChildren(appRoot)
  } catch (err) {
    console.error('app bootstrap failed:', err)
    app.innerHTML = '<div style="padding:16px;color:#b91c1c;font-family:Arial,sans-serif;">Failed to load application. Check console for details.</div>'
  }
})
// // Use contextBridge
// window.ipcRenderer.on('main-process-message', (_event, message) => {
//   console.log(message)
// })
