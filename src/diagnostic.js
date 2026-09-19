export function diagnostic(severity, code, message, offset, details = {}) {
  return Object.freeze({ severity, code, message, offset, ...details });
}
