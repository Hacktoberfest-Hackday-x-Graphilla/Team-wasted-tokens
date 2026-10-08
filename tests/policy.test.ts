import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../src/policy";
import { SecretAnalysisResult } from "../src/types";

function result(overrides: Partial<SecretAnalysisResult>): SecretAnalysisResult {
  return {
    is_secret: true,
    secret_type: "api_key",
    provider: "stripe",
    confidence: 0.95,
    severity: "critical",
    is_placeholder: false,
    reason: "test",
    recommended_action: "rotate",
    should_block: true,
    ...overrides,
  };
}

describe("policy", () => {
  it("blocks real secret with high confidence", () => {
    expect(evaluatePolicy(result({ confidence: 0.95 })).decision).toBe("BLOCK");
  });

  it("warns on suspicious medium confidence", () => {
    const r = evaluatePolicy(
      result({ confidence: 0.7, is_secret: false, should_block: false, severity: "medium" })
    );
    expect(r.decision).toBe("WARN");
  });

  it("allows low confidence", () => {
    expect(evaluatePolicy(result({ confidence: 0.3 })).decision).toBe("ALLOW");
  });

  it("allows placeholders regardless of confidence", () => {
    expect(
      evaluatePolicy(result({ is_placeholder: true, should_block: true })).decision
    ).toBe("ALLOW");
  });

  it("does not blindly trust should_block on low confidence", () => {
    expect(
      evaluatePolicy(result({ confidence: 0.3, should_block: true })).decision
    ).toBe("ALLOW");
  });
});
