import "dotenv/config";
import { AuditLog } from "./audit.js";
import { createPaidFetch, loadBuyerConfig } from "./buyer.js";

async function main(): Promise<void> {
  const sellerUrl = process.env.SELLER_URL ?? "http://localhost:4021";
  const auditPath = process.env.AUDIT_PATH ?? "records/rogue-check.jsonl";
  const buyer = createPaidFetch(loadBuyerConfig(new AuditLog(auditPath)));
  let allRefused = true;

  for (const path of ["/rogue/overpriced", "/rogue/wrong-token"]) {
    try {
      await buyer.fetchPaid(new URL(path, sellerUrl).toString());
      allRefused = false;
      console.error(`${path}: unexpectedly reached the seller data handler`);
    } catch (error) {
      console.log(`${path}: ${error instanceof Error ? error.message : "refused"}`);
    }
  }

  console.log(`Audit: ${auditPath}`);
  if (!allRefused) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});