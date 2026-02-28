import './style.css'

const BOOT_STEP_ORDER = [
  'local-init',
  'resolve-config',
  'register-icons',
  'start-api',
  'wait-api-health',
  'validate-license',
  'load-modules',
  'build-app',
  'render-ui',
  'init-complete',
]

const BOOT_STEP_LABELS = {
  'local-init': 'Preparing renderer',
  'resolve-config': 'Resolving runtime configuration',
  'register-icons': 'Registering icons',
  'start-api': 'Starting local API server',
  'wait-api-health': 'Waiting for API health check',
  'validate-license': 'Validating license state',
  'load-modules': 'Loading modules',
  'build-app': 'Building app layout',
  'render-ui': 'Rendering UI',
  'init-complete': 'Initialization complete',
}

function renderBootProgress(root, percent, label, stepStatus) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0))
  const progressList = BOOT_STEP_ORDER
    .map((step) => {
      const status = stepStatus[step] || 'pending'
      const marker = status === 'done' ? '✓' : status === 'running' ? '•' : '○'
      const color = status === 'done' ? '#059669' : status === 'running' ? '#4f46e5' : '#9ca3af'
      return `<li style="display:flex;align-items:center;gap:8px;margin-bottom:4px;color:${color};font-size:12px;">
        <span style="width:12px;text-align:center;font-weight:700;">${marker}</span>
        <span>${BOOT_STEP_LABELS[step]}</span>
      </li>`
    })
    .join('')

  root.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
      <div style="width:min(420px,86vw);font-family:Inter,Arial,sans-serif;color:#111827;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#4f46e5;">
          <ion-icon name="medical-outline" style="font-size:24px;"></ion-icon>
          <span style="font-size:12px;font-weight:600;letter-spacing:0.02em;">Ionicon bootstrap check</span>
        </div>
        <div style="font-size:20px;font-weight:700;margin-bottom:8px;">MaSaTech</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">${label}</div>
        <div style="height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${safePercent}%;background:#4f46e5;transition:width 180ms ease;"></div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:8px;">${safePercent}%</div>
        <ul style="list-style:none;padding:0;margin:12px 0 0 0;max-height:180px;overflow:auto;">
          ${progressList}
        </ul>
      </div>
    </div>
  `
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  if (!app) return

  const bootStartedAt = Date.now()
  const minimumBootMs = 700
  let bootLabel = 'Initializing...'
  let bootPercent = 15
  const bootStepStatus = BOOT_STEP_ORDER.reduce((acc, step) => {
    acc[step] = 'pending'
    return acc
  }, {})

  const setBootStage = (step, percent, label) => {
    if (step && bootStepStatus[step] !== 'done') {
      for (const key of BOOT_STEP_ORDER) {
        if (bootStepStatus[key] === 'running' && key !== step) {
          bootStepStatus[key] = 'done'
        }
      }
      bootStepStatus[step] = 'running'
    }
    bootPercent = Math.max(0, Math.min(100, Number(percent) || bootPercent))
    if (label) bootLabel = label
    renderBootProgress(app, bootPercent, bootLabel, bootStepStatus)
  }

  if (window?.ipcRenderer?.on) {
    window.ipcRenderer.on('main-process-message', (_event, message) => {
      if (!message || typeof message !== 'object') return
      if (message.type !== 'boot-progress') return
      const percent = Number(message.percent)
      const label = typeof message.label === 'string' ? message.label : ''
      const step = typeof message.step === 'string' ? message.step : ''
      // Keep monotonic progress in UI to avoid bouncing backwards.
      if (!Number.isNaN(percent) && percent >= bootPercent) {
        setBootStage(step, percent, label)
      } else if (label) {
        setBootStage(step, bootPercent, label)
      }
    })
  }

  try {
    setBootStage('local-init', 15, 'Initializing...')
    await Promise.resolve()

    setBootStage('register-icons', 45, 'Registering icons...')
    // Load the self-registering Ionicons ESM bundle from its natural location.
    // @vite-ignore prevents Vite from bundling it — it must load as its own module
    // so import.meta.url inside ionicons.esm.js resolves correctly for SVG fetches.
    // Using window.location.origin makes this work in both dev (http://) and
    // packaged app (app://) without any manual resourcesUrl configuration.
    const ioniconsUrl = `${window.location.origin}/ionicons/ionicons/ionicons.esm.js`
    await import(/* @vite-ignore */ ioniconsUrl)

    setBootStage('load-modules', 70, 'Loading modules...')
    const { App } = await import('./App.js')

    setBootStage('build-app', 85, 'Loading application...')
    const appRoot = App()

    setBootStage('render-ui', 95, 'Rendering UI...')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const elapsedMs = Date.now() - bootStartedAt
    if (elapsedMs < minimumBootMs) {
      await new Promise((resolve) => setTimeout(resolve, minimumBootMs - elapsedMs))
    }

    bootStepStatus['render-ui'] = 'done'
    bootStepStatus['init-complete'] = 'done'
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
