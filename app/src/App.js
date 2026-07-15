const { Row, Router,  StatefulRow } = Liteframe;
import NavigationUI from "./components/navigation/NavigationUI.js";
import HeaderUI from "./components/header/HeaderUI.js";
import FooterUI from "./components/footer/FooterUI.js";
import NavigationVM, { navigationVM } from "./components/navigation/NavigationVM.js";
import { Input } from './components/utils/Input.js';
import { Button } from './components/utils/Button.js';
import { getDefaultServerUrl } from './config/cloudClient.js';

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

  // Cloud client: Server URL + tenant code (client_code) → login → app.
  // Tenants are your SaaS customers; their suppliers/retailers are "customers" in the app.
  const render = (props) => {
    const setupLoading = props.viewModel.getState('setup-loading')
    const setupConfig = props.viewModel.getState('setup-config')
    const clientConnected = setupConfig?.clientConnected === true

    if (setupLoading) {
      return Row({ class: 'h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-gray-50', attributes: { 'aria-busy': 'true', 'aria-live': 'polite' } }, [
        Row({ tagType: 'div', class: 'text-xl font-bold text-indigo-700' }, 'PharmaSuit'),
        BootSpinner({ class: 'h-8 w-8 text-indigo-600' }),
        Row({ tagType: 'div', class: 'text-sm text-gray-500' }, 'Preparing PharmaSuit…')
      ])
    }
    if (!clientConnected) return ClientConnectionLayout(props)

    const auth = props.viewModel.getState('auth') || { isAuthenticated: false };
    if (!auth.isAuthenticated) return LoginLayout(props);

    const serverDown = !!props.viewModel.getState('server-down')
    if (serverDown) return ServerDownOverlay(props)

    return MainLayout(props, main, router);
  };

  return StatefulRow({id: 'App', class: 'h-[100dvh] min-h-0 overflow-hidden', stateKeys: ['loading', 'active-menu', 'pending-sales-open', 'pending-purchase-open', 'setup-loading', 'setup-config', 'auth', 'server-down'], viewModel: navigationVM }, render);
}

function ClientConnectionLayout(props) {
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const setupDefaults = props.viewModel.getState('setup-defaults') || {}
  const savedUrl = String(setupConfig?.client?.serverUrl || '').trim()
  const savedTenantCode = String(setupConfig?.client?.clientCode || '').trim()
  const vmError = String(setupConfig?.clientConnectionError || '').trim()

  const defaultUrl =
    savedUrl ||
    String(setupDefaults?.defaultServerUrl || '').trim() ||
    getDefaultServerUrl()

  props.ensureLocalStateKey('client-connect-url', defaultUrl)
  props.ensureLocalStateKey('client-connect-code', savedTenantCode)
  props.ensureLocalStateKey('client-connect-loading', false)
  props.ensureLocalStateKey('client-connect-error', vmError)

  const urlValue = props.getLocalState('client-connect-url')
  const codeValue = props.getLocalState('client-connect-code')
  const loading = !!props.getLocalState('client-connect-loading')
  const error = props.getLocalState('client-connect-error')

  const connect = async () => {
    props.setLocalState('client-connect-error', '')
    if (!String(codeValue || '').trim()) {
      props.setLocalState('client-connect-error', 'Tenant code is required.')
      return
    }
    props.setLocalState('client-connect-loading', true)
    try {
      const result = await props.viewModel.connectClientServerUrl(urlValue, codeValue)
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
    } catch (_) {}
  }

  const placeholder = import.meta.env.DEV ? 'http://localhost:4000' : 'https://mltplc.com'
  const hint = 'Enter your PharmaSuit server URL and the tenant code from your administrator, then connect to sign in.'

  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-50 p-2' }, [
    Row({ class: 'w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col' }, [
      Row({ class: 'px-8 pt-6 pb-4 border-b border-gray-100' }, [
        Row({ tagType: 'h1', class: 'text-2xl font-bold text-indigo-700 mb-2' }, 'Connect to PharmaSuit'),
        Row({ class: 'text-sm text-gray-600' }, hint)
      ]),
      Row({ class: 'px-8 py-6 flex flex-col gap-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Server URL'),
          Input({
            value: urlValue,
            onChange: (e) => props.setLocalState('client-connect-url', e.target.value),
            placeholder
          })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 mb-1' }, 'Tenant code'),
          Input({
            value: codeValue,
            onChange: (e) => props.setLocalState('client-connect-code', e.target.value.toUpperCase()),
            placeholder: 'e.g. AB3D9F2K'
          }),
          Row({ class: 'text-xs text-gray-500 mt-1' }, 'Identifies your business on the cloud service (not a customer record).')
        ]),
        error ? Row({ class: 'text-sm text-red-600' }, error) : null
      ]),
      Row({ class: 'px-8 py-4 border-t border-gray-100 flex items-center justify-end gap-2' }, [
        Button({
          variant: 'outline',
          onClick: onCancel,
          disabled: loading
        }, 'Quit'),
        Button({
          variant: 'primary',
          onClick: connect,
          disabled: loading
        }, loading ? 'Connecting…' : 'Connect')
      ])
    ])
  ])
}

