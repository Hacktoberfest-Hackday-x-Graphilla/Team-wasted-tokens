import { describe, it, expect } from "vitest";
import { parseAddedLines } from "../src/git";
import { filterRelevantLines } from "../src/detectors/relevance";
import { scanStaged, ScannerDeps } from "../src/scanner";
import { AIAnalyzer } from "../src/ai/analyzer";
import { validateAnalysisOutput } from "../src/ai/schema";
import { DEFAULT_CONFIG } from "../src/config";
import { SecretAnalysisInput, SecretAnalysisResult } from "../src/types";

const DIFF = `diff --git a/src/payment.ts b/src/payment.ts
index 1111111..2222222 100644
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -1,10 +1,15 @@
 import Stripe from "stripe";

 const config = loadConfig();

+const stripeKey = "sk_live_FAKE_DEMO_SECRET";
+const stripe = new Stripe(stripeKey);

 export function payment() {
   return stripe.paymentIntents;
 }
`;

describe("diff parsing", () => {
  it("ignores diff metadata", () => {
    const added = parseAddedLines(DIFF);
    const contents = added.map((l) => l.content);
    expect(contents).not.toContain(expect.stringContaining("diff --git"));
    expect(contents).not.toContain(expect.stringContaining("+++ b/"));
    expect(contents).not.toContain(expect.stringContaining("@@"));
  });

  it("extracts only added lines with leading + removed", () => {
    const added = parseAddedLines(DIFF);
    expect(added.map((l) => l.content)).toEqual([
      'const stripeKey = "sk_live_FAKE_DEMO_SECRET";',
      "const stripe = new Stripe(stripeKey);",
    ]);
  });

  it("does not scan unchanged context lines", () => {
    const added = parseAddedLines(DIFF);
    expect(added.some((l) => l.content.includes("loadConfig"))).toBe(false);
  });

  it("tracks file names and line numbers", () => {
    const added = parseAddedLines(DIFF);
    expect(added[0].file).toBe("src/payment.ts");
    expect(added[0].line).toBe(5);
  });
});

describe("relevance filtering of large diffs", () => {
  it("filters large unrelated diffs before deterministic analysis", () => {
    const many: string[] = [];
    for (let i = 0; i < 500; i++) many.push(`console.log("unrelated ${i}");`);
    many.push('const API_KEY = "realistic-secret-value";');
    const diff = `diff --git a/big.ts b/big.ts\n--- a/big.ts\n+++ b/big.ts\n@@ -0,0 +1,${many.length} @@\n` +
      many.map((l) => `+${l}`).join("\n");
    const relevant = filterRelevantLines(parseAddedLines(diff));
    expect(relevant).toHaveLength(1);
    expect(relevant[0].content).toContain("API_KEY");
  });
});

class MockAIAnalyzer implements AIAnalyzer {
  lastInput?: SecretAnalysisInput;
  constructor(private result: Partial<SecretAnalysisResult> = {}) {}
  async analyzeCandidate(input: SecretAnalysisInput): Promise<SecretAnalysisResult> {
    this.lastInput = input;
    return {
      is_secret: true,
      secret_type: "api_key",
      provider: "stripe",
      confidence: 0.98,
      severity: "critical",
      is_placeholder: false,
      reason: "Credential-like value used as a Stripe key.",
      recommended_action: "Move the credential to an environment variable and rotate it.",
      should_block: true,
      ...this.result,
    };
  }
}

describe("scanner end-to-end with mock AI", () => {
  const deps: ScannerDeps = { getDiff: async () => DIFF };

  it("blocks a real secret", async () => {
    const report = await scanStaged("/repo", new MockAIAnalyzer(), DEFAULT_CONFIG, deps);
    expect(report.stats.candidates).toBeGreaterThan(0);
    expect(report.stats.secrets).toBeGreaterThan(0);
    expect(report.findings[0].policy.decision).toBe("BLOCK");
  });

  it("never sends the raw secret to the AI", async () => {
    const analyzer = new MockAIAnalyzer();
    await scanStaged("/repo", analyzer, DEFAULT_CONFIG, deps);
    expect(analyzer.lastInput!.context).not.toContain("sk_live_FAKE_DEMO_SECRET");
    expect(analyzer.lastInput!.context).toContain("<SECRET_REDACTED>");
  });

  it("allows placeholders", async () => {
    const report = await scanStaged(
      "/repo",
      new MockAIAnalyzer({ is_secret: false, is_placeholder: true, should_block: false, confidence: 0.97, severity: "low" }),
      DEFAULT_CONFIG,
      deps
    );
    expect(report.stats.secrets).toBe(0);
  });

  it("fails closed when AI is unavailable on high-confidence candidates", async () => {
    const failing: AIAnalyzer = {
      async analyzeCandidate() {
        throw new Error("endpoint down");
      },
    };
    const report = await scanStaged("/repo", failing, DEFAULT_CONFIG, deps);
    expect(report.aiFailure).toBe(true);
    expect(report.stats.secrets).toBeGreaterThan(0);
  });
});

describe("zod validation", () => {
  it("accepts valid output", () => {
    const raw = JSON.stringify({
      is_secret: true, secret_type: "api_key", provider: "stripe", confidence: 0.98,
      severity: "critical", is_placeholder: false, reason: "r", recommended_action: "a", should_block: true,
    });
    expect(validateAnalysisOutput(raw)).not.toBeNull();
  });

  it("accepts markdown-wrapped JSON", () => {
    const raw = '```json\n{"is_secret":false,"secret_type":"api_key","provider":"unknown","confidence":0.97,"severity":"low","is_placeholder":true,"reason":"placeholder","recommended_action":"none","should_block":false}\n```';
    expect(validateAnalysisOutput(raw)?.is_placeholder).toBe(true);
  });

  it("rejects malformed output", () => {
    expect(validateAnalysisOutput("not json at all")).toBeNull();
    expect(validateAnalysisOutput('{"is_secret": "yes"}')).toBeNull();
  });
});
