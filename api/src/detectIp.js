import os from 'os';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal addresses and IPv6
      if (!iface.internal && iface.family === 'IPv4') {
        // Collect all valid IPs (not just the first one)
        results.push({
          name: name,
          address: iface.address
        });
      }
    }
  }

  console.log('Available network interfaces:', results); // Debug log

  // Return the first non-localhost IP, or fallback to localhost
  for (const result of results) {
    if (result.address !== '127.0.0.1') {
      return result.address;
    }
  }

  // Fallback to localhost (only if no LAN IPs found)
  return '127.0.0.1';
}

// Use it in your server
const serverIP = getLocalIP();



// Export the IP for use elsewhere
export { serverIP };