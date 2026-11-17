const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

async function freePort() {
  return await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

test("API: saldos, abono simulado, transferencia y libro contable", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "jrg-bank-test-"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATA_DIR: dataDir },
    stdio: "ignore"
  });

  async function waitForServer() {
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error("El servidor terminó antes de iniciar");
      try {
        const response = await fetch(base + "/health");
        if (response.ok) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("El servidor no inició a tiempo");
  }

  async function api(route, body) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    await waitForServer();

    const initial = await api("/api/state");
    assert.equal(initial.status, 200);
    assert.equal(initial.data.mode, "DEMO");
    assert.equal(initial.data.accounts.reduce((sum, account) => sum + account.balance, 0), 0);

    const deposit = await api("/api/demo-deposit", { accountId: "principal", amount: 500 });
    assert.equal(deposit.status, 200);
    assert.equal(deposit.data.state.accounts.find(a => a.id === "principal").balance, 50000);

    const transfer = await api("/api/transfer", { from: "principal", to: "ahorro", amount: 125 });
    assert.equal(transfer.status, 200);
    assert.equal(transfer.data.accounts.find(a => a.id === "principal").balance, 37500);
    assert.equal(transfer.data.accounts.find(a => a.id === "ahorro").balance, 12500);

    const rejected = await api("/api/transfer", { from: "principal", to: "ahorro", amount: 999 });
    assert.equal(rejected.status, 400);
    assert.match(rejected.data.error, /Saldo insuficiente/);

    const finalState = await api("/api/state");
    for (const movement of finalState.data.journal) {
      const debit = movement.entries.reduce((sum, entry) => sum + entry.debit, 0);
      const credit = movement.entries.reduce((sum, entry) => sum + entry.credit, 0);
      assert.equal(debit, credit, "Cada asiento debe cuadrar");
    }
  } finally {
    child.kill();
    await rm(dataDir, { recursive: true, force: true });
  }
});
