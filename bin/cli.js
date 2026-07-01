#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const prompts = require('prompts');
const Table = require('cli-table3');
const path = require('path');
const api = require('../src/index');
const packageJson = require('../package.json');

// --- Handlers ---

async function handleKill(port) {
  try {
    if (!port) {
      console.log(chalk.blue('Scanning active listening TCP ports...'));
      const activePorts = await api.getActivePorts();

      if (activePorts.length === 0) {
        console.log(chalk.yellow('⚠️  No active processes listening on any TCP ports found.'));
        return;
      }

      const response = await prompts({
        type: 'select',
        name: 'port',
        message: 'Which port would you like to terminate?',
        choices: activePorts.map(p => ({
          title: `Port ${p.port} (${p.command}) [PID: ${p.pid}]`,
          value: p.port
        }))
      });

      if (!response.port) {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
      port = response.port;
    }

    console.log(chalk.blue(`Terminating process on port ${port}...`));
    const killed = await api.killPort(port);
    for (const item of killed) {
      console.log(chalk.green(`✔ Successfully terminated process "${item.command}" (PID ${item.pid}) on port ${item.port}`));
    }
  } catch (err) {
    console.error(chalk.red(`✖ Error: ${err.message}`));
    process.exit(1);
  }
}

async function handleIp() {
  try {
    console.log(chalk.blue('Gathering IP addresses...'));
    const locals = api.getLocalIPs();

    const localTable = new Table({
      head: [chalk.cyan('Interface'), chalk.cyan('Local Address')],
      style: { head: [], border: [] }
    });

    locals.forEach(loc => {
      localTable.push([loc.interface, loc.address]);
    });

    console.log(chalk.bold('\n🖥️  Local IPv4 Addresses:'));
    if (locals.length > 0) {
      console.log(localTable.toString());
    } else {
      console.log(chalk.yellow('No local active network interfaces found.'));
    }

    try {
      const publicIp = await api.getPublicIP();
      console.log(chalk.bold('\n🌐 Public IP Address:'));
      console.log(chalk.green(`  ${publicIp}\n`));
    } catch (err) {
      console.log(chalk.bold('\n🌐 Public IP Address:'));
      console.log(chalk.yellow(`  Failed to resolve public IP (${err.message})\n`));
    }
  } catch (err) {
    console.error(chalk.red(`✖ Error: ${err.message}`));
    process.exit(1);
  }
}

async function handleDns() {
  try {
    console.log(chalk.blue('Flushing system DNS cache...'));
    const result = await api.flushDNS();
    if (result.success) {
      console.log(chalk.green(`✔ DNS cache flushed successfully!`));
      console.log(chalk.gray(`Executed: ${result.cmd}`));
    }
  } catch (err) {
    console.error(chalk.red(`✖ Error: ${err.message}`));
    console.log(chalk.yellow('Tip: You may need to run this command with administrative / sudo privileges.'));
    process.exit(1);
  }
}

async function handleNuke(dir, cmdOptions = {}) {
  const targetDir = dir ? path.resolve(dir) : process.cwd();
  const reinstall = cmdOptions.reinstall !== false; // default true
  const deleteLock = cmdOptions.lock !== false; // default true
  const skipPrompt = cmdOptions.yes === true;

  try {
    console.log(chalk.yellow(`⚠️  Target directory: ${targetDir}`));

    if (!skipPrompt) {
      const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to nuke dependency folders in this directory?`,
        initial: false
      });

      if (!confirm.value) {
        console.log(chalk.gray('Nuke cancelled.'));
        return;
      }
    }

    console.log(chalk.blue('Cleaning dependencies...'));
    const result = await api.nukeDependencies(targetDir, {
      reinstall,
      lockfiles: deleteLock
    });

    if (result.deletedPaths.length > 0) {
      console.log(chalk.green('✔ Deleted the following paths:'));
      result.deletedPaths.forEach(p => console.log(chalk.gray(`  - ${p}`)));
    } else {
      console.log(chalk.yellow('No node_modules or lockfiles found to delete.'));
    }

    if (result.reinstalled) {
      console.log(chalk.green(`✔ Successfully reinstalled dependencies using ${result.pm}`));
    } else if (reinstall) {
      console.log(chalk.yellow('Skipped dependency reinstallation (package.json not found).'));
    }
  } catch (err) {
    console.error(chalk.red(`✖ Error: ${err.message}`));
    process.exit(1);
  }
}

async function handleSys() {
  try {
    const info = api.getSysInfo();

    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Details')],
      style: { head: [], border: [] }
    });

    table.push(
      [chalk.bold('OS'), `${info.os.platform} (${info.os.arch}) - ${info.os.release}`],
      [chalk.bold('Hostname'), info.os.hostname],
      [chalk.bold('Uptime'), info.os.uptime],
      [chalk.bold('CPU'), `${info.cpu.model} (${info.cpu.cores} Cores)`],
      [chalk.bold('Memory'), `${info.memory.used} / ${info.memory.total} (${info.memory.percentUsed} used, ${info.memory.free} free)`],
      [chalk.bold('Node Version'), info.node.version],
      [chalk.bold('User'), `${info.user.username} (${info.user.homedir})`]
    );

    console.log(chalk.bold('\n🖥️  System Resource Dashboard:'));
    console.log(table.toString() + '\n');
  } catch (err) {
    console.error(chalk.red(`✖ Error: ${err.message}`));
    process.exit(1);
  }
}

// Map common ports to service names
function getServiceName(port) {
  const mapping = {
    21: 'FTP (File Transfer)',
    22: 'SSH (Secure Shell)',
    23: 'Telnet',
    25: 'SMTP (Simple Mail Transfer)',
    53: 'DNS (Domain Name System)',
    80: 'HTTP (Web Server)',
    110: 'POP3 (Email)',
    135: 'RPC (Microsoft)',
    139: 'NetBIOS',
    143: 'IMAP (Email)',
    443: 'HTTPS (Secure Web Server)',
    445: 'SMB (File Sharing)',
    1433: 'Microsoft SQL Server',
    3000: 'Node.js Dev Server',
    3306: 'MySQL Database',
    3389: 'RDP (Remote Desktop)',
    5432: 'PostgreSQL Database',
    8080: 'HTTP Alternate / Dev',
    8081: 'HTTP Alternate / Dev'
  };
  return mapping[port] || 'Custom Service';
}

async function handleNetScan(host) {
  const targetHost = host || '127.0.0.1';
  console.log(chalk.blue(`Scanning common ports on ${chalk.bold(targetHost)}...`));
  try {
    const openPorts = await api.scanPorts(targetHost);
    
    if (openPorts.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No open ports detected in the standard scan ranges on ${targetHost}.\n`));
      return;
    }

    const table = new Table({
      head: [chalk.cyan('Port'), chalk.cyan('Status'), chalk.cyan('Service / Description')],
      style: { head: [], border: [] }
    });

    openPorts.forEach(p => {
      table.push([
        chalk.green(p.port),
        chalk.bold.green('OPEN'),
        getServiceName(p.port)
      ]);
    });

    console.log(chalk.bold(`\n🔌 Open Ports on ${targetHost}:`));
    console.log(table.toString() + '\n');
  } catch (err) {
    console.error(chalk.red(`✖ Error scanning ports: ${err.message}`));
    process.exit(1);
  }
}

