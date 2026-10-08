import { describe, expect, it } from "vitest";
import { toFindings } from "../src/policy.js";
import type { Candidate, Verdict } from "../src/types.js";

function candidate(ruleConfidence: Candidate["ruleConfidence"], id = "c0"): Candidate {
  return {
    id,
    file: "src/app.ts",
    line: 1,
    rule: "credential-assignment",
    ruleConfidence,
    value: "REDACTED-VALUE",
    redactedLine: "const dbPassword = 'REDACTED…****';",
    context: ["const dbPassword = 'REDACTED…****';"],
  };
}

function verdict(
  classification: Verdict["classification"],
  confidence: number,
  id = "c0",
): Verdict {
  return { id, classification, confidence, reason: "test reason" };
}

describe("toFindings", () => {
  it("blocks high-confidence rule hits even without an AI verdict", () => {
    const { blocked, warned } = toFindings([candidate("high")], new Map());
    expect(blocked).toHaveLength(1);
    expect(warned).toHaveLength(0);
    expect(blocked[0].reason).toContain("high confidence");
  });

  it("warns on low/medium rule hits without an AI verdict", () => {
    for (const conf of ["medium", "low"] as const) {
      const { blocked, warned } = toFindings([candidate(conf)], new Map());
      expect(blocked).toHaveLength(0);
      expect(warned).toHaveLength(1);
    }
  });

  it("blocks medium rules when the AI says secret with high confidence", () => {
    const { blocked } = toFindings(
      [candidate("medium")],
      new Map([["c0", verdict("likely_secret", 0.9)]]),
    );
    expect(blocked).toHaveLength(1);
    expect(blocked[0].reason).toContain("AI:");
  });

  it("warns when the AI says secret but with low confidence", () => {
    const { blocked, warned } = toFindings(
      [candidate("medium")],
      new Map([["c0", verdict("likely_secret", 0.5)]]),
    );
    expect(blocked).toHaveLength(0);
    expect(warned).toHaveLength(1);
  });

  it("drops candidates the AI confidently dismisses as benign", () => {
    const { blocked, warned } = toFindings(
      [candidate("medium")],
      new Map([["c0", verdict("benign", 0.9)]]),
    );
    expect(blocked).toHaveLength(0);
    expect(warned).toHaveLength(0);
  });

  it("does not drop benign verdicts with low confidence", () => {
    const { blocked, warned } = toFindings(
      [candidate("medium")],
      new Map([["c0", verdict("benign", 0.5)]]),
    );
    expect(blocked).toHaveLength(0);
    expect(warned).toHaveLength(1);
  });

  it("never exposes the raw value in the finding preview", () => {
    const { blocked } = toFindings([candidate("high")], new Map());
    expect(blocked[0].preview).not.toContain("REDACTED-VALUE");
    expect(blocked[0].preview).toMatch(/\*{4}/);
  });
});
