const { Row, Router,  StatefulRow } = Liteframe;
import NavigationUI from "./components/navigation/NavigationUI.js";
import ServerManagerUI from "./components/serverManager/ServerManagerUI.js";
import HeaderUI from "./components/header/HeaderUI.js";
import FooterUI from "./components/footer/FooterUI.js";
import NavigationVM, { navigationVM } from "./components/navigation/NavigationVM.js";
import { Input } from './components/utils/Input.js';
import { Button } from './components/utils/Button.js';

export function App() {
  const main = Row({ tagType: 'div', class: 'relative h-full flex flex-col' });

  const router = new Router(main);

  const render = (props) => {
    const setupLoading = props.viewModel.getState('setup-loading')
    const setupConfig = props.viewModel.getState('setup-config')
    const setupDone = !!setupConfig?.setupCompleted
    if (setupLoading) {
      return Row({ class: 'h-screen w-full flex items-center justify-center bg-gray-50 text-gray-600' }, 'Loading setup...')
    }
    if (!setupDone) return SetupLayout(props)

    const auth = props.viewModel.getState('auth') || { isAuthenticated: false };
    if (!auth.isAuthenticated) return LoginLayout(props);

    return MainLayout(props, main, router);
  };

  return StatefulRow({id: 'App', stateKeys: ['loading', 'active-menu', 'pending-sales-open', 'pending-purchase-open', 'setup-loading', 'setup-config', 'setup-defaults', 'setup-error'], viewModel: navigationVM }, render);
  
}

function SetupLayout(props) {
  const defaults = props.viewModel.getState('setup-defaults') || {}
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const setupError = props.viewModel.getState('setup-error')
  const loading = props.viewModel.getState('setup-loading')
  const stepLabelsByMode = {
    server: ['Welcome', 'Mode', 'Server', 'License', 'Finish'],
    client: ['Welcome', 'Mode', 'Client', 'Finish']
  }
  props.ensureLocalStateKey('setup-mode', defaults.mode || 'server')
  props.ensureLocalStateKey('setup-db-dir', defaults.dbDirectory || '')
  props.ensureLocalStateKey('setup-port', defaults.port || 4000)
  props.ensureLocalStateKey('setup-server-url', '')
  props.ensureLocalStateKey('setup-installation-key', '')
  props.ensureLocalStateKey('setup-license-key', '')
  props.ensureLocalStateKey('setup-company-name', '')
  props.ensureLocalStateKey('setup-company-phone', '')
  props.ensureLocalStateKey('setup-step-index', 0)

  const mode = props.getLocalState('setup-mode')
  const dbDir = props.getLocalState('setup-db-dir')
  const port = props.getLocalState('setup-port')
  const serverUrl = props.getLocalState('setup-server-url')
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
      : { mode: 'client', serverUrl: String(serverUrl || '').trim() }
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
    if (currentStep === 'Client') return String(serverUrl || '').trim() !== ''
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
      return Row({ class: 'flex flex-col gap-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Database directory'),
          Input({
            value: dbDir,
            onChange: (e) => props.setLocalState('setup-db-dir', e.target.value),
            placeholder: 'Path to directory where pharmasuit_lan.db will be stored'
          })
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
    if (currentStep === 'Client') {
      return Row({ class: 'flex flex-col gap-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Server URL'),
          Input({
            value: serverUrl,
            onChange: (e) => props.setLocalState('setup-server-url', e.target.value),
            placeholder: 'e.g. http://192.168.1.20:4000'
          })
        ])
      ])
    }
    return Row({ class: 'text-sm text-gray-700 space-y-2' }, [
      Row({ class: 'font-medium' }, 'Review setup'),
      Row({}, mode === 'server' ? `Mode: Server, Port: ${port}` : `Mode: Client, URL: ${serverUrl || '-'}`),
      Row({}, mode === 'server' ? `Database: ${dbDir || '-'}` : ''),
      mode === 'server' ? Row({}, `Installation key: ${installationKey ? 'Provided' : 'Not provided'}`) : null,
      mode === 'server' ? Row({}, `Entered license key: ${maskedLicenseKey(licenseKey)}`) : null,
      mode === 'server' ? Row({}, `Current local license status: ${knownLicenseStatus?.valid ? 'Valid' : (knownLicenseStatus?.reason || 'Not validated yet')}`) : null,
      mode === 'server' ? Row({}, `Current local subscription: ${knownLicense?.subscription_type || '-'}`) : null,
      mode === 'server' ? Row({}, `Current local duration: ${formatDuration(knownLicense)}`) : null,
      mode === 'server' ? Row({ class: 'text-xs text-gray-500 mt-2' }, 'On Finish, the app validates license and installation keys online. If the service is unreachable, setup shows a clear retry message.') : null
    ])
  }

  return Row({ class: 'h-screen w-full flex items-center justify-center bg-gray-50 p-2' }, [
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

function MainLayout(props, main, router) { 
  props.ensureLocalStateKey('navCollapsed', false);

  const navCollapsed = props.getLocalState('navCollapsed');

  return Row({ class: "flex" }, [
    Row({ class: `bg-indigo-950 h-screen py-5 ${navCollapsed ? 'w-20 px-3' : 'w-72 px-5'} duration-300 relative` }, [
      MenuToggleButton(props),
      HeadNav(props),
      NavigationUI({ router, ...props }),
    ]),
    Row({ class: 'h-screen flex-1 flex flex-col' }, [
      HeaderUI(),
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

  return Row({ class: 'h-screen w-full flex items-center justify-center bg-gray-50' }, [
    Row({ class: 'w-full max-w-md p-10 bg-white rounded-2xl shadow-xl' }, [
      Row({ tagType: 'div', class: 'mb-6 text-center' }, [
        Row({ tagType: 'h1', class: 'text-3xl font-extrabold text-indigo-700' }, 'PharmaSuit'),
        Row({ tagType: 'div', class: 'text-sm text-gray-500' }, 'Secure pharmacy inventory and management')
      ]),

      Row({ tagType: 'h2', class: 'text-2xl font-semibold mb-4' }, 'Sign in'),

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
    tagType: 'span', class: `bg-white text-indigo-950 h-8 w-8 flex items-center justify-center rounded-full absolute -right-3 top-6 cursor-pointer transform transition-transform duration-300 ${navCollapsed ? 'rotate-180' : ''}`,
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