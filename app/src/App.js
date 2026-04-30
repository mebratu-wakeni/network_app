const { Row, Router,  StatefulRow } = Liteframe;
import NavigationUI from "./components/navigation/NavigationUI.js";
import ServerManagerUI from "./components/serverManager/ServerManagerUI.js";
import HeaderUI from "./components/header/HeaderUI.js";
import FooterUI from "./components/footer/FooterUI.js";
import NavigationVM, { navigationVM } from "./components/navigation/NavigationVM.js";
import { Input } from './components/utils/Input.js';
import { Button } from './components/utils/Button.js';

/** Shared indigo spinner for boot screens (gray/white backgrounds) */
function BootSpinner(props = {}) {
  const cls = props.class || 'h-6 w-6 text-indigo-600'
  return Row({ tagType: 'svg', attributes: { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, class: `animate-spin ${cls}` }, [
    Row({ tagType: 'circle', attributes: { cx: '12', cy: '12', r: '10', stroke: 'currentColor', 'stroke-width': '4', class: 'opacity-25' } }),
    Row({ tagType: 'path', attributes: { fill: 'currentColor', d: 'M4 12a8 8 0 018-8v8z', class: 'opacity-75' } })
  ])
}

export function App() {
  const main = Row({ tagType: 'div', class: 'relative h-full min-h-0 flex flex-col' });

  const router = new Router(main);

  const render = (props) => {
    const setupLoading = props.viewModel.getState('setup-loading')
    const setupConfig = props.viewModel.getState('setup-config')
    const startupMode = props.viewModel.getState('startup-mode')
    const setupDone = !!setupConfig?.setupCompleted && setupConfig?.mode === startupMode
    const licenseRequired = startupMode === 'server' && setupConfig?.licenseRequired === true
    const clientNeedsConnection = startupMode === 'client' && setupConfig?.clientConnected !== true
    if (setupLoading) {
      return Row({ class: 'h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-gray-50', attributes: { 'aria-busy': 'true', 'aria-live': 'polite' } }, [
        Row({ tagType: 'div', class: 'text-xl font-bold text-indigo-700' }, 'PharmaSuit'),
        BootSpinner({ class: 'h-8 w-8 text-indigo-600' }),
        Row({ tagType: 'div', class: 'text-sm text-gray-500' }, 'Preparing PharmaSuit…')
      ])
    }
    if (!startupMode) return StartupModeLayout(props)
    if (!setupDone) return SetupLayout(props, { forcedMode: startupMode })
    if (licenseRequired) return LicenseRequiredLayout(props)
    if (clientNeedsConnection) return ClientConnectionLayout(props)

    const auth = props.viewModel.getState('auth') || { isAuthenticated: false };
    if (!auth.isAuthenticated) return LoginLayout(props);

    return MainLayout(props, main, router);
  };

  return StatefulRow({id: 'App', class: 'h-[100dvh] min-h-0 overflow-hidden', stateKeys: ['loading', 'active-menu', 'pending-sales-open', 'pending-purchase-open', 'setup-loading', 'startup-mode', 'setup-config', 'setup-defaults', 'setup-error', 'startup-error', 'startup-error-details-open', 'startup-progress', 'startup-progress-percent', 'startup-selected-mode', 'startup-loading-expanded', 'auth'], viewModel: navigationVM }, render);
  
}

function StartupModeLayout(props) {
  const loading = props.viewModel.getState('setup-loading')
  const startupError = props.viewModel.getState('startup-error')
  const startupProgress = props.viewModel.getState('startup-progress')
  const startupPercent = props.viewModel.getState('startup-progress-percent') ?? 0
  const selectedMode = props.viewModel.getState('startup-selected-mode')
  const loadingExpanded = props.viewModel.getState('startup-loading-expanded')
  const lastMode = props.viewModel.getLastUsedMode()

  const chooseMode = async (mode) => {
    if (loading) return
    await props.viewModel.chooseStartupMode(mode)
  }

  const onCancel = async () => {
    try {
      await window.ipcRenderer.invoke('app:quit')
    } catch (_) {}
  }

  // ── Loading state: server/client starting (IPC in-flight) ──────────────────
  if (loading) {
    const label = startupProgress || 'Starting up...'
    const isClient = selectedMode === 'client'
    const showCompact = isClient && !loadingExpanded

    // Compact loading (client, first ~400ms): minimal overlay so it feels fast
    if (showCompact) {
      return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2', attributes: { 'aria-busy': 'true', 'aria-live': 'polite' } }, [
        Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
          Row({ class: 'px-8 py-6 flex items-center gap-3' }, [
            BootSpinner({ class: 'h-5 w-5 text-indigo-600 shrink-0' }),
            Row({ class: 'text-sm text-gray-600' }, 'Connecting…')
          ])
        ])
      ])
    }

    // Full loading: progress bar, expectations, accessible
    return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2', attributes: { 'aria-busy': 'true', 'aria-live': 'polite' } }, [
      Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
        Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
          Row({ class: 'flex items-center gap-2 mb-2 text-indigo-700' }, [
            Row({ tagType: 'ion-icon', attributes: { name: 'rocket-outline' }, class: 'text-2xl' }),
            Row({ tagType: 'h1', class: 'text-2xl font-bold' }, isClient ? 'Connecting…' : 'Starting…')
          ]),
          Row({ class: 'text-sm text-gray-500 mb-2', attributes: { 'aria-live': 'polite' } }, label),
          isClient ? null : Row({ class: 'text-xs text-gray-400' }, 'This may take a few moments on first run.'),
          Row({ class: 'mt-2 w-full h-2 bg-gray-100 rounded overflow-hidden' }, [
            Row({ class: 'h-2 bg-indigo-600 rounded', attributes: { style: `width:${startupPercent}%`, role: 'progressbar', 'aria-valuenow': startupPercent, 'aria-valuemin': 0, 'aria-valuemax': 100 } })
          ])
        ]),
        Row({ class: 'px-8 py-8 flex flex-col items-center gap-4' }, [
          Row({ tagType: 'div', class: 'flex items-center gap-3' }, [
            BootSpinner({ class: 'h-6 w-6 text-indigo-600' }),
            Row({ class: 'text-sm text-gray-600' }, label)
          ])
        ])
      ])
    ])
  }

  // ── Error state: startup:select-mode returned success:false ────────────────
  if (startupError) {
    const detailsOpen = props.viewModel.getState('startup-error-details-open') === true
    const toggleDetails = () => props.viewModel.updateState('startup-error-details-open', !detailsOpen)
    const errorMode = startupError.mode === 'client' ? 'Client' : 'Server'
    const codeLabels = {
      SERVER_START_FAILED: 'The server could not start. This is often caused by port conflicts or missing dependencies.',
      API_NOT_READY: 'The server started but did not respond in time. It may still be initializing, or something is blocking it.',
      LICENSE_REQUIRED: 'License validation is required before you can continue.',
      EXCEPTION: 'Something went wrong. You can retry or choose a different mode.',
    }
    const primaryMessage = codeLabels[startupError.code] || 'Something went wrong. You can retry or choose a different mode.'
    const techDetail = startupError.message || ''
    return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2', attributes: { role: 'alert' } }, [
      Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
        Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
          Row({ class: 'flex items-center gap-2 mb-2 text-red-600' }, [
            Row({ tagType: 'ion-icon', attributes: { name: 'alert-circle-outline' }, class: 'text-2xl' }),
            Row({ tagType: 'h1', class: 'text-2xl font-bold' }, `${errorMode} Mode Failed`)
          ]),
          Row({ class: 'text-sm text-gray-600' }, 'Could not start in the selected mode.')
        ]),
        Row({ class: 'px-8 py-6 flex flex-col gap-3' }, [
          Row({ class: 'text-sm text-gray-800 font-medium' }, primaryMessage),
          techDetail ? Row({ class: 'flex flex-col gap-1' }, [
            Row({
              tagType: 'button',
              class: 'text-xs text-indigo-600 hover:text-indigo-700 text-left',
              events: { click: toggleDetails }
            }, detailsOpen ? 'Hide technical details' : 'Show technical details'),
            detailsOpen ? Row({ class: 'text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 break-all' }, techDetail) : null
          ]) : null,
          Row({ class: 'text-xs text-gray-500' }, 'You can retry or switch to a different mode.')
        ]),
        Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-2' }, [
          Button({ variant: 'outline', onClick: onCancel }, 'Exit'),
          Row({ class: 'flex gap-2' }, [
            Button({
              variant: 'outline',
              onClick: () => props.viewModel.updateState('startup-error', null)
            }, 'Change Mode'),
            Button({
              variant: 'primary',
              onClick: () => props.viewModel.retryStartupMode()
            }, 'Retry')
          ])
        ])
      ])
    ])
  }

  // ── Normal mode-selection dialog ───────────────────────────────────────────
  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2' }, [
    Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
      Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
        Row({ class: 'flex items-center gap-2 mb-1 text-indigo-700' }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'rocket-outline' }, class: 'text-2xl' }),
          Row({ tagType: 'h1', class: 'text-2xl font-bold' }, 'PharmaSuit')
        ]),
        Row({ class: 'text-sm font-medium text-gray-700 mb-1' }, 'Choose Runtime Mode'),
        Row({ class: 'text-sm text-gray-600' }, 'Select how to run this session. You can choose again after logout.')
      ]),
      Row({ class: 'px-8 py-6 flex flex-col gap-4' }, [
        Row({ class: `rounded-xl border-2 p-4 cursor-pointer transition-colors ${lastMode === 'server' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`, events: { click: () => chooseMode('server') } }, [
          Row({ class: 'flex items-center gap-3 mb-1' }, [
            Row({ tagType: 'ion-icon', attributes: { name: 'server-outline' }, class: `text-xl ${lastMode === 'server' ? 'text-indigo-600' : 'text-gray-500'}` }),
            Row({ tagType: 'span', class: `font-semibold ${lastMode === 'server' ? 'text-indigo-700' : 'text-gray-800'}` }, [
              'Server',
              lastMode === 'server' ? Row({ tagType: 'span', class: 'ml-2 text-xs font-normal text-indigo-500' }, '(last used)') : null
            ])
          ]),
          Row({ class: 'text-sm text-gray-500 ml-8' }, 'Run this computer as the main server. Hosts the local API and database. License is validated before login.')
        ]),
        Row({ class: `rounded-xl border-2 p-4 cursor-pointer transition-colors ${lastMode === 'client' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`, events: { click: () => chooseMode('client') } }, [
          Row({ class: 'flex items-center gap-3 mb-1' }, [
            Row({ tagType: 'ion-icon', attributes: { name: 'cloud-upload-outline' }, class: `text-xl ${lastMode === 'client' ? 'text-indigo-600' : 'text-gray-500'}` }),
            Row({ tagType: 'span', class: `font-semibold ${lastMode === 'client' ? 'text-indigo-700' : 'text-gray-800'}` }, [
              'Client',
              lastMode === 'client' ? Row({ tagType: 'span', class: 'ml-2 text-xs font-normal text-indigo-500' }, '(last used)') : null
            ])
          ]),
          Row({ class: 'text-sm text-gray-500 ml-8' }, 'Connect to an existing server. You will provide the server URL.')
        ])
      ]),
      Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-2' }, [
        Button({ variant: 'outline', onClick: onCancel }, 'Exit')
      ])
    ])
  ])
}

