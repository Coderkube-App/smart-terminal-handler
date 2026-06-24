const { execAsync, isWindows } = require('./utils');

/**
 * Get active listening ports and their associated PIDs/process names
 * @returns {Promise<Array<{port: number, pid: number, command: string}>>}
 */
async function getActivePorts() {
  const portsList = [];

  try {
    if (isWindows) {
      // 1. Run netstat to get listening TCP ports
      const { stdout: netstatOut } = await execAsync('netstat -ano');
      const lines = netstatOut.split('\n');
      const pidSet = new Set();
      const portPidMap = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP') && !trimmed.startsWith('UDP')) continue;

        const parts = trimmed.split(/\s+/);
        // We only care about LISTENING TCP ports
        if (parts[0] === 'TCP' && parts[3] === 'LISTENING') {
          const localAddr = parts[1]; // e.g. 0.0.0.0:3000 or [::]:3000
          const pid = parseInt(parts[4], 10);
          if (isNaN(pid)) continue;

          const lastColon = localAddr.lastIndexOf(':');
          if (lastColon === -1) continue;
          const port = parseInt(localAddr.slice(lastColon + 1), 10);

          if (!isNaN(port)) {
            portPidMap.push({ port, pid });
            pidSet.add(pid);
          }
        }
      }

      if (portPidMap.length === 0) return [];

      // 2. Run tasklist to map PIDs to Process Names
      const pidToName = {};
      try {
        const { stdout: tasklistOut } = await execAsync('tasklist /FO CSV /NH');
        const taskLines = tasklistOut.split('\n');
        for (const taskLine of taskLines) {
          // Format: "Image Name","PID","Session Name","Session#","Mem Usage"
          const match = taskLine.match(/"([^"]+)"\s*,\s*"([^"]+)"/);
          if (match) {
            const name = match[1];
            const pidVal = parseInt(match[2], 10);
            pidToName[pidVal] = name;
          }
        }
      } catch (err) {
        // Fallback if tasklist fails
      }

      for (const item of portPidMap) {
        portsList.push({
          port: item.port,
          pid: item.pid,
          command: pidToName[item.pid] || 'Unknown'
        });
      }
    } else {
      // macOS / Linux
      // Using lsof to get listening ports
      const { stdout } = await execAsync('lsof -i -P -n -sTCP:LISTEN');
      const lines = stdout.split('\n');

      for (let i = 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 9) continue;

        const command = parts[0];
        const pid = parseInt(parts[1], 10);
        const nameCol = parts[8]; // e.g. *:3000 or 127.0.0.1:3000

        const lastColon = nameCol.lastIndexOf(':');
        if (lastColon === -1) continue;
        const port = parseInt(nameCol.slice(lastColon + 1), 10);

        if (!isNaN(port) && !isNaN(pid)) {
          portsList.push({ port, pid, command });
        }
      }
    }
  } catch (err) {
    // If commands aren't available or fail, we return empty
  }

  // Deduplicate by port
  const seen = new Set();
  return portsList.filter(item => {
    if (seen.has(item.port)) return false;
    seen.add(item.port);
    return true;
  }).sort((a, b) => a.port - b.port);
}

/**
 * Kill process(es) listening on a port
 * @param {number} port 
 * @returns {Promise<{pid: number, command: string}[]>} List of terminated processes
 */
async function killPort(port) {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum)) {
    throw new Error('Invalid port number');
  }

  // Find process on port
  const activeList = await getActivePorts();
  const targets = activeList.filter(item => item.port === portNum);

  if (targets.length === 0) {
    throw new Error(`No active process found listening on port ${portNum}`);
  }

  for (const target of targets) {
    if (isWindows) {
      await execAsync(`taskkill /F /PID ${target.pid}`);
    } else {
      await execAsync(`kill -9 ${target.pid}`);
    }
  }

  return targets;
}

module.exports = {
  getActivePorts,
  killPort
};
