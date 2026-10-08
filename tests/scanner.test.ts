import { describe, expect, it } from "vitest";
import { parseDiff, parseFileSection } from "../src/git.js";
import { shouldSkipFile } from "../src/config.js";

const SAMPLE_DIFF = [
  "diff --git a/src/config.ts b/src/config.ts",
  "index 111..222 100644",
  "--- a/src/config.ts",
  "+++ b/src/config.ts",
  "@@ -1,3 +1,4 @@",
  " const x = 1;",
  "-const old = 'removed';",
  "+const apiKey = 'AKIAIOSFODNN7EXAMPLE';",
  "+const dbUrl = 'postgres://user:secret@host:5432/db';",
  " const y = 2;",
  "diff --git a/img.png b/img.png",
  "index 333..444 100644",
  "Binary files /dev/null and b/img.png differ",
  "diff --git a/package-lock.json b/package-lock.json",
  "index 555..666 100644",
  "--- a/package-lock.json",
  "+++ b/package-lock.json",
  "@@ -1 +1,2 @@",
  "+looks like a secret but lockfiles are skipped",
].join("\n");

describe("parseDiff", () => {
  it("extracts added lines with new-file line numbers", () => {
    const { additions } = parseDiff(SAMPLE_DIFF);
    const config = additions.filter((a) => a.file === "src/config.ts");
    expect(config).toHaveLength(2);
    expect(config[0].line).toBe(2);
    expect(config[0].text).toBe("const apiKey = 'AKIAIOSFODNN7EXAMPLE';");
    expect(config[1].line).toBe(3);
  });

  it("ignores removed lines", () => {
    const { additions } = parseDiff(SAMPLE_DIFF);
    expect(additions.some((a) => a.text.includes("removed"))).toBe(false);
  });

  it("captures surrounding context for AI triage", () => {
    const { additions } = parseDiff(SAMPLE_DIFF);
    const first = additions[0];
    expect(first.context.length).toBeGreaterThan(0);
    expect(first.context).toContain("const x = 1;");
  });

  it("skips binary files and lockfiles", () => {
    const { additions } = parseDiff(SAMPLE_DIFF);
    expect(additions.some((a) => a.file === "img.png")).toBe(false);
    expect(additions.some((a) => a.file === "package-lock.json")).toBe(false);
  });
});

describe("parseFileSection", () => {
  it("handles files added at the start of the file (line 1)", () => {
    const section = [
      "diff --git a/new.txt b/new.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1,2 @@",
      "+line one",
      "+line two",
    ].join("\n");
    const additions = parseFileSection(section);
    expect(additions.map((a) => a.line)).toEqual([1, 2]);
  });
});

describe("shouldSkipFile", () => {
  it("skips lockfiles and vendored paths", () => {
    expect(shouldSkipFile("vendor/lib/x.ts")).toBe(true);
    expect(shouldSkipFile("yarn.lock")).toBe(true);
    expect(shouldSkipFile("src/yarn.lock")).toBe(true);
    expect(shouldSkipFile("src/app.ts")).toBe(false);
  });
});
