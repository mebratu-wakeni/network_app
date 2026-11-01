const { Row } = Liteframe
import { Button } from '../utils/Button.js'

const UPDATE_STATE_KEY = 'app-update-state'
let updateListenerBound = false

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
 * Not a StatefulRow — must stay a plain Row under App's StatefulRow.
 * App already remorphs on `app-update-state`.
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

  return renderUpdateChrome({ viewModel: vm })
}

function renderUpdateChrome(props) {
  const state = props.viewModel.getState(UPDATE_STATE_KEY) || defaultUpdateState()
  const status = state.status
  const parts = []

  if (status === 'available') {
    parts.push(UpdateAvailableBanner(props, state))
  } else if (status === 'downloading' || status === 'downloaded' || status === 'error') {
    parts.push(UpdateWizardModal(props, state))
  }

  if (parts.length === 0) return HiddenUpdateHost()
  return Row({ class: 'contents' }, parts)
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
      await window.ipcRenderer.installUpdate()
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
