// Opt-in diagnostic logging. Library consumers (and the demo via its ?debug
// query param) call setDebug(true) to see internal load/detection details;
// production stays silent by default.

let enabled = false;

export function setDebug(on: boolean): void {
  enabled = on;
}

export function isDebug(): boolean {
  return enabled;
}

export function dlog(...args: unknown[]): void {
  if (enabled) console.warn('[avatar-stage]', ...args);
}
