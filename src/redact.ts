import { SECRET_PATTERNS } from "./detectors/patterns";
import { findHighEntropyStrings } from "./detectors/entropy";

export const REDACTED = "<SECRET_REDACTED>";

/**
 * Replace anything that looks like a secret with <SECRET_REDACTED>.
 * Applied to every line of context before it can reach Gemma, logs,
 * terminal output, or tests.
 */
export function redactInText(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern.regex, (match, group) =>
      group !== undefined ? match.replace(group, REDACTED) : REDACTED
    );
  }
  // High-entropy quoted strings inside context are also redacted.
  for (const hit of findHighEntropyStrings(out)) {
    out = out.replace(hit.value, REDACTED);
  }
  return out;
}

/**
 * Redact the matched value inside a single source line (used for the
 * candidate's own line in context).
 */
export function redactMatchedValue(line: string, matchedValue: string): string {
  if (!matchedValue) return line;
  return line.split(matchedValue).join(REDACTED);
}

/**
 * Guarantee a context string contains no raw secret. Defense in depth: even
 * if a redaction step is missed, this strips provider-shaped and high-entropy
 * values one more time before anything is sent to the AI.
 */
export function ensureRedacted(context: string, matchedValue?: string): string {
  let out = context;
  if (matchedValue) out = out.split(matchedValue).join(REDACTED);
  return redactInText(out);
}
