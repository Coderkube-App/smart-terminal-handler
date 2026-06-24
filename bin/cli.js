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

async function runInteractiveMenu() {
  console.log(chalk.bold.magenta('\n⚡ Welcome to Smart Terminal Handler (sth) ⚡\n'));

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: '🔌 Kill a Port (terminates process running on port)', value: 'kill' },
      { title: '📡 Show IP Info (local network and public IP)', value: 'ip' },
      { title: '🔄 Flush DNS Cache (cleans system DNS entries)', value: 'dns' },
      { title: '💣 Nuke dependency folders (removes node_modules / lockfiles)', value: 'nuke' },
      { title: '📊 System Resource Dashboard (CPU, RAM, Node version)', value: 'sys' },
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

// Run
if (!process.argv.slice(2).length) {
  runInteractiveMenu();
} else {
  program.parse(process.argv);
}