async function handleNetLookup(domain) {
  if (!domain) {
    console.error(chalk.red('✖ Error: Please specify a domain name (e.g. google.com)'));
    process.exit(1);
  }
  
  console.log(chalk.blue(`Resolving DNS records for ${chalk.bold(domain)}...`));
  try {
    const records = await api.resolveDNS(domain);
    
    const table = new Table({
      head: [chalk.cyan('Type'), chalk.cyan('Resolved Records')],
      style: { head: [], border: [] }
    });

    let foundAny = false;
    Object.keys(records).forEach(type => {
      const value = records[type];
      if (value && (Array.isArray(value) ? value.length > 0 : value)) {
        foundAny = true;
        let displayVal = '';
        if (type === 'MX') {
          displayVal = value.map(mx => `${mx.exchange} (priority: ${mx.priority})`).join('\n');
        } else if (Array.isArray(value)) {
          displayVal = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join('\n');
        } else {
          displayVal = value;
        }
        table.push([chalk.bold.yellow(type), displayVal]);
      }
    });

    if (!foundAny) {
      console.log(chalk.yellow(`\n⚠️  No active records found for ${domain}.\n`));
      return;
    }

    console.log(chalk.bold(`\n📡 DNS Query Results for ${domain}:`));
    console.log(table.toString() + '\n');
  } catch (err) {
    console.error(chalk.red(`✖ Error looking up DNS: ${err.message}`));
    process.exit(1);
  }
}