function ServerDownOverlay(props) {
  const setupConfig = props.viewModel.getState('setup-config') || {}
  const serverUrl = setupConfig?.client?.serverUrl || setupConfig?.apiBaseUrl || ''

  const handleRetry = async () => {
    await props.viewModel.retryServerConnection()
  }

  return Row({ class: 'h-[100dvh] w-full flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4' }, [
    Row({ class: 'w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col items-center gap-5 px-8 py-10 text-center' }, [
      Row({ tagType: 'div', class: 'text-5xl' }, [
        Row({ tagType: 'ion-icon', attributes: { name: 'cloud-offline-outline' }, class: 'text-red-400' })
      ]),
      Row({ tagType: 'h2', class: 'text-xl font-bold text-gray-800' }, 'Server Unavailable'),
      Row({ class: 'text-sm text-gray-500 leading-relaxed' }, 'The connection to the server was lost. This may be a temporary network issue or the server is restarting.'),
      serverUrl ? Row({ class: 'text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-1 w-full truncate' }, serverUrl) : null,
      Row({ class: 'flex items-center gap-2 text-sm text-indigo-600' }, [
        BootSpinner({ class: 'h-4 w-4 text-indigo-500 shrink-0' }),
        Row({}, 'Retrying automatically every 15 seconds…')
      ]),
      Button({
        variant: 'primary',
        onClick: handleRetry,
        class: 'w-full'
      }, 'Retry Now')
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
  const clientUrl = String(setupConfig?.client?.serverUrl || '').trim()
  const tenantCode = String(setupConfig?.client?.clientCode || '').trim()
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

    if (!loginForm.username || !loginForm.password) {
      props.setLocalState('localError', 'Please enter both username and password.');
      return;
    }

    props.setLocalState('localError', '');
    try {
      await props.viewModel.login();
    } catch (err) {
      // login() sets error on the VM
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

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
      Row({ class: 'mb-4 text-sm text-gray-600 space-y-1' }, [
        clientUrl ? Row({}, `Server: ${clientUrl}`) : null,
        tenantCode ? Row({}, `Tenant: ${tenantCode}`) : null
      ].filter(Boolean)),

      Row({ class: 'space-y-4' }, [
        Row({}, [ Row({ tagType: 'label', attributes: { for: 'username' }, class: 'block text-sm font-medium text-gray-700 mb-1' }, 'Username'),
          Input({ id: 'username', name: 'username', class: 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300', value: loginForm.username, onChange: handleChange('username'), onKeyDown: handleKeyDown, placeholder: 'Username' })
        ]),

        Row({}, [ Row({ tagType: 'label', attributes: { for: 'password' }, class: 'block text-sm font-medium text-gray-700 mb-1' }, 'Password'),
          Input({ id: 'password', name: 'password', type: 'password', class: 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300', value: loginForm.password, onChange: handleChange('password'), onKeyDown: handleKeyDown, placeholder: 'Password' })
        ]),

        localError ? Row({ class: 'text-sm text-red-600' }, localError) : (auth.error ? Row({ class: 'text-sm text-red-600' }, auth.error) : null),

        Row({ class: 'flex justify-end' }, [
          Button({
            type: 'button',
            variant: 'outline',
            onClick: () => props.viewModel.markClientDisconnected(),
            class: 'px-4 py-2 rounded-md mr-2'
          }, 'Change connection'),
          Button({ type: 'button', variant: 'primary', onClick: handleSubmit, disabled: !!auth.loading, attributes: { 'aria-busy': !!auth.loading }, class: 'px-6 py-2 rounded-md' }, [
            auth.loading ? Row({ class: 'flex items-center' }, [
              Row({ tagType: 'svg', attributes: { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'animate-spin h-4 w-4 mr-2 text-white' } }, [
                Row({ tagType: 'path', attributes: { 'stroke': 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 2v4m0 12v4m8-8h-4M4 12H0' } })
              ]),
              'Signing in…'
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
