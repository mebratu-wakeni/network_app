/**
 * Header UI Component
 * Displays application header with health indicators and user info
 */
const { Row, StatefulRow } = Liteframe;
import { getHeaderVM } from './HeaderVM.js';
import { getApiAsset } from '../../../electron/config/apiConfig.js';
import Avatar from '../utils/Avatar.js';
import { IonIcon } from '../utils/Icon.js';
import {
  HEALTH_ICONS,
  HEADER_CLASSES
} from './headerConfig.js';
import {
  getHealthStatus,
  getOverallHealthStatus
} from './headerFormatters.js';
import { Button } from '../utils/Button.js';

/** Resolve HeaderVM for the document-level outside-click closer. */
let headerMenuVmRef = null;
let headerMenuOutsideBound = false;

function ensureHeaderMenuOutsideClick() {
  if (headerMenuOutsideBound) return;
  headerMenuOutsideBound = true;
  document.addEventListener(
    'click',
    (e) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const inside = path.some(
        (node) => node && typeof node.hasAttribute === 'function' && node.hasAttribute('data-header-user-menu')
      ) || !!(e.target?.closest && e.target.closest('[data-header-user-menu]'));
      if (inside) return;
      headerMenuVmRef?.closeUserMenu?.();
    },
    true
  );
}

/**
 * Render health indicators
 * @param {Object} props - Component props
 * @returns {HTMLElement} Health indicators container
 */
function renderHealthIndicators(props) {
  const appMode = props.viewModel.getState('appMode');
  if (appMode === 'client') {
    return renderClientConnectionIndicator(props);
  }
  const serverHealth = props.viewModel.getState('serverHealth');
  const dbHealth = props.viewModel.getState('dbHealth');
  const apiHealth = props.viewModel.getState('apiHealth');
  
  const serverStatus = getHealthStatus(serverHealth);
  const dbStatus = getHealthStatus(dbHealth);
  const apiStatus = getHealthStatus(apiHealth);
  
  const overallStatus = getOverallHealthStatus(serverStatus, dbStatus, apiStatus);
  
  return Row({
    class: `${HEADER_CLASSES.healthContainer} ${overallStatus.pulsatingClass} text-xl ${overallStatus.healthColor}`,
    attributes: {
      title: overallStatus.tooltip
    }
  }, [
    Row({
      tagType: 'ion-icon',
      attributes: { name: HEALTH_ICONS.server }
    }),
    Row({
      tagType: 'ion-icon',
      attributes: { name: HEALTH_ICONS.database }
    }),
    Row({
      tagType: 'ion-icon',
      attributes: { name: HEALTH_ICONS.api }
    })
  ]);
}

function renderClientConnectionIndicator(props) {
  const connected = props.viewModel.getState('clientConnected') === true;
  const serverUrl = props.viewModel.getState('clientServerUrl') || '';
  const connectionError = props.viewModel.getState('clientConnectionError');
  const retrying = props.viewModel.getState('connectionRetrying') === true;
  const tooltip = connected
    ? `Connected to ${serverUrl || 'server'}`
    : (connectionError || `Connection lost${serverUrl ? ` — ${serverUrl}` : ''}. Saves may fail until restored.`);

  return Row({
    class: `${HEADER_CLASSES.healthContainer} items-center gap-2`,
    attributes: { title: tooltip }
  }, [
    // Status dot left of URL (green = ok, gray = lost) — non-blocking Meet-style signal
    Row({
      tagType: 'span',
      class: `inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        connected ? 'bg-green-500' : 'bg-gray-400'
      }`,
      attributes: { 'aria-label': connected ? 'Online' : 'Offline' }
    }),
    serverUrl
      ? Row({ tagType: 'span', class: 'text-xs text-gray-600 font-mono max-w-[280px] truncate' }, serverUrl)
      : Row({ tagType: 'span', class: 'text-xs text-gray-500' }, connected ? 'Online' : 'Offline'),
    !connected
      ? Row({ tagType: 'span', class: 'text-xs text-gray-500 hidden sm:inline' }, 'Offline — changes may not save')
      : null,
    !connected
      ? Button({
          variant: 'outline',
          class: 'text-xs py-0.5 px-2 min-h-0',
          disabled: retrying,
          onClick: () => props.viewModel.retryConnection()
        }, retrying ? 'Checking…' : 'Retry')
      : null
  ]);
}

/**
 * Render user avatar
 * Uses the same Avatar component pattern as the users table
 * @param {Object} user - User object
 * @returns {HTMLElement} Avatar element
 */
function renderAvatar(user) {
  const avatarPreview = user?.avatar_url ? getApiAsset(user.avatar_url) : null;
  const fallback = user?.display_name || user?.name || 'User';
  
  return Avatar({
    src: avatarPreview,
    alt: fallback,
    fallback: fallback,
    size: 'w-10 h-10',
    class: ''
  });
}

/**
 * Header avatar menu — intentionally NOT ActionDropdown.
 * ActionDropdown closed over render-time `open` / onToggle and broke after
 * Profile/Settings navigation (App remorph + stale EventDelegator handlers).
 */
