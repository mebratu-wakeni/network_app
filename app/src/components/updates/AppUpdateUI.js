const { Row, StatefulRow } = Liteframe
import { Button } from '../utils/Button.js'

const UPDATE_STATE_KEY = 'app-update-state'
const UPDATE_DEV_PANEL_KEY = 'app-update-dev-panel'
let updateListenerBound = false
let devPanelProbeStarted = false

function defaultUpdateState() {
  return {
    status: 'idle',
    version: null,
    releaseNotes: '',
    mandatory: false,
    percent: 0,
    error: null,
    currentVersion: null,
    simulated: false,
    manualDownloadUrl: null
  }
}

/** Idle placeholder — Liteframe warns if a StatefulRow render returns null. */
function HiddenUpdateHost() {
  return Row({
    class: 'hidden',
    attributes: { 'aria-hidden': 'true', 'data-app-update': 'idle' }
  })
}

/**
 * In-app update notification + wizard for cloud builds (Dedicated / Managed).
 *
 * Shared-state lifecycle (Liteframe):
 * - NavigationVM.setState('app-update-state', defaults) once at boot
 * - later changes only via updateState('app-update-state', next)
 */
export default function AppUpdateUI(props) {
  const vm = props.viewModel
  if (!vm) return HiddenUpdateHost()

  if (!updateListenerBound && typeof window !== 'undefined' && window.ipcRenderer?.onUpdateState) {
    updateListenerBound = true
    window.ipcRenderer.onUpdateState((state) => {
      vm.updateState(UPDATE_STATE_KEY, { ...defaultUpdateState(), ...(state || {}) })
    })
    window.ipcRenderer.getUpdateState?.().then((state) => {
      if (state) {
        vm.updateState(UPDATE_STATE_KEY, { ...defaultUpdateState(), ...state })
      }
    }).catch(() => {})
  }

  if (!devPanelProbeStarted && typeof window !== 'undefined' && window.ipcRenderer?.isPackaged) {
    devPanelProbeStarted = true
    window.ipcRenderer.isPackaged().then((packaged) => {
      const prev = vm.getState(UPDATE_DEV_PANEL_KEY) || { show: false, note: '' }
      vm.updateState(UPDATE_DEV_PANEL_KEY, {
        ...prev,
        show: packaged !== true
      })
    }).catch(() => {
      const prev = vm.getState(UPDATE_DEV_PANEL_KEY) || { show: false, note: '' }
      vm.updateState(UPDATE_DEV_PANEL_KEY, { ...prev, show: true })
    })
  }

  return StatefulRow(
    {
      id: 'AppUpdateUI',
      class: '',
      stateKeys: [UPDATE_STATE_KEY, UPDATE_DEV_PANEL_KEY],
      viewModel: vm
    },
    (p) => renderUpdateChrome(p)
  )
}

function renderUpdateChrome(props) {
  const state = props.viewModel.getState(UPDATE_STATE_KEY) || defaultUpdateState()
  const devPanel = props.viewModel.getState(UPDATE_DEV_PANEL_KEY) || { show: false, note: '' }
  const status = state.status
  const parts = []

  if (devPanel.show) {
    parts.push(DevUpdateTester(props, devPanel))
  }

  if (status === 'available') {
    parts.push(UpdateAvailableBanner(props, state))
  } else if (status === 'downloading' || status === 'downloaded' || status === 'error') {
    parts.push(UpdateWizardModal(props, state))
  }

  if (parts.length === 0) return HiddenUpdateHost()
  return Row({ class: 'contents' }, parts)
}

function DevUpdateTester(props, devPanel) {
  const onOptional = async () => {
    props.viewModel.updateState(UPDATE_DEV_PANEL_KEY, { ...devPanel, note: '' })
    await window.ipcRenderer.simulateUpdate({ mandatory: false })
  }
  const onRequired = async () => {
    props.viewModel.updateState(UPDATE_DEV_PANEL_KEY, { ...devPanel, note: '' })
    await window.ipcRenderer.simulateUpdate({ mandatory: true })
  }
  const onReset = async () => {
    await window.ipcRenderer.dismissUpdate()
    props.viewModel.updateState(UPDATE_DEV_PANEL_KEY, { ...devPanel, note: '' })
  }

  return Row({
    class: 'fixed bottom-3 right-3 z-[95] w-64 rounded-lg border border-amber-300 bg-amber-50 shadow-lg p-3 flex flex-col gap-2',
    attributes: { 'data-update-dev-panel': 'true' }
  }, [
    Row({ class: 'text-xs font-semibold text-amber-900' }, 'Updater test (dev only)'),
    Row({ class: 'text-[11px] text-amber-800 leading-snug' },
      'Walk the same UI users will see. No real installer is downloaded.'
    ),
    Button({ variant: 'primary', class: 'text-xs w-full', onClick: onOptional }, 'Simulate optional update'),
    Button({ variant: 'secondary', class: 'text-xs w-full', onClick: onRequired }, 'Simulate required update'),
    Button({ variant: 'outline', class: 'text-xs w-full', onClick: onReset }, 'Reset'),
    devPanel.note
      ? Row({ class: 'text-[11px] text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1' }, devPanel.note)
      : Row({ class: 'hidden', attributes: { 'aria-hidden': 'true' } })
  ])
}

