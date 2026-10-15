const os = require('os');

function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({
          interface: name,
          ip: net.address
        });
      }
    }
  }

  // Fallback if no network interface found
  if (ips.length === 0) {
    ips.push({ interface: 'localhost', ip: '127.0.0.1' });
  }

  return ips;
}

module.exports = { getLanIps };
