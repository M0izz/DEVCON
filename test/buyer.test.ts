import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AuditLog } from "../src/audit.js";
import { createPaidFetch } from "../src/buyer.js";
import { BASE_SEPOLIA, BASE_SEPOLIA_USDC } from "../src/policy.js";

const payTo = "0x1111111111111111111111111111111111111111";
const ephemeralTestKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

test("the x402 fetch path refuses hostile quotes before creating a payment", async () => {
  const server = createServer((request, response) => {
    const isWrongToken = request.url === "/wrong-token";
    response.writeHead(402, { "content-type": "application/json" });
    response.end(JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: "exact",
        network: BASE_SEPOLIA,
        asset: isWrongToken ? "0x2222222222222222222222222222222222222222" : BASE_SEPOLIA_USDC,
        payTo,
        amount: isWrongToken ? "20000" : "4990000",
      }],
    }));
  });
  const directory = mkdtempSync(join(tmpdir(), "coin-purse-test-"));
  const auditPath = join(directory, "audit.jsonl");

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const buyer = createPaidFetch({
    privateKey: ephemeralTestKey,
    payTo,
    maxPerCall: 250_000n,
    totalBudget: 5_000_000n,
    audit: new AuditLog(auditPath),
  });

  try {
    await assert.rejects(buyer.fetchPaid(`http://127.0.0.1:${address.port}/overpriced`), /per_call_limit/);
    await assert.rejects(buyer.fetchPaid(`http://127.0.0.1:${address.port}/wrong-token`), /unsupported_asset/);
    const events = readFileSync(auditPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(events.map((event) => event.reason), ["per_call_limit", "unsupported_asset"]);
    assert.equal(events.every((event) => event.decision === "refused"), true);
    assert.equal(buyer.getReservedAtomic(), 0n);

    const restartedAudit = new AuditLog(auditPath);
    restartedAudit.write({
      eventId: "persisted-reservation",
      event: "payment_decision",
      decision: "approved",
      amountAtomic: "4990000",
    });
    const restartedBuyer = createPaidFetch({
      privateKey: ephemeralTestKey,
      payTo,
      maxPerCall: 250_000n,
      totalBudget: 5_000_000n,
      audit: new AuditLog(auditPath),
    });
    assert.equal(restartedBuyer.getReservedAtomic(), 4_990_000n);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});