function LicenseRequiredLayout(props) {
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const licenseStatus = setupConfig?.licenseStatus || {}
  const reason = String(licenseStatus?.reason || '').trim()
  const reasonLabelByCode = {
    fingerprint_mismatch: 'This license is activated for a different machine fingerprint.',
    expired: 'The active license has expired.',
    no_active_license: 'No active license was found on this machine.',
    inactive: 'The local license is inactive and needs reactivation.'
  }

  const reasonMessage = reasonLabelByCode[reason] || 'License validation failed. Please reactivate your license.'
  const errorMessage = String(licenseStatus?.error || '').trim()

  const retryLicenseCheck = async () => {
    await props.viewModel.loadSetupConfig()
  }

  const reopenSetup = () => {
    const cfg = props.viewModel.getState('setup-config') || {}
    props.viewModel.updateState('setup-config', { ...cfg, setupCompleted: false })
  }

  const onCancel = async () => {
    try {
      await window.ipcRenderer.invoke('app:quit')
    } catch (_) {
      // no-op fallback if quit IPC is unavailable
    }
  }

  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2' }, [
    Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
      Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
        Row({ tagType: 'h1', class: 'text-2xl font-bold text-indigo-700 mb-2' }, 'License Action Required'),
        Row({ class: 'text-sm text-gray-600' }, 'Setup is complete, but license validation must be resolved before continuing.')
      ]),
      Row({ class: 'px-8 py-6 flex flex-col gap-3' }, [
        Row({ class: 'text-sm text-gray-800' }, reasonMessage),
        reason ? Row({ class: 'text-xs text-gray-500' }, `Reason code: ${reason}`) : null,
        errorMessage ? Row({ class: 'text-sm text-red-600' }, errorMessage) : null
      ]),
      Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-2' }, [
        Button({
          variant: 'outline',
          onClick: retryLicenseCheck
        }, 'Retry'),
        Button({
          variant: 'outline',
          onClick: reopenSetup
        }, 'Reactivate License'),
        Button({
          variant: 'primary',
          onClick: onCancel
        }, 'Exit')
      ])
    ])
  ])
}

