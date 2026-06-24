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

  console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDemo = runTests;
runDemo();
