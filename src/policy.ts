import type { Candidate, Verdict, Finding } from "./types.js";
import { AI_BLOCK_CONFIDENCE } from "./config.js";
import { maskValue } from "./redact.js";

/**
 * Decision logic: combines deterministic rule results with AI verdicts into
 * one outcome per candidate.
 * - block: high-confidence rule hit, or AI says secret/likely_secret with high confidence.
 * - warn: everything else worth surfacing.
 * When the AI layer is unavailable, the deterministic layer alone decides
 * (fail-safe fallback, not fail-open for high-confidence rules).
 */
export function toFindings(
  candidates: Candidate[],
  verdicts: Map<string, Verdict>,
): { blocked: Finding[]; warned: Finding[] } {
  const blocked: Finding[] = [];
  const warned: Finding[] = [];

  for (const c of candidates) {
    const v: Verdict | undefined = verdicts.get(c.id);

    if (v && v.classification === "benign" && v.confidence >= AI_BLOCK_CONFIDENCE) {
      continue; // AI confidently dismissed it.
    }

    const aiSaysSecret =
      v !== undefined &&
      (v.classification === "secret" || v.classification === "likely_secret") &&
      v.confidence >= AI_BLOCK_CONFIDENCE;

    if (c.ruleConfidence === "high" || aiSaysSecret) {
      const reason = v ? `AI: ${v.reason}` : `rule "${c.rule}" (high confidence)`;
      blocked.push(toFinding(c, "block", reason));
    } else {
      const reason = v ? `AI: ${v.reason}` : `rule "${c.rule}" (needs review)`;
      warned.push(toFinding(c, "warn", reason));
    }
  }

  return { blocked, warned };
}

function toFinding(c: Candidate, severity: "block" | "warn", reason: string): Finding {
  return {
    file: c.file,
    line: c.line,
    rule: c.rule,
    severity,
    preview: maskValue(c.value),
    reason,
  };
}
