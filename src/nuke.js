const fs = require('fs');
const path = require('path');
const { execAsync, spawnAsync, isWindows } = require('./utils');

/**
 * Remove a file or directory recursively
 * @param {string} targetPath 
 */
async function forceRemove(targetPath) {
  if (!fs.existsSync(targetPath)) return;

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    if (isWindows) {
      // Fast native directory deletion on Windows
      // Use double quotes around path to handle spaces
      await execAsync(`rmdir /s /q "${targetPath}"`);
    } else {
      await execAsync(`rm -rf "${targetPath}"`);
    }
  } else {
    fs.unlinkSync(targetPath);
  }
}

/**
 * Nukes dependency folders (like node_modules) and lockfiles, then optionally runs clean install.
 * @param {string} dir Target directory (defaults to process.cwd())
 * @param {object} options Options
 * @param {boolean} options.reinstall Reinstall packages after nuking
 * @param {boolean} options.lockfiles Also delete lockfiles
 * @returns {Promise<{deletedPaths: string[], reinstalled: boolean, pm: string|null}>}
 */
async function nukeDependencies(dir = process.cwd(), options = {}) {
  const reinstall = options.reinstall !== false; // default true
  const deleteLockfiles = options.lockfiles !== false; // default true

  const nodeModulesPath = path.join(dir, 'node_modules');
  const lockfiles = [
    { name: 'package-lock.json', pm: 'npm' },
    { name: 'yarn.lock', pm: 'yarn' },
    { name: 'pnpm-lock.yaml', pm: 'pnpm' }
  ];

  const deletedPaths = [];
  let detectedPm = 'npm'; // Default fallback

  // 1. Detect package manager from existing lockfiles before deleting them
  for (const lf of lockfiles) {
    const lfPath = path.join(dir, lf.name);
    if (fs.existsSync(lfPath)) {
      detectedPm = lf.pm;
      break;
    }
  }

  // 2. Delete node_modules
  if (fs.existsSync(nodeModulesPath)) {
    await forceRemove(nodeModulesPath);
    deletedPaths.push(nodeModulesPath);
  }

  // 3. Delete lockfiles
  if (deleteLockfiles) {
    for (const lf of lockfiles) {
      const lfPath = path.join(dir, lf.name);
      if (fs.existsSync(lfPath)) {
        await forceRemove(lfPath);
        deletedPaths.push(lfPath);
      }
    }
  }

  let reinstalled = false;

  // 4. Reinstall dependencies
  if (reinstall) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const installArgs = detectedPm === 'yarn' ? [] : ['install'];
      await spawnAsync(detectedPm, installArgs, { cwd: dir });
      reinstalled = true;
    } else {
      throw new Error(`Cannot reinstall dependencies: package.json not found in ${dir}`);
    }
  }

  return {
    deletedPaths,
    reinstalled,
    pm: reinstalled ? detectedPm : null
  };
}

module.exports = {
  nukeDependencies
};