function renderUserMenu(props, user) {
  ensureHeaderMenuOutsideClick();
  headerMenuVmRef = props.viewModel;

  const userMenuOpen = props.viewModel.getState('userMenuOpen') === true;
  const menuOptions = props.viewModel.getUserMenuOptions();

  const items = menuOptions.map((option) => Row({
    tagType: 'button',
    class: [
      'w-full text-left px-3 py-2 text-sm flex items-center justify-start gap-2 transition-colors font-semibold cursor-pointer',
      option.danger
        ? 'text-red-400 hover:bg-red-500/10 mt-1 border-t border-gray-300'
        : 'text-indigo-600 hover:bg-indigo-500/10'
    ].join(' '),
    attributes: { type: 'button', 'data-header-menu-item': option.key || '' },
    events: {
      click: (e) => {
        e.preventDefault();
        e.stopPropagation();
        props.viewModel.closeUserMenu();
        // Defer navigation so the closed morph isn't raced by App active-menu remorph.
        setTimeout(() => {
          try { option.onClick?.(); } catch (_) {}
        }, 0);
      }
    }
  }, [
    IonIcon({ name: option.icon, class: 'text-xl font-semibold' }),
    option.label
  ]));

  return Row({
    class: 'relative inline-flex',
    attributes: { 'data-header-user-menu': '' }
  }, [
    Row({
      tagType: 'button',
      class: 'inline-flex items-center gap-1 rounded-md px-1.5 py-1 bg-transparent hover:bg-gray-100 text-gray-600 transition-colors duration-150 focus:outline-none',
      attributes: {
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-expanded': userMenuOpen ? 'true' : 'false',
        title: 'Account menu'
      },
      events: {
        click: (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Always read live VM state — never close over render-time open/closed.
          props.viewModel.toggleUserMenu();
        }
      }
    }, [
      Row({ class: 'flex items-center gap-1' }, [
        renderAvatar(user),
        Row({
          class: `w-4 h-4 flex items-center justify-center text-sm text-gray-500 transition-transform duration-200 ease-out ${userMenuOpen ? 'rotate-180' : ''}`
        }, [
          Row({
            tagType: 'ion-icon',
            class: 'leading-none',
            attributes: { name: 'chevron-down-outline' }
          })
        ])
      ])
    ]),
    userMenuOpen
      ? Row({
          class: 'z-[100] absolute right-0 top-full mt-2 min-w-52 rounded-md bg-gray-200 border border-gray-300 shadow-lg py-1',
          attributes: { role: 'menu' }
        }, items)
      : null
  ]);
}

/**
 * Render user info section
 * @param {Object} user - User object
 * @returns {HTMLElement} User info container
 */
function renderUserInfo(props, user) {
  const displayName = user?.display_name || user?.name || 'User';
  
  return Row({ class: HEADER_CLASSES.rightSection }, [
    Row({ tagType: 'span', class: HEADER_CLASSES.userName }, displayName),
    renderUserMenu(props, user)
  ]);
}

/**
 * Main header render function
 * @param {Object} props - Component props
 * @returns {HTMLElement} Header container
 */
function renderHeader(props) {
  // Ensure required state keys exist
  props.ensureStateKey('serverHealth');
  props.ensureStateKey('dbHealth');
  props.ensureStateKey('apiHealth');
  props.ensureStateKey('appMode');
  props.ensureStateKey('clientConnected');
  props.ensureStateKey('clientServerUrl');
  props.ensureStateKey('clientConnectionError');
  props.ensureStateKey('connectionRetrying');
  props.ensureStateKey('user');
  props.ensureStateKey('userMenuOpen');
  
  props.viewModel.syncRuntimeStatus();
  // Sync user data from navigation VM
  props.viewModel.syncUser();
  
  const user = props.viewModel.getState('user');
  
  return Row({
    class: HEADER_CLASSES.container
  }, [
    // Left side: Health indicators
    Row({ class: HEADER_CLASSES.leftSection }, [
      renderHealthIndicators(props)
    ]),
    // Right side: User info
    renderUserInfo(props, user)
  ]);
}

/**
 * Header UI — independent StatefulRow.
 *
 * Mount once into a stable host from App() (same pattern as Router `main`).
 * Do not call this from inside App/MainLayout paint: nested StatefulRows are
 * torn down/recreated when App remorphs on `active-menu` (Profile/Settings),
 * which breaks the account dropdown.
 */
export default function HeaderUI({ router = null, navigationVM = null } = {}) {
  const viewModel = getHeaderVM({ router, navigationVM });
  headerMenuVmRef = viewModel;

  return StatefulRow({
    id: 'AppHeader',
    viewModel,
    stateKeys: [
      'serverHealth',
      'dbHealth',
      'apiHealth',
      'appMode',
      'clientConnected',
      'clientServerUrl',
      'clientConnectionError',
      'connectionRetrying',
      'user',
      'userMenuOpen'
    ]
  }, renderHeader);
}
