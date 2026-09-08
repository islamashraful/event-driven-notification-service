export type LogStatus = "success" | "failure";

/**
 * The only fields this service ever logs. Deliberately closed, not
 * open-ended — a push token has no field to go in here, so there's no way
 * to accidentally log one through this function. CloudWatch picks up
 * anything written to stdout automatically; no separate log shipping.
 */
export type LogEntry = {
  eventId: string;
  eventType: string;
  userId: string;
  status: LogStatus;
  durationMs: number;
  errorType?: string;
};

/**
 * Logs a structured JSON line. Reconstructs the entry field-by-field
 * rather than serializing the input object directly, so even a caller
 * that smuggles in an extra field (e.g. via a type assertion) can't get
 * it logged — the allowlist is enforced at runtime, not just by the type.
 */
export function log(entry: LogEntry): void {
  const safeEntry: LogEntry = {
    eventId: entry.eventId,
    eventType: entry.eventType,
    userId: entry.userId,
    status: entry.status,
    durationMs: entry.durationMs,
    ...(entry.errorType !== undefined ? { errorType: entry.errorType } : {}),
  };
  console.log(JSON.stringify(safeEntry));
}
