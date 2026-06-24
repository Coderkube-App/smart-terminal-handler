const os = require('os');
const https = require('https');
const { execAsync, isWindows, isMac } = require('./utils');

/**
 * Get all local IPv4 network interface addresses
 * @returns {Array<{interface: string, address: string}>}
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // We only care about non-internal IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push({
          interface: name,
          address: iface.address
        });
      }
    }
  }

  return results;
}

/**
 * Query public IP address using native HTTPS
 * @returns {Promise<string>}
 */
function getPublicIP() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.ipify.org',
      port: 443,
      path: '/?format=json',
      method: 'GET',
      timeout: 3000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.ip);
        } catch (e) {
          reject(new Error('Failed to parse public IP response'));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Public IP lookup request timed out'));
    });

    req.end();
  });
}

/**
 * Flush DNS cache depending on the OS
 * @returns {Promise<{success: boolean, cmd: string, output: string}>}
 */
async function flushDNS() {
  let cmd = '';

  if (isWindows) {
    cmd = 'ipconfig /flushdns';
  } else if (isMac) {
    cmd = 'sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder';
  } else {
    // Linux
    // Attempt resolvectl first, fallback to systemd-resolve
    try {
      await execAsync('which resolvectl');
      cmd = 'sudo resolvectl flush-caches';
    } catch (e) {
      try {
        await execAsync('which systemd-resolve');
        cmd = 'sudo systemd-resolve --flush-caches';
      } catch (err) {
        cmd = 'sudo /etc/init.d/dns-clean restart';
      }
    }
  }

  try {
    const { stdout, stderr } = await execAsync(cmd);
    return {
      success: true,
      cmd,
      output: (stdout + '\n' + stderr).trim()
    };
  } catch (err) {
    // If it fails because of sudo requirements or missing command, throw a descriptive error
    const msg = err.stderr || err.message;
    throw new Error(`Failed to flush DNS cache using "${cmd}": ${msg}`);
  }
}

module.exports = {
  getLocalIPs,
  getPublicIP,
  flushDNS
};
