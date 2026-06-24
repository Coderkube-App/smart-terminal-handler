const os = require('os');

/**
 * Returns formatted bytes to human readable format (GB, MB)
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

/**
 * Returns seconds to human readable duration
 * @param {number} seconds 
 * @returns {string}
 */
function formatDuration(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(' ');
}

/**
 * Retrieves a detailed overview of the current system resources and environment.
 * @returns {object}
 */
function getSysInfo() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
  const cpuCores = cpus.length;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

  // Platform mapping for user-friendly display
  let platformDisplay = os.platform();
  if (platformDisplay === 'win32') platformDisplay = 'Windows';
  else if (platformDisplay === 'darwin') platformDisplay = 'macOS';
  else if (platformDisplay === 'linux') platformDisplay = 'Linux';

  return {
    os: {
      platform: platformDisplay,
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: formatDuration(os.uptime())
    },
    cpu: {
      model: cpuModel,
      cores: cpuCores
    },
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(usedMem),
      percentUsed: `${memUsagePercent}%`
    },
    node: {
      version: process.version,
      env: process.env.NODE_ENV || 'development'
    },
    user: {
      username: (() => {
        try {
          return os.userInfo().username;
        } catch (e) {
          return process.env.USER || process.env.USERNAME || 'Unknown';
        }
      })(),
      homedir: (() => {
        try {
          return os.homedir();
        } catch (e) {
          return process.env.HOME || process.env.USERPROFILE || '';
        }
      })()
    }
  };
}

module.exports = {
  getSysInfo
};
