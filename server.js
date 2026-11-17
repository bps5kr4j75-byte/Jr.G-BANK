const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "ledger.json");

function initialDb() {
  return {
    accounts: [
      { id: "principal", name: "Cuenta principal", type: "wallet", balance: 0 },
      { id: "ahorro", name: "Ahorro Jr.G", type: "wallet", balance: 0 }
    ],
    journal: [],
    createdAt: new Date().toISOString()
  };
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialDb(), null, 2));

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function writeDb(db) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 10000) reject(new Error("Solicitud demasiado grande"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}
function record(db, description, entries, metadata = {}) {
  const debit = entries.reduce((n, e) => n + (e.debit || 0), 0);
  const credit = entries.reduce((n, e) => n + (e.credit || 0), 0);
  if (debit !== credit) throw new Error("Asiento descuadrado");
  db.journal.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    description,
    entries,
    metadata
  });
}
function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1000000) return null;
  return Math.round(n * 100);
}
function serveFile(res, file, type) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: "Archivo no encontrado" });
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      const db = readDb();
      return send(res, 200, {
        product: "Jr.G BANK",
        mode: "DEMO",
        currency: "MXN",
        accounts: db.accounts,
        journal: db.journal.slice(0, 30),
        notice: "Saldo de prueba. No representa dinero real ni un depósito bancario."
      });
    }

    if (req.method === "POST" && url.pathname === "/api/demo-deposit") {
      const body = await readBody(req);
      const amount = cents(body.amount);
      if (!amount) return send(res, 400, { error: "Indica un monto válido en pesos." });
      const db = readDb();
      const account = db.accounts.find(a => a.id === body.accountId);
      if (!account) return send(res, 404, { error: "Cuenta no encontrada." });
      account.balance += amount;
      record(db, "Abono simulado de prueba", [
        { account: "asset:demo_cash", debit: amount, credit: 0 },
        { account: "liability:" + account.id, debit: 0, credit: amount }
      ], { accountId: account.id, amountCents: amount, simulated: true });
      writeDb(db);
      return send(res, 200, { ok: true, state: { accounts: db.accounts, journal: db.journal.slice(0, 30) } });
    }

    if (req.method === "POST" && url.pathname === "/api/transfer") {
      const body = await readBody(req);
      const amount = cents(body.amount);
      if (!amount) return send(res, 400, { error: "Indica un monto válido en pesos." });
      if (body.from === body.to) return send(res, 400, { error: "Elige dos cuentas distintas." });
      const db = readDb();
      const from = db.accounts.find(a => a.id === body.from);
      const to = db.accounts.find(a => a.id === body.to);
      if (!from || !to) return send(res, 404, { error: "Cuenta no encontrada." });
      if (from.balance < amount) return send(res, 400, { error: "Saldo insuficiente." });
      from.balance -= amount;
      to.balance += amount;
      record(db, "Transferencia interna", [
        { account: "liability:" + from.id, debit: amount, credit: 0 },
        { account: "liability:" + to.id, debit: 0, credit: amount }
      ], { from: from.id, to: to.id, amountCents: amount });
      writeDb(db);
      return send(res, 200, { ok: true, accounts: db.accounts, journal: db.journal.slice(0, 30) });
    }

    if (req.method === "GET" && url.pathname === "/") {
      return serveFile(res, path.join(__dirname, "public", "index.html"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "Jr.G BANK demo" });
    return send(res, 404, { error: "Ruta no encontrada" });
  } catch (error) {
    return send(res, 500, { error: error.message || "Error interno" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Jr.G BANK demo listo en http://${HOST}:${PORT}`);
});