async function handleNetSpeed() {
  console.log(chalk.blue('Running network performance diagnostics...'));
  console.log(chalk.gray('  - Ping testing nearest DNS/CDN nodes...'));
  console.log(chalk.gray('  - Downloading 1MB test payload from Cloudflare edge server...'));
  
  try {
    const result = await api.runSpeedTest();
    
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: [], border: [] }
    });

    table.push(
      [chalk.bold('Ping / Latency'), result.latencyMs ? `${result.latencyMs} ms` : chalk.yellow('Unknown')],
      [chalk.bold('Download Speed'), chalk.green(`${result.speedMbps} Mbps`) + chalk.gray(` (${result.speedMBps} MB/s)`)],
      [chalk.bold('Downloaded Payload'), `${(result.bytes / (1024 * 1024)).toFixed(2)} MB`],
      [chalk.bold('Measurement Time'), `${(result.durationMs / 1000).toFixed(2)}s`]
    );

    console.log(chalk.bold('\n⚡ Speed Test Results:'));
    console.log(table.toString() + '\n');
  } catch (err) {
    console.error(chalk.red(`✖ Speed test failed: ${err.message}`));
    process.exit(1);
  }
}

async function handleGit(dir) {
  const targetDir = dir ? path.resolve(dir) : process.cwd();
  console.log(chalk.blue(`Auditing Git repositories in ${chalk.bold(targetDir)}...`));
  
  try {
    const results = await api.auditGitWorkspace(targetDir);

    if (results.length === 0) {
      console.log(chalk.yellow('\n⚠️  No Git repositories found in this directory.\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Repository'),
        chalk.cyan('Branch'),
        chalk.cyan('Local Status'),
        chalk.cyan('Sync Status'),
        chalk.cyan('Remote URL')
      ],
      style: { head: [], border: [] }
    });

    results.forEach(repo => {
      if (!repo.success) {
        table.push([
          chalk.red(`✖ ${repo.name}`),
          chalk.gray('-'),
          chalk.red('Git Error'),
          chalk.gray('-'),
          chalk.gray(repo.error)
        ]);
        return;
      }

      const nameVal = chalk.bold(repo.name);
      const branchVal = chalk.magenta(repo.branch);
      const localVal = repo.hasChanges ? chalk.yellow('Uncommitted Changes') : chalk.green('Clean');
      
      let syncVal = '';
      if (!repo.hasUpstream) {
        syncVal = chalk.gray('No Upstream');
      } else if (repo.ahead === 0 && repo.behind === 0) {
        syncVal = chalk.green('Up to date');
      } else {
        const parts = [];
        if (repo.ahead > 0) parts.push(chalk.blue(`Ahead by ${repo.ahead}`));
        if (repo.behind > 0) parts.push(chalk.red(`Behind by ${repo.behind}`));
        syncVal = parts.join(', ');
      }

      const remoteVal = repo.remoteUrl !== 'None' ? chalk.gray(repo.remoteUrl) : chalk.gray('None');

      table.push([nameVal, branchVal, localVal, syncVal, remoteVal]);
    });

    console.log(chalk.bold(`\n🔍 Git Workspace Status Overview:`));
    console.log(table.toString() + '\n');
  } catch (err) {
    console.error(chalk.red(`✖ Error auditing git workspace: ${err.message}`));
    process.exit(1);
  }
}