function SetupLayout(props, options = {}) {
  const forcedMode = options?.forcedMode || null
  const defaults = props.viewModel.getState('setup-defaults') || {}
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const setupError = props.viewModel.getState('setup-error')
  const loading = props.viewModel.getState('setup-loading')
  const stepLabelsByMode = forcedMode
    ? {
        server: ['Welcome', 'Server', 'License', 'Finish'],
        client: ['Welcome', 'Finish']
      }
    : {
        server: ['Welcome', 'Mode', 'Server', 'License', 'Finish'],
        client: ['Welcome', 'Mode', 'Finish']
      }
  props.ensureLocalStateKey('setup-mode', forcedMode || setupConfig.mode || defaults.mode || 'server')
  props.ensureLocalStateKey('setup-db-dir', defaults.dbDirectory || '')
  props.ensureLocalStateKey('setup-port', defaults.port || 4000)
  props.ensureLocalStateKey('setup-installation-key', '')
  props.ensureLocalStateKey('setup-license-key', '')
  props.ensureLocalStateKey('setup-company-name', '')
  props.ensureLocalStateKey('setup-company-phone', '')
  props.ensureLocalStateKey('setup-step-index', 0)

  if (forcedMode && props.getLocalState('setup-mode') !== forcedMode) {
    props.setLocalState('setup-mode', forcedMode)
  }
  const mode = forcedMode || props.getLocalState('setup-mode')
  const dbDir = props.getLocalState('setup-db-dir')
  const port = props.getLocalState('setup-port')
  const installationKey = props.getLocalState('setup-installation-key')
  const licenseKey = props.getLocalState('setup-license-key')
  const companyName = props.getLocalState('setup-company-name')
  const companyPhone = props.getLocalState('setup-company-phone')
  const stepLabels = stepLabelsByMode[mode] || stepLabelsByMode.server
  const maxStepIndex = stepLabels.length - 1
  const stepIndexRaw = props.getLocalState('setup-step-index') || 0
  const stepIndex = Math.max(0, Math.min(stepIndexRaw, maxStepIndex))
  if (stepIndexRaw !== stepIndex) props.setLocalState('setup-step-index', stepIndex)
  const progressPercent = Math.round(((stepIndex + 1) / stepLabels.length) * 100)
  const currentStep = stepLabels[stepIndex]
  const knownLicense = setupConfig?.licenseStatus?.license || null
  const knownLicenseStatus = setupConfig?.licenseStatus || null

  const maskedLicenseKey = (value) => {
    const v = String(value || '')
    if (!v) return '-'
    if (v.length <= 8) return v
    return `${v.slice(0, 4)}...${v.slice(-4)}`
  }

  const formatDuration = (license) => {
    if (!license) return '-'
    const type = String(license.subscription_type || '').toLowerCase()
    if (type === 'lifetime') return 'Lifetime'
    if (license.expires_at) return `Until ${String(license.expires_at).slice(0, 10)}`
    return '-'
  }

  const saveSetup = async () => {
    const payload = mode === 'server'
      ? {
          mode: 'server',
          dbDirectory: dbDir,
          port: Number(port || 4000),
          installationKey: String(installationKey || '').trim(),
          licenseKey: String(licenseKey || '').trim(),
          companyName: String(companyName || '').trim(),
          companyPhone: String(companyPhone || '').trim()
        }
      : { mode: 'client' }
    await props.viewModel.saveSetupConfig(payload)
  }

  const onCancel = async () => {
    try {
      await window.ipcRenderer.invoke('app:quit')
    } catch (_) {
      // no-op fallback if quit IPC is unavailable
    }
  }

  const canProceed = () => {
    if (currentStep === 'Mode') return mode === 'server' || mode === 'client'
    if (currentStep === 'Server') return String(dbDir || '').trim() !== '' && Number(port) > 0
    if (currentStep === 'License') {
      return String(licenseKey || '').trim() !== '' && String(companyName || '').trim() !== '' && String(companyPhone || '').trim() !== ''
    }
    return true
  }

  const onBack = () => {
    if (stepIndex <= 0) return
    props.setLocalState('setup-step-index', stepIndex - 1)
  }

  const onNext = async () => {
    if (loading || !canProceed()) return
    if (stepIndex < maxStepIndex) {
      props.setLocalState('setup-step-index', stepIndex + 1)
      return
    }
    await saveSetup()
  }

  const setMode = (newMode) => {
    props.setLocalState('setup-mode', newMode)
    props.setLocalState('setup-step-index', Math.min(props.getLocalState('setup-step-index') || 0, (stepLabelsByMode[newMode] || []).length - 1))
  }

  const StepBody = () => {
    if (currentStep === 'Welcome') {
      return Row({ class: 'text-sm text-gray-700 space-y-3' }, [
        Row({}, 'This setup wizard will configure your app in a few guided steps.'),
        Row({}, 'Server mode requires one-time online license activation, then runs offline using local validation.')
      ])
    }
    if (currentStep === 'Mode') {
      return Row({ class: 'flex flex-col gap-4' }, [
        Row({ class: 'text-sm text-gray-700' }, 'Choose how this app should run on this machine.'),
        Row({ class: 'flex gap-3' }, [
          Button({
            variant: mode === 'server' ? 'primary' : 'outline',
            onClick: () => setMode('server')
          }, 'Server (host + database)'),
          Button({
            variant: mode === 'client' ? 'primary' : 'outline',
            onClick: () => setMode('client')
          }, 'Client (connect to server)')
        ])
      ])
    }
    if (currentStep === 'Server') {
      const onBrowse = async () => {
        try {
          const res = await window.ipcRenderer.invoke('setup:choose-data-directory')
          if (res?.success && res?.path) props.setLocalState('setup-db-dir', res.path)
        } catch (_) {}
      }
      return Row({ class: 'flex flex-col gap-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Data directory'),
          Row({ class: 'text-xs text-gray-500 mb-1' }, 'Config and database storage location (outside the app). Choose a folder that persists across app updates.'),
          Row({ class: 'flex gap-2' }, [
            Input({
              value: dbDir,
              onChange: (e) => props.setLocalState('setup-db-dir', e.target.value),
              placeholder: 'e.g. /Users/you/Documents/PharmaSuitData',
              class: 'flex-1 min-w-0'
            }),
            Button({ variant: 'outline', onClick: onBrowse }, 'Browse')
          ])
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Server port'),
          Input({
            type: 'number',
            value: port,
            onChange: (e) => props.setLocalState('setup-port', e.target.value || 4000)
          })
        ])
      ])
    }
    if (currentStep === 'License') {
      return Row({ class: 'flex flex-col gap-3' }, [
        Row({ class: 'text-xs text-gray-500' }, 'Internet connection is required for activation on this step.'),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Installation key'),
          Input({
            value: installationKey,
            onChange: (e) => props.setLocalState('setup-installation-key', e.target.value),
            placeholder: 'Secret installation key'
          })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'License key'),
          Input({
            value: licenseKey,
            onChange: (e) => props.setLocalState('setup-license-key', e.target.value),
            placeholder: 'XXXX-XXXX-XXXX-XXXX'
          })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Company name'),
          Input({
            value: companyName,
            onChange: (e) => props.setLocalState('setup-company-name', e.target.value),
            placeholder: 'Company legal name'
          })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Company phone'),
          Input({
            value: companyPhone,
            onChange: (e) => props.setLocalState('setup-company-phone', e.target.value),
            placeholder: 'Primary phone'
          })
        ])
      ])
    }
    return Row({ class: 'text-sm text-gray-700 space-y-2' }, [
      Row({ class: 'font-medium' }, 'Review setup'),
      Row({}, mode === 'server' ? `Mode: Server, Port: ${port}` : 'Mode: Client'),
      Row({}, mode === 'server' ? `Database: ${dbDir || '-'}` : ''),
      mode === 'server' ? Row({}, `Installation key: ${installationKey ? 'Provided' : 'Not provided'}`) : null,
      mode === 'server' ? Row({}, `Entered license key: ${maskedLicenseKey(licenseKey)}`) : null,
      mode === 'server' ? Row({}, `Current local license status: ${knownLicenseStatus?.valid ? 'Valid' : (knownLicenseStatus?.reason || 'Not validated yet')}`) : null,
      mode === 'server' ? Row({}, `Current local subscription: ${knownLicense?.subscription_type || '-'}`) : null,
      mode === 'server' ? Row({}, `Current local duration: ${formatDuration(knownLicense)}`) : null,
      mode === 'server' ? Row({ class: 'text-xs text-gray-500 mt-2' }, 'On Finish, the app validates license and installation keys online. If the service is unreachable, setup shows a clear retry message.') : null,
      mode === 'client' ? Row({ class: 'text-xs text-gray-500 mt-2' }, 'After finish, you will enter a connection screen where you can set and validate server URL before login.') : null
    ])
  }

  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2' }, [
    Row({ class: 'w-full max-w-xl min-h-[410px] bg-white rounded-2xl shadow-xl flex flex-col' }, [
      Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
        Row({ tagType: 'h1', class: 'text-2xl font-bold text-indigo-700 mb-2' }, 'Initial Setup'),
        Row({ class: 'text-xs text-gray-500 mb-2' }, `Step ${stepIndex + 1} of ${stepLabels.length}: ${currentStep}`),
        Row({ class: 'w-full h-2 bg-gray-100 rounded' }, [
          Row({ class: 'h-2 bg-indigo-600 rounded', attributes: { style: `width:${progressPercent}%` } })
        ]),
        Row({ class: 'mt-2 text-[11px] text-gray-500' }, stepLabels.join('  >  '))
      ]),
      Row({ class: 'px-8 py-6 flex-1 overflow-auto flex flex-col gap-4' }, [
        StepBody(),
        setupError ? Row({ class: 'text-sm text-red-600' }, setupError) : null
      ]),
      Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-2' }, [
        Button({
          variant: 'outline',
          onClick: onBack,
          disabled: loading || stepIndex === 0
        }, 'Back'),
        Button({
          variant: 'outline',
          onClick: onCancel,
          disabled: !!loading
        }, 'Cancel'),
        Button({
          variant: 'primary',
          disabled: !!loading || !canProceed(),
          onClick: onNext
        }, loading ? (stepIndex === maxStepIndex ? 'Finishing...' : 'Saving...') : (stepIndex === maxStepIndex ? 'Finish' : 'Next'))
      ])
    ])
  ])
}

