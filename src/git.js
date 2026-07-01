const fs = require('fs');
const path = require('path');
const { execAsync } = require('./utils');

/**
 * Audit a single git repository
 * @param {string} repoPath Absolute path to the git repo
 * @returns {Promise<Object>} Status details
 */
async function auditRepository(repoPath) {
  const name = path.basename(repoPath);
  let branch = 'Unknown';
  let hasChanges = false;
  let ahead = 0;
  let behind = 0;
  let remoteUrl = 'None';
  let hasUpstream = false;

  try {
    // 1. Get current branch
    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
    branch = branchOut.trim();

    // 2. Check for uncommitted/untracked changes
    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: repoPath });
    hasChanges = statusOut.trim().length > 0;

    // 3. Get remote origin URL
    try {
      const { stdout: remoteOut } = await execAsync('git remote get-url origin', { cwd: repoPath });
      remoteUrl = remoteOut.trim();
    } catch (e) {
      // Remote might not exist
    }

    // 4. Check ahead / behind status relative to upstream
    try {
      // Get the name of the upstream tracking branch first
      const { stdout: upstreamOut } = await execAsync('git rev-parse --abbrev-ref @{u}', { cwd: repoPath });
      const upstream = upstreamOut.trim();
      if (upstream) {
        hasUpstream = true;
        // Get ahead/behind counts
        const { stdout: revOut } = await execAsync('git rev-list --left-right --count HEAD...@{u}', { cwd: repoPath });
        const parts = revOut.trim().split(/\s+/);
        if (parts.length === 2) {
          ahead = parseInt(parts[0], 10);
          behind = parseInt(parts[1], 10);
        }
      }
    } catch (e) {
      // No upstream tracking branch (e.g. branch is local-only or no tracking set)
    }

    return {
      name,
      path: repoPath,
      branch,
      hasChanges,
      ahead,
      behind,
      remoteUrl,
      hasUpstream,
      success: true
    };
  } catch (err) {
    return {
      name,
      path: repoPath,
      error: err.message || 'Git execution error',
      success: false
    };
  }
}

/**
 * Scan all subdirectories of a path to find and audit Git repositories
 * @param {string} targetDir Folder containing project directories
 * @returns {Promise<Object[]>} List of audited repository statuses
 */
async function auditGitWorkspace(targetDir = process.cwd()) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory "${targetDir}" does not exist.`);
  }

  // If the target directory itself is a Git repository, audit it directly
  if (fs.existsSync(path.join(targetDir, '.git'))) {
    const res = await auditRepository(targetDir);
    return [res];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const repoPromises = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const repoPath = path.join(targetDir, entry.name);
      const gitPath = path.join(repoPath, '.git');
      if (fs.existsSync(gitPath)) {
        repoPromises.push(auditRepository(repoPath));
      }
    }
  }

  return Promise.all(repoPromises);
}

module.exports = {
  auditGitWorkspace
};
