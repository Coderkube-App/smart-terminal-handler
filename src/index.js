const { getActivePorts, killPort } = require('./ports');
const { getLocalIPs, getPublicIP, flushDNS, scanPorts, resolveDNS, runSpeedTest } = require('./network');
const { nukeDependencies } = require('./nuke');
const { getSysInfo } = require('./sys');
const { auditGitWorkspace } = require('./git');

module.exports = {
  // Ports
  getActivePorts,
  killPort,

  // Network
  getLocalIPs,
  getPublicIP,
  flushDNS,
  scanPorts,
  resolveDNS,
  runSpeedTest,

  // Dependencies Clean
  nukeDependencies,

  // System
  getSysInfo,

  // Git
  auditGitWorkspace
};
