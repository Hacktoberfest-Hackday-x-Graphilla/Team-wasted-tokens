import { describe, expect, it } from "vitest";
import { scanAdditions } from "../src/detectors/index.js";
import { isPlaceholder } from "../src/detectors/patterns.js";
import { shannonEntropy } from "../src/detectors/entropy.js";
import { maskValue, redactLine } from "../src/redact.js";
import type { StagedAddition } from "../src/types.js";

function add(text: string, file = "src/app.ts", line = 1): StagedAddition {
  return { file, line, text, context: [text] };
}

describe("known credential formats", () => {
  it("flags AWS access keys as high confidence", () => {
    const c = scanAdditions([add("const id = 'AKIAIOSFODNN7EXAMPLE';")]);
    expect(c).toHaveLength(1);
    expect(c[0].rule).toBe("aws-access-key");
    expect(c[0].ruleConfidence).toBe("high");
  });

  it("flags Google API keys", () => {
    const c = scanAdditions([add("key: 'AIzaSyD-1234567890abcdefghijklmnopqrstu'")]);
    expect(c[0].rule).toBe("google-api-key");
  });

  it("flags private key headers", () => {
    const c = scanAdditions([add("-----BEGIN RSA PRIVATE KEY-----")]);
    expect(c[0].rule).toBe("private-key-header");
  });

  it("flags database URIs with embedded passwords", () => {
    const c = scanAdditions([add("DATABASE_URL=postgres://admin:s3cret@db:5432/app")]);
    expect(c.some((x) => x.rule === "database-uri")).toBe(true);
  });

  it("flags credential-style assignments", () => {
    const c = scanAdditions([add("const clientSecret = 'bXktcmVhbC1zZWNyZXQtdmFsdWU';")]);
    expect(c.some((x) => x.rule === "credential-assignment")).toBe(true);
  });
});

describe("placeholder and benign filtering", () => {
  it("ignores obvious placeholders", () => {
    const c = scanAdditions([
      add("const apiKey = 'your_api_key_here';"),
      add("const token = '<TOKEN>';"),
      add("process.env.GITHUB_TOKEN"),
    ]);
    expect(c).toHaveLength(0);
  });

  it("ignores UUIDs and plain URLs in the entropy fallback", () => {
    const c = scanAdditions([
      add("const id = 'd3b07384-d9a0-4b6f-9c1a-2f4e5a6b7c8d';"),
      add("const url = 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz';"),
    ]);
    expect(c.filter((x) => x.rule === "high-entropy-string")).toHaveLength(0);
  });
});

describe("suppression marker", () => {
  it("skips lines with a snift:ignore marker", () => {
    const c = scanAdditions([
      add("const id = 'AKIAIOSFODNN7EXAMPLE'; // snift:ignore test fixture value"),
    ]);
    expect(c).toHaveLength(0);
  });
});

describe("redaction", () => {
  it("never includes the raw value in redacted output", () => {
    const secret = "AKIAIOSFODNN7EXAMPLE";
    const line = `const id = '${secret}';`;
    const c = scanAdditions([add(line)]);
    expect(c).toHaveLength(1);
    expect(c[0].redactedLine).not.toContain(secret);
    expect(c[0].context.join("\n")).not.toContain(secret);
    expect(maskValue(c[0].value)).not.toContain("OSFODNN7");
  });

  it("redactLine keeps surrounding code", () => {
    const redacted = redactLine("const id = 'AKIAIOSFODNN7EXAMPLE';", "AKIAIOSFODNN7EXAMPLE");
    expect(redacted).toBe("const id = 'AKIA…****';");
  });
});

describe("shannonEntropy", () => {
  it("ranks random strings above repeated text", () => {
    expect(shannonEntropy("aA1!bB2@cC3#dD4$")).toBeGreaterThan(
      shannonEntropy("aaaaaaaaaaaaaaaaaaaa"),
    );
  });
});
