import { describe, expect, it } from "vitest";
import {
  maskValue,
  redactLine,
  redactSafeContext,
  REDACTED_MARKER,
} from "../src/redact.js";

const SECRET = "AKIAIOSFODNN7EXAMPLE";

describe("maskValue", () => {
  it("keeps only a short prefix and masks the rest", () => {
    const masked = maskValue(SECRET);
    expect(masked).toBe("AKIA…****");
    expect(masked).not.toContain("OSFODNN7");
  });

  it("handles short values without throwing", () => {
    expect(maskValue("abc")).toBe("abc…****");
    expect(maskValue("")).toBe("…****");
  });
});

describe("redactLine", () => {
  it("replaces the secret while keeping surrounding code", () => {
    const line = `const id = '${SECRET}';`;
    expect(redactLine(line, SECRET)).toBe("const id = 'AKIA…****';");
  });

  it("returns a fully masked placeholder when the value is not in the line", () => {
    expect(redactLine("const x = 1;", SECRET)).toBe("AKIA…**** [redacted]");
  });

  it("never leaves the raw value anywhere in the output", () => {
    const out = redactLine(`key=${SECRET} // comment`, SECRET);
    expect(out).not.toContain(SECRET);
  });
});

describe("redactSafeContext", () => {
  it("caps pathological lines at 300 chars with a truncation marker", () => {
    const long = "a".repeat(500);
    const out = redactSafeContext(long);
    expect(out.length).toBeLessThanOrEqual(320);
    expect(out.endsWith("…[truncated]")).toBe(true);
  });

  it("leaves short lines untouched", () => {
    expect(redactSafeContext("const x = 1;")).toBe("const x = 1;");
  });
});

describe("REDACTED_MARKER", () => {
  it("is the placeholder substituted into AI-bound context", () => {
    expect(REDACTED_MARKER).toBe("[REDACTED by snift]");
  });
});