function UpdateAvailableBanner(props, state) {
  const mandatory = !!state.mandatory
  const version = state.version || 'new'
  const manualOnly = !!state.manualDownloadUrl && !!state.error

  const onUpdate = async () => {
    try {
      if (manualOnly && window.ipcRenderer.openUpdateDownload) {
        await window.ipcRenderer.openUpdateDownload()
        return
      }
      await window.ipcRenderer.startUpdateDownload()
    } catch (_) {}
  }

  const onLater = async () => {
    if (mandatory) return
    try {
      await window.ipcRenderer.dismissUpdate()
    } catch (_) {}
  }

  const actions = [
    Button({
      variant: 'primary',
      class: 'text-sm',
      onClick: onUpdate
    }, manualOnly ? 'Download installer' : 'Update now')
  ]
  if (!mandatory) {
    actions.unshift(
      Button({
        variant: 'secondary',
        class: 'text-sm',
        onClick: onLater
      }, 'Later')
    )
  }

  const copy = [
    Row({ class: 'text-sm font-semibold text-indigo-950' },
      mandatory ? `Required update: PharmaSuit ${version}` : `Update available: PharmaSuit ${version}`
    )
  ]
  if (state.currentVersion) {
    copy.push(Row({ class: 'text-xs text-gray-500 mt-0.5' }, `Installed: ${state.currentVersion}`))
  }
  if (state.releaseNotes) {
    copy.push(Row({ class: 'text-xs text-gray-600 mt-0.5 truncate' }, String(state.releaseNotes)))
  }
  if (manualOnly) {
    copy.push(Row({ class: 'text-xs text-amber-700 mt-1' },
      'Automatic in-app install is unavailable on this build — download the installer and replace the app.'))
  } else if (mandatory) {
    copy.push(Row({ class: 'text-xs text-amber-700 mt-1' }, 'This update is required to continue using PharmaSuit safely.'))
  }

  return Row({
    class: 'fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-[min(40rem,calc(100%-1.5rem))] rounded-lg border border-indigo-200 bg-white shadow-lg px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
    attributes: { role: 'status', 'aria-live': 'polite' }
  }, [
    Row({ class: 'min-w-0' }, copy),
    Row({ class: 'flex items-center gap-2 shrink-0' }, actions)
  ])
}

function UpdateWizardModal(props, state) {
  const mandatory = !!state.mandatory
  const status = state.status
  const percent = Math.max(0, Math.min(100, Number(state.percent) || 0))
  const version = state.version || ''

  const title =
    status === 'downloaded'
      ? 'Update ready'
      : status === 'error'
        ? 'Update failed'
        : 'Updating PharmaSuit'

  const detail =
    status === 'downloaded'
      ? `Version ${version} is downloaded. Restart to finish installing.`
      : status === 'error'
        ? (state.error || 'Something went wrong while updating.')
        : `Downloading${version ? ` version ${version}` : ''}…`

  const onInstall = async () => {
    try {
      const res = await window.ipcRenderer.installUpdate()
      if (res?.simulated) {
        const panel = props.viewModel.getState(UPDATE_DEV_PANEL_KEY) || { show: true, note: '' }
        props.viewModel.updateState(UPDATE_DEV_PANEL_KEY, {
          ...panel,
          note: res.message || 'Simulated install finished (dev only).'
        })
      }
    } catch (_) {}
  }

  const onRetry = async () => {
    try {
      await window.ipcRenderer.startUpdateDownload()
    } catch (_) {}
  }

  const onClose = async () => {
    if (mandatory && status !== 'error') return
    try {
      await window.ipcRenderer.dismissUpdate()
    } catch (_) {}
  }

  const body = [
    Row({ id: 'update-wizard-title', class: 'text-lg font-semibold text-gray-900' }, title),
    Row({ class: 'text-sm text-gray-600' }, detail)
  ]

  if (status === 'downloading') {
    body.push(
      Row({ class: 'flex flex-col gap-1.5' }, [
        Row({ class: 'h-2 w-full rounded-full bg-gray-100 overflow-hidden' }, [
          Row({
            class: 'h-full bg-indigo-600 transition-all duration-200',
            attributes: { style: `width:${percent}%` }
          })
        ]),
        Row({ class: 'text-xs text-gray-500 text-right' }, `${percent}%`)
      ])
    )
  }

  const actions = []
  if (status === 'error') {
    actions.push(Button({ variant: 'secondary', onClick: onClose }, mandatory ? 'Close' : 'Dismiss'))
    actions.push(Button({ variant: 'primary', onClick: onRetry }, 'Retry'))
  }
  if (status === 'downloaded') {
    if (!mandatory) actions.push(Button({ variant: 'secondary', onClick: onClose }, 'Later'))
    actions.push(Button({ variant: 'primary', onClick: onInstall }, 'Restart now'))
  }
  if (status === 'downloading' && !mandatory) {
    actions.push(Button({ variant: 'secondary', onClick: onClose }, 'Hide'))
  }
  body.push(Row({ class: 'flex justify-end gap-2 pt-1' }, actions))

  return Row({
    class: 'fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4',
    attributes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'update-wizard-title' }
  }, [
    Row({ class: 'w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-5 flex flex-col gap-4' }, body)
  ])
}
