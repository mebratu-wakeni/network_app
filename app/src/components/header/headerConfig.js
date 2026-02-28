/**
 * Header component configuration
 * Centralizes constants and configuration for the header component
 */

export const HEALTH_ICONS = {
  server: 'server',
  database: 'cube',
  api: 'flash'
};

export const HEALTH_LABELS = {
  server: 'Server',
  database: 'Database',
  api: 'API'
};

export const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

export const HEADER_CLASSES = {
  container: 'h-14 w-full bg-white border-b border-gray-200 shadow-sm px-3 md:px-6 py-2 flex items-center justify-between',
  leftSection: 'flex items-center gap-4',
  healthContainer: 'flex items-center gap-3 ml-2',
  rightSection: 'flex items-center gap-3',
  userName: 'text-gray-700 font-medium',
  avatar: {
    image: 'w-10 h-10 rounded-full object-cover',
    initials: 'w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm'
  }
};

export const HEALTH_STATUS = {
  healthy: {
    color: 'text-red-500',
    pulsating: true
  },
  unhealthy: {
    color: 'text-gray-400',
    pulsating: false
  }
};
