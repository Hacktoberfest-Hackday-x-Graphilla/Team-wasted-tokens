/**
 * Redaction helpers. Secret values never leave the machine and are never
 * printed: everything that reaches the AI layer or the terminal is masked.
 */

/** Masks a secret for display/AI: keeps a short distinguishing prefix. */
export function maskValue(value: string): string {
  const head = value.slice(0, 4);
  return `${head}…${"*".repeat(4)}`;
}

/** Returns `line` with `value` replaced by its masked form. */
export function redactLine(line: string, value: string): string {
  const idx = line.indexOf(value);
  if (idx === -1) return maskValue(value) + " [redacted]";
  return line.slice(0, idx) + maskValue(value) + line.slice(idx + value.length);
}

/** Marker substituted for secret values in AI-bound context. */
export const REDACTED_MARKER = "[REDACTED by snift]";

/**
 * Context lines flowing to the AI are capped in length; the deterministic
 * redaction in detectors handles secret values, this only guards against
 * pathological lines.
 */
export function redactSafeContext(line: string): string {
  return line.length > 300 ? line.slice(0, 300) + "…[truncated]" : line;
}