async function runInteractiveMenu() {
  console.log(chalk.bold.magenta('\n⚡ Welcome to Smart Terminal Handler (sth) ⚡\n'));

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: '🔌 Kill a Port (terminates process running on port)', value: 'kill' },
      { title: '📡 Network Tools (Port scan, DNS Lookup, Speed test)', value: 'netMenu' },
      { title: '🔄 Flush DNS Cache (cleans system DNS entries)', value: 'dns' },
      { title: '💣 Nuke dependency folders (removes node_modules / lockfiles)', value: 'nuke' },
      { title: '🔍 Git Workspace Auditor (Audit local repos status)', value: 'git' },
      { title: '📊 System Resource Dashboard (CPU, RAM, Node version)', value: 'sys' },
      { title: '📡 Show IP Info (local network and public IP)', value: 'ip' },
      { title: '❌ Exit', value: 'exit' }
    ]
  });

  if (!response.action || response.action === 'exit') {
    console.log(chalk.gray('Goodbye!'));
    return;
  }

  switch (response.action) {
    case 'kill':
      await handleKill();
      break;
    case 'ip':
      await handleIp();
      break;
    case 'dns':
      await handleDns();
      break;
    case 'nuke':
      await handleNuke();
      break;
    case 'sys':
      await handleSys();
      break;
    case 'git': {
      const gitRes = await prompts({
        type: 'text',
        name: 'dir',
        message: 'Target directory to audit (default: current directory):',
        initial: '.'
      });
      await handleGit(gitRes.dir);
      break;
    }
    case 'netMenu': {
      const netResponse = await prompts({
        type: 'select',
        name: 'tool',
        message: 'Select a network tool:',
        choices: [
          { title: '🔌 Port Scanner (Scan common ports on a host)', value: 'scan' },
          { title: '🔍 DNS lookup (Resolve multiple DNS record types)', value: 'lookup' },
          { title: '⚡ Speed test (Test download speed & ping)', value: 'speed' },
          { title: '⬅ Back to Main Menu', value: 'back' }
        ]
      });

      if (!netResponse.tool || netResponse.tool === 'back') {
        await runInteractiveMenu();
        return;
      }

      if (netResponse.tool === 'scan') {
        const scanRes = await prompts({
          type: 'text',
          name: 'host',
          message: 'Target host to scan:',
          initial: '127.0.0.1'
        });
        await handleNetScan(scanRes.host);
      } else if (netResponse.tool === 'lookup') {
        const lookupRes = await prompts({
          type: 'text',
          name: 'domain',
          message: 'Domain name to resolve records for (e.g. google.com):'
        });
        if (lookupRes.domain) {
          await handleNetLookup(lookupRes.domain);
        } else {
          console.log(chalk.yellow('Domain cannot be empty.'));
        }
      } else if (netResponse.tool === 'speed') {
        await handleNetSpeed();
      }
      break;
    }
  }
}

// --- CLI Commander Configuration ---

program
  .name('sth')
  .description('Smart Terminal Handler - cross-platform developer tools')
  .version(packageJson.version);

program
  .command('kill [port]')
  .description('Terminate the process listening on a port')
  .action((port) => handleKill(port));

program
  .command('ip')
  .description('Show local and public IP addresses')
  .action(() => handleIp());

program
  .command('dns')
  .description('Flush the system DNS cache')
  .action(() => handleDns());

program
  .command('nuke [dir]')
  .description('Recursively delete node_modules & lockfiles, and run clean reinstall')
  .option('--no-reinstall', 'Do not run package manager install after cleaning')
  .option('--no-lock', 'Do not delete lockfiles (keep package-lock.json, yarn.lock, etc.)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action((dir, cmdOptions) => handleNuke(dir, cmdOptions));

program
  .command('sys')
  .description('Show system resources and environment dashboard')
  .action(() => handleSys());

const netCmd = program
  .command('net')
  .description('Network diagnostic utilities (scan, lookup, speed)');

netCmd
  .command('scan [host]')
  .description('Scan common ports on a target host')
  .action((host) => handleNetScan(host));

netCmd
  .command('lookup <domain>')
  .description('Resolve DNS records for a domain')
  .action((domain) => handleNetLookup(domain));

netCmd
  .command('speed')
  .description('Run download speed and ping test')
  .action(() => handleNetSpeed());

program
  .command('git [dir]')
  .description('Audit Git repositories inside the target directory')
  .action((dir) => handleGit(dir));

// Run
if (!process.argv.slice(2).length) {
  runInteractiveMenu();
} else {
  program.parse(process.argv);
}
