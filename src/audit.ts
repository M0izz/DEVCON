import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";

export type AuditEvent = Record<string, unknown> & {
  eventId: string;
  timestamp: string;
};

export class AuditLog {
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  write(event: Omit<AuditEvent, "timestamp">): void {
    const descriptor = openSync(this.path, "a");
    try {
      writeSync(descriptor, `${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n`, undefined, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }

  readReservedAtomic(): bigint {
    if (!existsSync(this.path)) return 0n;

    let reservedAtomic = 0n;
    const lines = readFileSync(this.path, "utf8").split("\n");
    for (const [index, line] of lines.entries()) {
      if (!line.trim()) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new Error(`Audit ledger is invalid at line ${index + 1}; refusing new payments.`);
      }

      if (event.event !== "payment_decision" || event.decision !== "approved") continue;
      if (typeof event.amountAtomic !== "string" || !/^\d+$/.test(event.amountAtomic)) {
        throw new Error(`Approved audit entry at line ${index + 1} has an invalid atomic amount.`);
      }
      reservedAtomic += BigInt(event.amountAtomic);
    }

    return reservedAtomic;
  }
}