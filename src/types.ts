import { DIFF_LIMITS } from "./config.js";

/** One added (+) line from the staged diff, with surrounding context. */
export interface StagedAddition {
  file: string;
  /** 1-based line number in the NEW file. */
  line: number;
  text: string;
  /** Up to `contextLines` surrounding diff lines (unchanged or added), for AI triage. */
  context: string[];
}

/** A suspicious string found by the deterministic scanner in a staged addition. */
export interface Candidate {
  /** Stable id used to correlate with AI verdicts. */
  id: string;
  file: string;
  /** 1-based line number in the NEW file. */
  line: number;
  /** Rule that matched, e.g. "aws-access-key". */
  rule: string;
  ruleConfidence: "high" | "medium" | "low";
  /** The full matched value — never printed or logged, only redacted before AI. */
  value: string;
  /** The matched line with the value already redacted. */
  redactedLine: string;
  /** A few surrounding lines, redacted. */
  context: string[];
}

export type Classification = "secret" | "likely_secret" | "benign";

/** Machine-readable AI verdict for one candidate. */
export interface Verdict {
  id: string;
  classification: Classification;
  /** 0.0 – 1.0 */
  confidence: number;
  reason: string;
}

export type Severity = "block" | "warn";

/** A candidate with its final severity after combining rule + AI results. */
export interface Finding {
  file: string;
  line: number;
  rule: string;
  severity: Severity;
  /** Short masked preview, safe to print, e.g. "AKIA…****". */
  preview: string;
  reason: string;
}

export interface ScanResult {
  blocked: Finding[];
  warned: Finding[];
  /** True when the AI layer was skipped (no key, error, or timeout). */
  aiUsed: boolean;
  truncated: boolean;
}

export { DIFF_LIMITS };
