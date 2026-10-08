/**
 * Deterministic detection patterns. One entry per credential family.
 * Keep rules cheap and predictable — this layer limits what reaches the AI.
 */
export interface Rule {
  id: string;
  confidence: "high" | "medium" | "low";
  pattern: RegExp;
}

export const RULES: Rule[] = [
  { id: "aws-access-key", confidence: "high", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "google-api-key", confidence: "high", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "github-token", confidence: "high", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/ },
  { id: "openai-key", confidence: "high", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { id: "slack-token", confidence: "high", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "stripe-key", confidence: "high", pattern: /\b[sp]k_(?:live|test)_[A-Za-z0-9]{20,}\b/ },
  { id: "private-key-header", confidence: "high", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    id: "jwt",
    confidence: "medium",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: "auth-header",
    confidence: "medium",
    pattern: /(?:(?:Authorization|authorization)\s*[:=]\s*(?:Bearer|Basic|token)\s+)([A-Za-z0-9+/=._-]{16,})/,
  },
  {
    id: "credential-assignment",
    confidence: "medium",
    // No leading \b: must also match camelCase (dbPassword) and snake_case (db_password) names.
    pattern:
      /(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|private[_-]?key|credential)s?\b(?:['"]\s*)?\s*[:=]\s*['"]?([^\s'"',;)}]{8,})/i,
  },
  {
    id: "database-uri",
    confidence: "high",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@[^\s/]+/i,
  },
];

/** Values that look like credentials but are obviously placeholders or references. */
export const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^(?:x+|\.+|\*+|#+|-{2,})+$/i,
  /^(?:your|my|the|an?)_(?:api[_-]?key|token|secret|password)/i,
  /^(?:example|sample|dummy|placeholder|changeme|change-me|fixme|todo|insert|replace|redacted|REDACTED)/,
  /^(?:test|testing|test[_-]?key|test[_-]?token|not[-_]?a[-_]?real)/i,
  /^\$\{[^}]*\}$/,
  /^\$[A-Z_][A-Z0-9_]*$/,
  /^%[A-Z_]+%$/,
  /^(?:process\.env|os\.environ|ENV\[|import\.meta\.env)/,
  /^(?:none|null|nil|undefined|true|false|empty|n\/?a)$/i,
  /^<[^>]+>$/,
];

/** Inline suppression marker: `// snift:ignore <reason>` — required, so it self-documents. */
export const IGNORE_MARKER = /snift:ignore\s+\S+/;

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}

export function isSuppressed(text: string): boolean {
  return IGNORE_MARKER.test(text);
}
