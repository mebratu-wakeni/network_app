/**
 * Header UI Component
 * Displays application header with health indicators and user info
 */
const { Row, StatefulRow } = Liteframe;
import HeaderVM from './HeaderVM.js';
import { getApiAsset } from '../../../electron/config/apiConfig.js';
import Avatar from '../utils/Avatar.js';
import { ActionDropdown, ActionItem } from '../utils/Action.js';
import {
  HEALTH_ICONS,
  HEADER_CLASSES
} from './headerConfig.js';
import {
  getHealthStatus,
  getOverallHealthStatus
} from './headerFormatters.js';

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
  const serverUrl = props.viewModel.getState('clientServerUrl');
  const connectionError = props.viewModel.getState('clientConnectionError');
  const indicatorColor = connected ? 'text-green-600' : 'text-red-500';
  const tooltip = connected
    ? `Connected to ${serverUrl || 'server'}`
    : (connectionError || `Disconnected${serverUrl ? ` from ${serverUrl}` : ''}`);

  return Row({
    class: `${HEADER_CLASSES.healthContainer} ${indicatorColor}`,
    attributes: {
      title: tooltip
    }
  }, [
    Row({
      tagType: 'ion-icon',
      attributes: { name: connected ? 'checkmark-circle' : 'alert-circle' }
    }),
    Row({ tagType: 'span', class: 'text-sm font-medium' }, connected ? 'Connected' : 'Disconnected'),
    serverUrl ? Row({ tagType: 'span', class: 'text-xs text-gray-500 ml-1 max-w-[240px] truncate' }, serverUrl) : null
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

function renderUserMenu(props, user) {
  const userMenuActionId = props.viewModel.getState('userMenuActionId');
  const menuActionId = 'header-user-menu';
  const userMenuOpen = userMenuActionId === menuActionId;
  const menuOptions = props.viewModel.getUserMenuOptions();
  return ActionDropdown({
    actionId: menuActionId,
    open: userMenuOpen,
    onToggle: () => props.viewModel.updateState(
      'userMenuActionId',
      userMenuActionId === menuActionId ? null : menuActionId
    ),
    buttonClass: 'rounded-md px-1.5 py-1 bg-transparent hover:bg-gray-100 text-gray-600 transition-colors duration-150',
    menuClass: 'top-full w-52 py-1',
    trigger: Row({ class: 'flex items-center gap-1' }, [
      renderAvatar(user),
      Row({ class: `w-4 h-4 flex items-center justify-center text-sm text-gray-500 transition-transform duration-200 ease-out ${userMenuOpen ? 'rotate-180' : ''}` }, [
        Row({
          tagType: 'ion-icon',
          class: 'leading-none',
          attributes: { name: 'chevron-down-outline' }
        })
      ])
    ])
  }, menuOptions.map((option) => ActionItem({
    ...option,
    class: option.danger ? 'mt-1 border-t border-gray-300' : '',
    onClick: () => {
      props.viewModel.updateState('userMenuActionId', null);
      option.onClick();
    }
  })));
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
  props.ensureStateKey('user');
  props.ensureStateKey('userMenuActionId');
  
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
 * Header UI Component
 * @returns {HTMLElement} Header component
 */
export default function HeaderUI({ router = null, navigationVM = null } = {}) {
  const viewModel = new HeaderVM(undefined, { router, navigationVM });
  
  return StatefulRow({ viewModel, stateKeys: ['serverHealth', 'dbHealth', 'apiHealth', 'appMode', 'clientConnected', 'clientServerUrl', 'clientConnectionError', 'user', 'userMenuActionId'] }, renderHeader);
}