function ClientConnectionLayout(props) {
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const savedUrl = String(setupConfig?.client?.serverUrl || '').trim()
  const vmError = String(setupConfig?.clientConnectionError || '').trim()
  const vmMessage = String(setupConfig?.clientConnectionMessage || '').trim()
  const vmConnected = setupConfig?.clientConnected === true
  props.ensureLocalStateKey('client-connect-url', savedUrl)
  props.ensureLocalStateKey('client-connect-loading', false)
  props.ensureLocalStateKey('client-connect-error', vmError)
  props.ensureLocalStateKey('client-connect-message', vmMessage)

  const urlValue = props.getLocalState('client-connect-url')
  const loading = !!props.getLocalState('client-connect-loading')
  const error = props.getLocalState('client-connect-error')
  const message = props.getLocalState('client-connect-message')

  const testConnection = async () => {
    props.setLocalState('client-connect-error', '')
    props.setLocalState('client-connect-message', '')
    props.setLocalState('client-connect-loading', true)
    try {
      const result = await props.viewModel.testClientServerUrl(urlValue)
      if (!result?.success) {
        props.setLocalState('client-connect-error', result?.error || 'Unable to connect to server.')
        return
      }
      props.setLocalState('client-connect-message', `Connection check passed for ${result.serverUrl}`)
    } finally {
      props.setLocalState('client-connect-loading', false)
    }
  }

  const connect = async () => {
    props.setLocalState('client-connect-error', '')
    props.setLocalState('client-connect-message', '')
    props.setLocalState('client-connect-loading', true)
    try {
      const result = await props.viewModel.connectClientServerUrl(urlValue)
      if (!result?.success) {
        props.setLocalState('client-connect-error', result?.error || 'Unable to connect to server.')
      }
    } finally {
      props.setLocalState('client-connect-loading', false)
    }
  }

  const onCancel = async () => {
    try {
      await window.ipcRenderer.invoke('app:quit')
    } catch (_) {
      // no-op fallback if quit IPC is unavailable
    }
  }

  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2' }, [
    Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
      Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
        Row({ tagType: 'h1', class: 'text-2xl font-bold text-indigo-700 mb-2' }, 'Connect to Server'),
        Row({ class: 'text-sm text-gray-600' }, 'Client mode works like a browser: choose a server URL, verify connection, then continue to login.')
      ]),
      Row({ class: 'px-8 py-6 flex flex-col gap-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Server URL'),
          Input({
            value: urlValue,
            onChange: (e) => props.setLocalState('client-connect-url', e.target.value),
            placeholder: 'e.g. http://192.168.1.20:4000'
          })
        ]),
        Row({ class: `text-sm ${vmConnected ? 'text-green-700' : 'text-gray-600'}` }, vmConnected
          ? `Status: Connected${savedUrl ? ` (${savedUrl})` : ''}`
          : 'Status: Not connected'),
        message ? Row({ class: 'text-sm text-green-700' }, message) : null,
        error ? Row({ class: 'text-sm text-red-600' }, error) : null
      ]),
      Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-2' }, [
        Button({
          variant: 'outline',
          onClick: onCancel,
          disabled: loading
        }, 'Cancel'),
        Button({
          variant: 'outline',
          onClick: testConnection,
          disabled: loading
        }, loading ? 'Testing...' : 'Test Connection'),
        Button({
          variant: 'primary',
          onClick: connect,
          disabled: loading
        }, loading ? 'Connecting...' : 'Connect')
      ])
    ])
  ])
}

