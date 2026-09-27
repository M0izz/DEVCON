import { appendFileSync, mkdirSync } from "node:fs";
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
    appendFileSync(this.path, `${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n`, "utf8");
  }
}