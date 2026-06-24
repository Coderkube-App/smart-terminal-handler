# smart-terminal-handler

A cross-platform Command Line Interface (CLI) and programmatic Node.js utility designed to simplify daily developer terminal operations. It transparently maps human-friendly commands to OS-specific terminal routines for Windows, macOS, and Linux.

![Smart Terminal Handler Demo](assets/cli_demo.svg)

---

## Features

- 🔌 **Smart Port Killer**: Terminate zombie processes occupying development ports (e.g. `3000`). Maps automatically to platform-native commands (`lsof`/`kill` on macOS/Linux, `netstat`/`taskkill` on Windows).
- 🧭 **Interactive CLI Wizard**: Run `sth` without arguments to access an interactive menu powered by terminal prompts.
- 📡 **IP Address Lookup**: View local IPv4 network interface addresses and resolve your public IP instantly in a clean terminal layout.
- 🔄 **DNS Cache Flusher**: Flush DNS caching configurations across Windows, macOS, and Linux systems.
- 💣 **Dependency Nuker**: Wipe out `node_modules` and lock files recursively. Uses high-performance native deletion commands (e.g., `rmdir` on Windows) and automates a clean dependency reinstall via `npm`, `yarn`, or `pnpm`.
- 📊 **System Resource Dashboard**: Quick check of CPU, memory, OS version, Node.js version, and system uptime in a beautiful terminal table.

---

## Installation

You can run the utility instantly using `npx`:

```bash
npx smart-terminal-handler <command>
```

Or install it globally to register the `sth` command alias:

```bash
npm install -g smart-terminal-handler
```

---

## CLI Usage

If you run the CLI without arguments, `sth` will launch an **interactive guided wizard**:

```bash
sth
```

### Supported CLI Commands

#### 1. Terminate Port (`kill`)
Terminate processes listening on a target TCP port.
```bash
# Terminate port 3000
sth kill 3000

# Open interactive selector showing all active listening ports
sth kill
```

#### 2. Clean Dependencies (`nuke`)
Recursively delete `node_modules` and lockfiles in the current directory and run a clean reinstall.
```bash
# Clean directory and reinstall (prompts for confirmation)
sth nuke

# Skip confirmation prompt (-y / --yes)
sth nuke -y

# Clean without re-running dependency install
sth nuke --no-reinstall

# Clean but preserve lockfiles
sth nuke --no-lock
```

#### 3. View IP Configuration (`ip`)
Display your local network configuration and resolve your current public IP.
```bash
sth ip
```

#### 4. Flush System DNS (`dns`)
Flush the host machine's DNS caching layer.
```bash
sth dns
```

#### 5. System Resource Dashboard (`sys`)
View real-time statistics regarding your CPU architecture, memory utilization, Node version, and system uptime.
```bash
sth sys
```

---

## Programmatic API

You can import `smart-terminal-handler` as a dependency in your projects (e.g., to build automation scripts, dev tasks, or pipelines).

```bash
npm install smart-terminal-handler
```

### Examples

```javascript
const { killPort, getActivePorts, getLocalIPs, getPublicIP, flushDNS, getSysInfo } = require('smart-terminal-handler');

// 1. Terminate a port
killPort(3000)
  .then((killed) => {
    killed.forEach(proc => console.log(`Killed PID ${proc.pid} (${proc.command})`));
  })
  .catch((err) => console.error(err.message));

// 2. Fetch IP addresses
getLocalIPs().forEach(iface => {
  console.log(`Interface ${iface.interface}: ${iface.address}`);
});

getPublicIP().then(ip => console.log(`Public IP: ${ip}`));

// 3. Flush system DNS
flushDNS().then(result => {
  console.log(`Flushed DNS using command: ${result.cmd}`);
});
```

---

## License

ISC License. Free to use and distribute.
