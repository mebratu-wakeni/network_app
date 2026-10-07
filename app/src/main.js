import './style.css'

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app')
  if (!app) return

  const log = (step, msg) => {
    console.log(`[boot] ${step}: ${msg}`)
  }

  // Branded loading: show PharmaSuit name + spinner while loading
  app.innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;background:#f9fafb;font-family:Inter,Arial,sans-serif;" role="status" aria-live="polite" aria-busy="true">
      <div style="color:#4338ca;font-size:1.5rem;font-weight:700;">PharmaSuit</div>
      <div style="width:1.5rem;height:1.5rem;border:2px solid #e0e7ff;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="color:#6b7280;font-size:0.875rem;">Preparing...</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `

  try {
    log(1, 'loading ionicons')
    const ioniconsUrl = `${window.location.origin}/ionicons/ionicons/ionicons.esm.js`
    await import(/* @vite-ignore */ ioniconsUrl)
    log(2, 'ionicons loaded')

    log(3, 'loading App')
    const { App } = await import('./App.js')
    const appRoot = App()
    log(4, 'App built')

    app.replaceChildren(appRoot)
    log(5, 'render complete')
  } catch (err) {
    console.error('[boot] failed:', err)
    app.innerHTML = '<div style="padding:16px;color:#b91c1c;font-family:Inter,Arial,sans-serif;" role="alert">Failed to load. Check dev console.</div>'
  }
})
