/**
 * Header component formatters
 * Pure utility functions for formatting header data
 */

/**
 * Get health status from health object
 * @param {Object|null} health - Health status object
 * @returns {Object} Status object with healthy and pulsating flags
 */
export function getHealthStatus(health) {
  if (!health) {
    return { healthy: false, pulsating: false };
  }
  return {
    healthy: health.healthy === true,
    pulsating: health.healthy === true
  };
}

/**
 * Get overall health status from all health checks
 * @param {Object} serverStatus - Server health status
 * @param {Object} dbStatus - Database health status
 * @param {Object} apiStatus - API health status
 * @returns {Object} Overall status with healthy flag and styling classes
 */
export function getOverallHealthStatus(serverStatus, dbStatus, apiStatus) {
  const allHealthy = serverStatus.healthy && dbStatus.healthy && apiStatus.healthy;
  
  return {
    allHealthy,
    pulsatingClass: allHealthy ? 'animate-pulse' : '',
    healthColor: allHealthy ? 'text-red-500' : 'text-gray-400',
    tooltip: `Server: ${serverStatus.healthy ? 'Healthy' : 'Unhealthy'} | Database: ${dbStatus.healthy ? 'Healthy' : 'Unhealthy'} | API: ${apiStatus.healthy ? 'Healthy' : 'Unhealthy'}`
  };
}

/**
 * Generate user initials from display name or username
 * @param {Object|null} user - User object
 * @returns {string} User initials
 */
export function getUserInitials(user) {
  if (!user) return 'G';
  
  if (user.display_name) {
    return user.display_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2); // Max 2 characters
  }
  
  if (user.username) {
    return user.username[0].toUpperCase();
  }
  
  return 'U';
}

/**
 * Get user display name
 * @param {Object|null} user - User object
 * @returns {string} Display name or fallback
 */
export function getUserDisplayName(user) {
  if (!user) return 'Guest';
  return user.display_name || user.username || 'User';
}
