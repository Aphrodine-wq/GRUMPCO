/**
 * Opt-in anonymous telemetry (aggregate usage, no PII).
 */
let optedIn = false;

export function setOptIn(value: boolean): void {
  optedIn = value;
}

export function isOptedIn(): boolean {
  return optedIn;
}

export function track(_event: string, _props?: Record<string, unknown>): void {
  if (!optedIn) return;
  // In production: send to analytics endpoint (aggregate only)
}
