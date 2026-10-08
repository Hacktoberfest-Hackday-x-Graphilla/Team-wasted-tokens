import { AddedLine } from "../types";

const CREDENTIAL_KEYWORDS = [
  "API_KEY",
  "APIKEY",
  "SECRET",
  "SECRET_KEY",
  "ACCESS_TOKEN",
  "AUTH_TOKEN",
  "TOKEN",
  "PASSWORD",
  "PASSWD",
  "CLIENT_SECRET",
  "PRIVATE_KEY",
  "DATABASE_URL",
  "DB_PASSWORD",
  "AUTHORIZATION",
  "BEARER",
  "CREDENTIAL",
];

// Credential-like assignment: name contains a credential keyword.
const ASSIGNMENT_RE = new RegExp(
  `["']?(?:[A-Za-z0-9_-]*?(?:${CREDENTIAL_KEYWORDS.join("|")})[A-Za-z0-9_-]*?)["']?\\s*[:=]\\s*["'\`]`,
  "i"
);

// Known provider prefixes for real credential shapes.
const PROVIDER_PREFIX_RE =
  /\b(sk_live_|sk_test_|ghp_|gho_|ghu_|ghs_|github_pat_|AKIA[0-9A-Z]{0,10}|AIza|xoxb-|xoxp-|xoxa-|eyJ|Bearer\s)/;

// Connection string with inline credentials: scheme://user:password@host
const CONN_STRING_RE = /\w[\w+.-]*:\/\/[^\s"'`]*:[^\s"'`]*@/;

// Longish token-shaped strings (may be high entropy; let entropy detector look).
const TOKENISH_RE = /["'\/][A-Za-z0-9+/_=.-]{24,}["']/;

/**
 * Relevance filter: identify lines worth investigating, not decide whether
 * they are secrets. Cheap, fast, deliberately permissive: a line is relevant
 * if it mentions credential keywords, looks like a credential assignment,
 * carries a provider prefix, or contains a tokenish high-entropy candidate.
 * Lines lacking key/token words may still pass (e.g. provider prefixes).
 */
export function isRelevantLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return false;

  if (CREDENTIAL_KEYWORDS.some((k) => trimmed.toUpperCase().includes(k))) return true;
  if (ASSIGNMENT_RE.test(trimmed)) return true;
  if (PROVIDER_PREFIX_RE.test(trimmed)) return true;
  if (CONN_STRING_RE.test(trimmed)) return true;
  if (TOKENISH_RE.test(trimmed)) return true;

  return false;
}

/**
 * Filter added diff lines down to those worth deterministic analysis.
 */
export function filterRelevantLines(lines: AddedLine[]): AddedLine[] {
  return lines.filter((l) => isRelevantLine(l.content));
}
