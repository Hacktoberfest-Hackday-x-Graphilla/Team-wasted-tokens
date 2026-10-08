/**
 * Lightweight Shannon entropy over the character distribution of a string.
 * Returns bits per character (0..~5 for base64-ish content).
 */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Minimum length for a string to be considered an entropy candidate. */
export const ENTROPY_MIN_LENGTH = 20;
/** Entropy threshold (bits/char) for a candidate. */
export const ENTROPY_THRESHOLD = 3.5;

/**
 * Extract tokenish substrings that exceed the entropy threshold.
 * Only called on lines already deemed relevant by the relevance filter.
 */
export function findHighEntropyStrings(line: string): { value: string; entropy: number }[] {
  const results: { value: string; entropy: number }[] = [];
  // Quoted strings or bare token-like runs.
  const tokens = line.match(/["'`]([^"'`\s]{20,})["'`]/g) ?? [];
  for (const token of tokens) {
    const value = token.slice(1, -1); // strip surrounding quotes
    if (value.length < ENTROPY_MIN_LENGTH) continue;
    const entropy = shannonEntropy(value);
    if (entropy >= ENTROPY_THRESHOLD) {
      results.push({ value, entropy });
    }
  }
  return results;
}
