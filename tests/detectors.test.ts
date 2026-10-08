import { describe, it, expect } from "vitest";
import { detectSecrets } from "../src/detectors";
import { isRelevantLine } from "../src/detectors/relevance";
import { shannonEntropy } from "../src/detectors/entropy";
import { isPlaceholderValue } from "../src/detectors/regex";
import { AddedLine } from "../src/types";

function lines(entries: [string, string][]): AddedLine[] {
  return entries.map(([file, content], i) => ({ file, line: i + 1, content }));
}

describe("relevance filter", () => {
  it("passes credential-keyword lines", () => {
    expect(isRelevantLine('const API_KEY = "abc";')).toBe(true);
    expect(isRelevantLine("Authorization: Bearer xyz")).toBe(true);
  });

  it("passes provider-prefix lines without keywords", () => {
    expect(isRelevantLine('const cfg = "sk_live_abc1234567890";')).toBe(true);
  });

  it("passes tokenish high-entropy strings without keywords", () => {
    expect(isRelevantLine('const data = "xJ82ksL91mQp72ZkQ91Lmnopqrs";')).toBe(true);
  });

  it("filters clearly irrelevant lines", () => {
    expect(isRelevantLine("console.log('hello world');")).toBe(false);
    expect(isRelevantLine("")).toBe(false);
  });

  it("does not eliminate a secret line lacking key/token words", () => {
    // Provider prefix saves it even without keywords
    expect(isRelevantLine('const value = "ghp_AbCdEfGhIjKlMnOpQrStUv";')).toBe(true);
  });
});

describe("entropy", () => {
  it("computes shannon entropy", () => {
    expect(shannonEntropy("aaaa")).toBeCloseTo(0);
    expect(shannonEntropy("abcdefghij")).toBeGreaterThan(3);
  });
});

describe("placeholders", () => {
  it("recognizes obvious placeholders", () => {
    expect(isPlaceholderValue("YOUR_API_KEY")).toBe(true);
    expect(isPlaceholderValue("replace-me")).toBe(true);
    expect(isPlaceholderValue("example-token")).toBe(true);
    expect(isPlaceholderValue("test-token")).toBe(true);
    expect(isPlaceholderValue("YOUR_SECRET")).toBe(true);
    expect(isPlaceholderValue("<your-api-key>")).toBe(true);
  });

  it("does not flag realistic values", () => {
    expect(isPlaceholderValue("sk_live_9Xk2LmNpQrSt4UvW")).toBe(false);
  });
});

describe("deterministic detection", () => {
  it("detects AWS-like key", () => {
    const found = detectSecrets(lines([["a.ts", 'const k = "AKIAIOSFODNN7EXAMPLE";']]));
    expect(found.some((c) => c.detector === "aws-access-key")).toBe(true);
  });

  it("detects Stripe-like key", () => {
    const found = detectSecrets(lines([["a.ts", 'const stripeKey = "sk_live_FAKE_DEMO_SECRET";']]));
    expect(found.some((c) => c.detector === "stripe-key")).toBe(true);
  });

  it("detects GitHub token", () => {
    const found = detectSecrets(lines([["a.ts", 'const t = "ghp_AbCdEfGhIjKlMnOpQrStUv";']]));
    expect(found.some((c) => c.detector === "github-token")).toBe(true);
  });

  it("detects generic API key", () => {
    const found = detectSecrets(lines([["a.ts", 'const API_KEY = "abc123def456";']]));
    expect(found.some((c) => c.detector === "generic-api-key")).toBe(true);
  });

  it("detects generic secret", () => {
    const found = detectSecrets(lines([["a.ts", 'const SECRET_KEY = "super-secret-value";']]));
    expect(found.some((c) => c.detector === "generic-secret")).toBe(true);
  });

  it("detects password", () => {
    const found = detectSecrets(lines([["a.ts", 'const password = "mypassword";']]));
    expect(found.some((c) => c.detector === "generic-password")).toBe(true);
  });

  it("detects private key", () => {
    const found = detectSecrets(lines([["a.pem", "-----BEGIN RSA PRIVATE KEY-----"]]));
    expect(found.some((c) => c.detector === "private-key")).toBe(true);
  });

  it("detects database URL", () => {
    const found = detectSecrets(lines([["a.ts", 'const url = "postgres://admin:hunter2@db.example.com/prod";']]));
    expect(found.some((c) => c.detector === "database-url")).toBe(true);
  });

  it("detects JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1";
    const found = detectSecrets(lines([["a.ts", `const t = "${jwt}";`]]));
    expect(found.some((c) => c.detector === "jwt")).toBe(true);
  });

  it("detects high entropy string without keywords", () => {
    const found = detectSecrets(
      lines([["a.ts", 'const blob = "xJ82ksL91mQp72ZkQ91Lmnopqrst";']])
    );
    expect(found.some((c) => c.detector === "entropy")).toBe(true);
  });

  it("ignores environment variable lookups", () => {
    const found = detectSecrets(lines([["a.ts", 'const API_KEY = process.env.API_KEY;']]));
    expect(found).toHaveLength(0);
  });

  it("reduces confidence for placeholder values", () => {
    const found = detectSecrets(lines([["a.ts", 'const API_KEY = "YOUR_API_KEY";']]));
    const generic = found.find((c) => c.detector === "generic-api-key");
    expect(generic).toBeDefined();
    expect(generic!.confidence).toBeLessThanOrEqual(0.5);
  });

  it("includes redacted surrounding context", () => {
    const found = detectSecrets(
      lines([
        ["a.ts", 'const stripeKey = "sk_live_FAKE_DEMO_SECRET";'],
        ["a.ts", "const stripe = new Stripe(stripeKey);"],
      ])
    );
    expect(found[0].surroundingCode).toContain("<SECRET_REDACTED>");
    expect(found[0].surroundingCode).not.toContain("sk_live_FAKE_DEMO_SECRET");
  });
});