function MainLayout(props, main, router) { 
  props.ensureLocalStateKey('navCollapsed', false);

  const navCollapsed = props.getLocalState('navCollapsed');

  return Row({ class: "flex h-full min-h-0 overflow-hidden" }, [
    Row({ class: `bg-indigo-950 h-full py-4 ${navCollapsed ? 'w-20 px-2' : 'w-64 px-4'} duration-300 relative overflow-visible` }, [
      MenuToggleButton(props),
      HeadNav(props),
      NavigationUI({ router, ...props }),
    ]),
    Row({ class: 'h-full min-h-0 flex-1 flex flex-col overflow-hidden' }, [
      HeaderUI({ router, navigationVM: props.viewModel }),
      Row({ tagType: 'div', class: 'flex-1  min-h-0 overflow-hidden' }, [main]),
      FooterUI()
    ])
  ]);
}

function HeadNav(props) {
  const navCollapsed = props.getLocalState('navCollapsed');

  return Row({ class: 'flex items-center mb-10' }, [
      Row({ tagType: 'span', class: 'text-white h-10 w-10 flex items-center justify-center ml-2'}, [
        Row({ tagType: 'ion-icon', attributes: { name: 'logo-apple', class: 'text-white text-4xl' } }),
      ]),
      Row({ tagType: 'span', class: `text-3xl text-white font-bold duration-300 ${navCollapsed ? 'scale-0 ml-0' : 'ml-2'}` }, 'MasaTech')
    ])
}

