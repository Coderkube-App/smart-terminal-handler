const os = require('os');
const https = require('https');
const net = require('net');
const dns = require('dns').promises;
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

/**
 * Check if a specific TCP port is open on a host
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<{port: number, status: string}>}
 */
function checkPort(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'closed';

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      status = 'open';
      socket.destroy();
    });

    socket.on('timeout', () => {
      status = 'timeout';
      socket.destroy();
    });

    socket.on('error', () => {
      status = 'closed';
      socket.destroy();
    });

    socket.on('close', () => {
      resolve({ port, status });
    });

    socket.connect(port, host);
  });
}

/**
 * Scan a list of ports on a target host with concurrency control
 * @param {string} host
 * @param {number[]} [customPorts]
 * @returns {Promise<Array<{port: number, status: string}>>}
 */
async function scanPorts(host = '127.0.0.1', customPorts = null) {
  const ports = customPorts || [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3000, 3306, 3389, 5432, 8080, 8081];
  const results = [];
  const concurrency = 30;

  for (let i = 0; i < ports.length; i += concurrency) {
    const chunk = ports.slice(i, i + concurrency);
    const promises = chunk.map(port => checkPort(host, port));
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }

  return results.filter(r => r.status === 'open');
}

/**
 * Resolve various DNS records for a domain
 * @param {string} domain
 * @returns {Promise<Object>} DNS records mapped by type
 */
async function resolveDNS(domain) {
  const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS'];
  const results = {};

  await Promise.all(recordTypes.map(async (type) => {
    try {
      let records;
      if (type === 'CNAME') {
        records = await dns.resolveCname(domain);
      } else {
        records = await dns.resolve(domain, type);
      }
      results[type] = records;
    } catch (err) {
      // ENODATA or ENOTFOUND is normal when record type is missing
      results[type] = null;
    }
  }));

  return results;
}

/**
 * Measure latency to Cloudflare
 * @returns {Promise<number|null>}
 */
function getLatency() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get('https://speed.cloudflare.com/cdn-cgi/trace', { timeout: 2000 }, (res) => {
      res.resume(); // consume response
      resolve(Date.now() - start);
    });
    req.on('error', () => {
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Run a speed test downloading 1MB payload from nearest CDN node
 * @returns {Promise<Object>}
 */
async function runSpeedTest() {
  const latency = await getLatency();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let bytesReceived = 0;

    const req = https.get('https://speed.cloudflare.com/__down?bytes=1048576', { timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download speed test file: Status ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
      });

      res.on('end', () => {
        const durationMs = Date.now() - start;
        const durationSec = durationMs / 1000;
        const mb = bytesReceived / (1024 * 1024);
        const mbps = (mb * 8) / durationSec; // megabits per second

        resolve({
          latencyMs: latency,
          bytes: bytesReceived,
          durationMs,
          speedMbps: parseFloat(mbps.toFixed(2)),
          speedMBps: parseFloat((mb / durationSec).toFixed(2))
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Speed test download timed out'));
    });
  });
}

module.exports = {
  getLocalIPs,
  getPublicIP,
  flushDNS,
  scanPorts,
  resolveDNS,
  runSpeedTest
};
