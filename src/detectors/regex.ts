/**
 * Obvious placeholders and false-positive signals. These do not get
 * auto-blocked; they may still be surfaced to Gemma for classification.
 */
export const PLACEHOLDER_VALUES = [
  "your_api_key",
  "your-api-key",
  "yourapikey",
  "your_token",
  "your-token",
  "your_secret",
  "your-secret",
  "your_key",
  "your-key",
  "replace_me",
  "replace-me",
  "replaceme",
  "change_me",
  "change-me",
  "changeme",
  "example",
  "example-token",
  "example_token",
  "example-key",
  "test-token",
  "test_token",
  "dummy",
  "placeholder",
  "<your-api-key>",
  "not-a-real-secret",
  "sample",
];

/**
 * Returns true if the matched value looks like an obvious placeholder,
 * documentation example, or dummy value.
 */
export function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_VALUES.some((p) => normalized === p || normalized.includes(p));
}

/**
 * Extract a plausible variable/constant name from a line that assigns the
 * given matched value. Returns undefined when not found.
 */
export function extractVariableName(line: string, matchedValue: string): string | undefined {
  const idx = line.indexOf(matchedValue);
  const before = idx >= 0 ? line.slice(0, idx) : line;
  const m =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/.exec(before) ??
    /(["']?)([\w-]+)\1\s*[:=]\s*$/.exec(before);
  return m ? (m[1] ?? m[2]).replace(/["']/g, "") : undefined;
}