function LoginLayout(props) {
  const auth = props.viewModel.getState('auth') || {};
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const isClientMode = setupConfig?.mode === 'client'
  const clientUrl = String(setupConfig?.client?.serverUrl || '').trim()
  const clientConnected = setupConfig?.clientConnected === true
  const loginForm = auth.loginForm || { username: '', password: '' };
  props.ensureLocalStateKey('localError', '');
  const localError = props.getLocalState('localError');

  const handleChange = (field) => (e) => {
    props.viewModel.updateLoginForm(field, e.target.value);
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    const state = props.viewModel.getState('auth') || {};
    if (state.loading) return;

    // basic client-side validation
    if (!loginForm.username || !loginForm.password) {
      props.setLocalState('localError', 'Please enter both username and password.');
      return;
    }

    props.setLocalState('localError', '');
    try {
      await props.viewModel.login();
    } catch (err) {
      // login() should set error state on the VM; swallow here to avoid unhandled rejection
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  // props.ensureStateKey('auth');

  return Row({
    class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2',
    lifecycle: import.meta.env.DEV
      ? {
          onMount: () => {
            queueMicrotask(() => {
              props.viewModel.maybeDevAutoLogin()
            })
          }
        }
      : undefined
  }, [
    Row({ class: 'w-full max-w-md p-10 bg-white rounded-2xl shadow-xl' }, [
      Row({ tagType: 'div', class: 'mb-6 text-center' }, [
        Row({ tagType: 'h1', class: 'text-3xl font-extrabold text-indigo-700' }, 'PharmaSuit'),
        Row({ tagType: 'div', class: 'text-sm text-gray-500' }, 'Secure pharmacy inventory and management')
      ]),

      Row({ tagType: 'h2', class: 'text-2xl font-semibold mb-4' }, 'Sign in'),
      isClientMode ? Row({ class: `mb-3 text-sm ${clientConnected ? 'text-green-700' : 'text-red-600'}` }, clientConnected
        ? `Connected to ${clientUrl || 'server'}`
        : 'Client is not connected to a server. Change URL and connect first.') : null,

      Row({ class: 'space-y-4' }, [
        Row({}, [ Row({ tagType: 'label', attributes: { for: 'username' }, class: 'block text-sm font-medium text-gray-700 mb-1' }, 'Username'),
          Input({ id: 'username', name: 'username', class: 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300', value: loginForm.username, onChange: handleChange('username'), onKeyDown: handleKeyDown, placeholder: 'Username' })
        ]),

        Row({}, [ Row({ tagType: 'label', attributes: { for: 'password' }, class: 'block text-sm font-medium text-gray-700 mb-1' }, 'Password'),
          Input({ id: 'password', name: 'password', type: 'password', class: 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300', value: loginForm.password, onChange: handleChange('password'), onKeyDown: handleKeyDown, placeholder: 'Password' })
        ]),

        // Local validation error first, then server error
        localError ? Row({ class: 'text-sm text-red-600' }, localError) : (auth.error ? Row({ class: 'text-sm text-red-600' }, auth.error) : null),

        Row({ class: 'flex justify-end' }, [
          isClientMode ? Button({
            type: 'button',
            variant: 'outline',
            onClick: () => props.viewModel.markClientDisconnected(),
            class: 'px-4 py-2 rounded-md mr-2'
          }, 'Change Server URL') : null,
          Button({ type: 'button', variant: 'primary', onClick: handleSubmit, disabled: !!auth.loading, attributes: { 'aria-busy': !!auth.loading }, class: 'px-6 py-2 rounded-md' }, [
            auth.loading ? Row({ class: 'flex items-center' }, [
              Row({ tagType: 'svg', attributes: { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'animate-spin h-4 w-4 mr-2 text-white' } }, [
                Row({ tagType: 'path', attributes: { 'stroke': 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 2v4m0 12v4m8-8h-4M4 12H0' } })
              ]),
              'Signing in...'
            ]) : 'Sign in'
          ])
        ])
      ])
    ])
  ]);
}

function MenuToggleButton(props) {
  const navCollapsed = props.getLocalState('navCollapsed');
  return Row({
    tagType: 'span', class: `z-50 bg-white text-indigo-950 h-8 w-8 flex items-center justify-center rounded-full absolute -right-3 top-6 cursor-pointer transform transition-transform duration-300 ${navCollapsed ? 'rotate-180' : ''}`,
    events: { click: () => props.setLocalState('navCollapsed', !props.getLocalState('navCollapsed')) }
  }, [
    Row({ tagType: 'ion-icon', attributes: { name: 'caret-forward-circle-outline', class: 'text-3xl' } })
  ]);
}



// function FootNav() {
//   return Row({ class: "p-4 border-t border-blue-900" }, [
//     Row({ tagType: 'button', class: "w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition" }, "Logout")
//   ])
// }