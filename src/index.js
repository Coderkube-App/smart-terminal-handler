const { getActivePorts, killPort } = require('./ports');
const { getLocalIPs, getPublicIP, flushDNS } = require('./network');
const { nukeDependencies } = require('./nuke');
const { getSysInfo } = require('./sys');

module.exports = {
  // Ports
  getActivePorts,
  killPort,

  // Network
  getLocalIPs,
  getPublicIP,
  flushDNS,

  // Dependencies Clean
  nukeDependencies,

  // System
  getSysInfo
};
