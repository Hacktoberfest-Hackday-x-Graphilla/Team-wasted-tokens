import { ENTROPY_MIN_LENGTH, ENTROPY_THRESHOLD } from "../config.js";
import { isPlaceholder } from "./patterns.js";

/** Shannon entropy in bits per character. */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Generic high-entropy fallback: long random-looking strings that no format
 * rule caught. Excludes hashes/UUIDs (pure hex, with separators), URL-ish
 * values, and anything already flagged by a format rule (substring either way).
 */
export function findHighEntropyStrings(
  line: string,
  alreadyMatchedValues: string[],
): string[] {
  if (line.includes("://")) return [];

  const results: string[] = [];
  for (const m of line.matchAll(/\b[A-Za-z0-9+/=_.-]{20,}\b/g)) {
    const value = m[0];
    if (value.length < ENTROPY_MIN_LENGTH) continue;
    if (shannonEntropy(value) < ENTROPY_THRESHOLD) continue;
    if (isPlaceholder(value)) continue;
    // Pure-hex strings (with common separators) are hashes/UUIDs, not credentials.
    if (/^[0-9a-f-]+$/i.test(value)) continue;
    if (alreadyMatchedValues.some((v) => v.includes(value) || value.includes(v))) continue;
    results.push(value);
  }
  return results;
}
