import type { StagedAddition, Candidate } from "../types.js";
import { isSuppressed } from "./patterns.js";
import { matchFormatRules } from "./regex.js";
import { findHighEntropyStrings } from "./entropy.js";
import { isCredentialRelevant } from "./relevance.js";
import { redactLine, redactSafeContext } from "../redact.js";

/** Cheap binary sniff: NUL bytes or a high ratio of non-printable chars. */
function isBinaryLooking(text: string): boolean {
  let suspicious = 0;
  const len = Math.min(text.length, 200);
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c === 0 || (c < 9 && c !== 0) || (c > 13 && c < 32)) suspicious++;
  }
  return len > 0 && suspicious / len > 0.1;
}

function makeCandidate(
  id: string,
  addition: StagedAddition,
  rule: string,
  confidence: "high" | "medium" | "low",
  value: string,
): Candidate {
  return {
    id,
    file: addition.file,
    line: addition.line,
    rule,
    ruleConfidence: confidence,
    value,
    redactedLine: redactLine(addition.text, value),
    context: addition.context.map((c) => redactLine(c, value)),
  };
}

/** Runs the deterministic detectors over staged additions. */
export function scanAdditions(additions: StagedAddition[]): Candidate[] {
  const candidates: Candidate[] = [];
  let nextId = 0;

  for (const addition of additions) {
    if (isSuppressed(addition.text)) continue;
    if (isBinaryLooking(addition.text)) continue;

    const matchedValues: string[] = [];
    for (const m of matchFormatRules(addition.text)) {
      matchedValues.push(m.value);
      candidates.push(makeCandidate(`c${nextId++}`, addition, m.rule, m.confidence, m.value));
    }

    // Entropy fallback: credential-relevant lines get a confidence bump.
    for (const value of findHighEntropyStrings(addition.text, matchedValues)) {
      const relevant = isCredentialRelevant(addition.text, addition.context);
      candidates.push(
        makeCandidate(
          `c${nextId++}`,
          addition,
          "high-entropy-string",
          relevant ? "medium" : "low",
          value,
        ),
      );
    }
  }
  return candidates;
}
