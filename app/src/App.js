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
    // Try to restore auth from stored token (will mark optimistic authenticated)
    // try { props.viewModel.tryRestoreAuth() } catch (e) {}

    const auth = props.viewModel.getState('auth') || { isAuthenticated: false };
    if (!auth.isAuthenticated) return LoginLayout(props);

    return MainLayout(props, main, router);
  };

  return StatefulRow({id: 'App', stateKeys: ['loading', 'active-menu', 'pending-sales-open', 'pending-purchase-open'], viewModel: navigationVM }, render);
  
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