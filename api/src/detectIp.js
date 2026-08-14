// detectIp.js
import os from 'os';

/**
 * Get local IP address for LAN access
 * Prioritizes: Ethernet > WiFi > Other interfaces > localhost
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  // Priority order: prefer ethernet, then wifi, then others
  const interfacePriority = {
    'en0': 1,      // macOS Ethernet
    'eth0': 1,     // Linux Ethernet
    'en1': 2,      // macOS WiFi
    'wlan0': 2,    // Linux WiFi
    'wifi0': 2     // Alternative WiFi
  };

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal addresses and IPv6
      // Note: iface.family can be 'IPv4' (string) or 4 (number) depending on Node.js version
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      
      if (!iface.internal && isIPv4) {
        const priority = interfacePriority[name] || 99;
        candidates.push({
          name: name,
          address: iface.address,
          priority: priority
        });
      }
    }
  }

  // Sort by priority (lower is better), then by interface name
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.name.localeCompare(b.name);
  });

  if (candidates.length > 0) {
    const selected = candidates[0];
    // eslint-disable-next-line no-console
    console.log(`📡 Selected network interface: ${selected.name} (${selected.address})`)
    if (candidates.length > 1) {
      // eslint-disable-next-line no-console
      console.log(`   Other available interfaces: ${candidates.slice(1).map(c => `${c.name} (${c.address})`).join(', ')}`)
    }
    return selected.address;
  }

  // Fallback to localhost if no LAN IPs found
  // eslint-disable-next-line no-console
  console.log('⚠️  No LAN IP found, using localhost. Server will only be accessible locally.')
  return '127.0.0.1';
}

// Detect IP at module load
const serverIP = getLocalIP();

// Export the IP for use elsewhere
export { serverIP };