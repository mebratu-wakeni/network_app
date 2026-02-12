/**
 * Header UI Component
 * Displays application header with health indicators and user info
 */
const { Row, StatefulRow } = Liteframe;
import HeaderVM from './HeaderVM.js';
import { IconButton, IonIcon } from '../utils/Icon.js';
import { getApiAsset } from '../../../electron/config/apiConfig.js';
import Avatar from '../utils/Avatar.js';
import {
  HEALTH_ICONS,
  HEADER_CLASSES,
  HEALTH_CHECK_INTERVAL
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
 * Render user info section
 * @param {Object} user - User object
 * @returns {HTMLElement} User info container
 */
function renderUserInfo(user) {
  const displayName = user?.display_name || user?.name || 'User';
  
  return Row({ class: HEADER_CLASSES.rightSection }, [
    Row({ tagType: 'span', class: HEADER_CLASSES.userName }, displayName),
    renderAvatar(user)
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
  props.ensureStateKey('user');
  
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
    renderUserInfo(user)
  ]);
}

/**
 * Header UI Component
 * @returns {HTMLElement} Header component
 */
export default function HeaderUI() {
  const viewModel = new HeaderVM();
  
  return StatefulRow({ viewModel }, renderHeader);
}
