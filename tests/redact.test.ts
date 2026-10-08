import { describe, it, expect } from "vitest";
import { redactInText, ensureRedacted, REDACTED } from "../src/redact";
import { toAnalysisInput } from "../src/scanner";
import { SecretCandidate } from "../src/types";

const SECRET = "sk_live_9Xk2LmNpQrSt4UvWx";

describe("redaction", () => {
  it("replaces provider-shaped secrets", () => {
    const redacted = redactInText(`const k = "${SECRET}";`);
    expect(redacted).not.toContain(SECRET);
    expect(redacted).toContain(REDACTED);
  });

  it("replaces generic assignment secrets", () => {
    const redacted = redactInText('const API_KEY = "abc123def456";');
    expect(redacted).not.toContain("abc123def456");
    expect(redacted).toContain(REDACTED);
  });

  it("redacts context passed to AI input", () => {
    const candidate: SecretCandidate = {
      file: "src/payment.ts",
      line: 2,
      detector: "stripe-key",
      typeHint: "Stripe API credential",
      providerHint: "Stripe",
      matchedValue: SECRET,
      surroundingCode: `const stripeKey = "${SECRET}";\nconst stripe = new Stripe(stripeKey);`,
      entropyScore: 4.2,
      confidence: 0.9,
    };
    const input = toAnalysisInput(candidate, candidate.surroundingCode);
    expect(input.context).not.toContain(SECRET);
    expect(input.context).toContain("<SECRET_REDACTED>");
  });

  it("ensureRedacted strips a known raw value even if redaction missed it", () => {
    const context = `x = "${SECRET}"`;
    const out = ensureRedacted(context, SECRET);
    expect(out).not.toContain(SECRET);
  });
});
