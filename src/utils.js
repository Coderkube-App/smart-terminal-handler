const { exec, spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/**
 * Execute a command and return stdout/stderr
 * @param {string} cmd 
 * @param {object} options 
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execAsync(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Spawn a process and stream output/input.
 * Useful for long running commands like npm install or interactive commands.
 * @param {string} cmd 
 * @param {string[]} args 
 * @param {object} options 
 * @returns {Promise<number>} exit code
 */
function spawnAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...options });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      } else {
        resolve(code);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  isWindows,
  isMac,
  isLinux,
  execAsync,
  spawnAsync
};
