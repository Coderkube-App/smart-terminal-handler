const assert = require('assert');
const api = require('./src/index');

async function runTests() {
  console.log('🧪 Starting smart-terminal-handler Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // --- Utils Test ---
  test('Utils: OS detection variables are defined', () => {
    const utils = require('./src/utils');
    assert.strictEqual(typeof utils.isWindows, 'boolean');
    assert.strictEqual(typeof utils.isMac, 'boolean');
    assert.strictEqual(typeof utils.isLinux, 'boolean');
    assert.strictEqual(utils.isWindows || utils.isMac || utils.isLinux, true);
  });

  await testAsync('Utils: execAsync runs standard commands', async () => {
    const { execAsync } = require('./src/utils');
    const cmd = process.platform === 'win32' ? 'echo hello' : 'echo "hello"';
    const { stdout } = await execAsync(cmd);
    assert.strictEqual(stdout.trim(), 'hello');
  });

  // --- Ports Test ---
  await testAsync('Ports: getActivePorts retrieves array structure', async () => {
    const list = await api.getActivePorts();
    assert.strictEqual(Array.isArray(list), true);
    console.log(`    (Found ${list.length} listening ports)`);
    if (list.length > 0) {
      const first = list[0];
      assert.strictEqual(typeof first.port, 'number');
      assert.strictEqual(typeof first.pid, 'number');
      assert.strictEqual(typeof first.command, 'string');
    }
  });

  // --- Network Test ---
  test('Network: getLocalIPs returns active interfaces', () => {
    const ips = api.getLocalIPs();
    assert.strictEqual(Array.isArray(ips), true);
    console.log(`    (Found ${ips.length} local IPv4 interfaces)`);
    ips.forEach(item => {
      assert.strictEqual(typeof item.interface, 'string');
      assert.strictEqual(typeof item.address, 'string');
    });
  });

  await testAsync('Network: getPublicIP resolves successfully', async () => {
    const ip = await api.getPublicIP();
    assert.strictEqual(typeof ip, 'string');
    // Basic IP shape regex match
    assert.strictEqual(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(ip), true);
    console.log(`    (Public IP is: ${ip})`);
  });

  test('Network: flushDNS has command logic mapping', () => {
    const { isWindows, isMac } = require('./src/utils');
    // DNS flusher mapping checks
    if (isWindows) {
      // Just test compilation of flushDNS logic
      assert.strictEqual(typeof api.flushDNS, 'function');
    }
  });

  // --- Sys Info Test ---
  test('System Info: getSysInfo yields structured dashboard object', () => {
    const info = api.getSysInfo();
    
    // Check OS
    assert.strictEqual(typeof info.os, 'object');
    assert.strictEqual(typeof info.os.platform, 'string');
    assert.strictEqual(typeof info.os.arch, 'string');
    assert.strictEqual(typeof info.os.uptime, 'string');

    // Check CPU
    assert.strictEqual(typeof info.cpu, 'object');
    assert.strictEqual(typeof info.cpu.model, 'string');
    assert.strictEqual(typeof info.cpu.cores, 'number');

    // Check Memory
    assert.strictEqual(typeof info.memory, 'object');
    assert.strictEqual(typeof info.memory.total, 'string');
    assert.strictEqual(typeof info.memory.used, 'string');

    // Check Node details
    assert.strictEqual(typeof info.node, 'object');
    assert.strictEqual(typeof info.node.version, 'string');

    // Check User details
    assert.strictEqual(typeof info.user, 'object');
    assert.strictEqual(typeof info.user.username, 'string');
    assert.strictEqual(typeof info.user.homedir, 'string');
  });

  // --- New Network & Git Tests ---
  await testAsync('Network: scanPorts on 127.0.0.1 resolves successfully', async () => {
    const openPorts = await api.scanPorts('127.0.0.1', [80, 443, 3000]);
    assert.strictEqual(Array.isArray(openPorts), true);
  });

  await testAsync('Network: resolveDNS resolves records for google.com', async () => {
    const records = await api.resolveDNS('google.com');
    assert.strictEqual(typeof records, 'object');
    assert.strictEqual(Array.isArray(records.A) || Array.isArray(records.NS), true);
  });

  await testAsync('Network: runSpeedTest completes and yields correct metrics', async () => {
    const result = await api.runSpeedTest();
    assert.strictEqual(typeof result.speedMbps, 'number');
    assert.strictEqual(typeof result.bytes, 'number');
    assert.strictEqual(result.bytes > 0, true);
    console.log(`    (Latency: ${result.latencyMs}ms, Speed: ${result.speedMbps} Mbps)`);
  });

  await testAsync('Git: auditGitWorkspace audits the current repository', async () => {
    const results = await api.auditGitWorkspace(process.cwd());
    assert.strictEqual(Array.isArray(results), true);
    assert.strictEqual(results.length > 0, true);
    const repo = results[0];
    assert.strictEqual(repo.success, true);
    assert.strictEqual(typeof repo.branch, 'string');
    assert.strictEqual(typeof repo.hasChanges, 'boolean');
  });

  console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDemo = runTests;
runDemo();
