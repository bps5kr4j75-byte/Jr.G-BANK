const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test("Jr.G BANK: flujo básico y libro contable", async t => {
  const port = await freePort();
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jrg-bank-test-"));
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir },
    stdio: "ignore"
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;

  try {
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error("El servidor terminó antes de iniciar");
      try {
        const response = await fetch(base + "/health");
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "el servidor debe iniciar");

    await t.test("estado inicial", async () => {
      const response = await fetch(base + "/api/state");
      const state = await response.json();
      assert.equal(response.status, 200);
      assert.equal(state.mode, "DEMO");
      assert.equal(state.accounts.length, 2);
      assert.equal(state.accounts.reduce((sum, account) => sum + account.balance, 0), 0);
    });

    await t.test("abono simulado y transferencia", async () => {
      let response = await fetch(base + "/api/demo-deposit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: "principal", amount: 500 })
      });
      assert.equal(response.status, 200);

      response = await fetch(base + "/api/transfer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "principal", to: "ahorro", amount: 125.50 })
      });
      assert.equal(response.status, 200);

      const state = await (await fetch(base + "/api/state")).json();
      const balances = Object.fromEntries(state.accounts.map(a => [a.id, a.balance]));
      assert.equal(balances.principal, 37450);
      assert.equal(balances.ahorro, 12550);
      assert.equal(state.journal.length, 2);
      for (const entry of state.journal) {
        const debits = entry.entries.reduce((sum, line) => sum + line.debit, 0);
        const credits = entry.entries.reduce((sum, line) => sum + line.credit, 0);
        assert.equal(debits, credits, "cada asiento debe cuadrar");
      }
    });

    await t.test("rechaza saldo insuficiente", async () => {
      const response = await fetch(base + "/api/transfer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "principal", to: "ahorro", amount: 9999 })
      });
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.match(body.error, /Saldo insuficiente/);
    });
  } finally {
    child.kill();
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
