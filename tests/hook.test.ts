import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { mkdtempSync, tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { installHook, isHookInstalled } from "../src/hook/install.js";

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "snift-hook-test-"));
});

afterEach(() => {
  // Sandbox dirs are left in tmpdir for post-mortem inspection.
});

function makeGitRepo(): void {
  mkdirSync(path.join(sandbox, ".git", "hooks"), { recursive: true });
}

describe("installHook", () => {
  it("installs the pre-commit hook and marks it executable", () => {
    makeGitRepo();
    const target = installHook(sandbox);
    expect(target).toBe(path.join(sandbox, ".git", "hooks", "pre-commit"));
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toContain("snift scan --staged");
    expect(statSync(target).mode & 0o111).not.toBe(0);
  });

  it("backs up an existing hook instead of overwriting it", () => {
    makeGitRepo();
    const existing = path.join(sandbox, ".git", "hooks", "pre-commit");
    writeFileSync(existing, "#!/bin/sh\nold-hook\n");
    installHook(sandbox);
    const backup = existing + ".snift.bak";
    expect(existsSync(backup)).toBe(true);
    expect(readFileSync(backup, "utf8")).toContain("old-hook");
    expect(readFileSync(existing, "utf8")).toContain("snift scan --staged");
  });

  it("throws outside a git repository", () => {
    expect(() => installHook(sandbox)).toThrow(/not a git repository/);
  });
});

describe("isHookInstalled", () => {
  it("is false when no hook exists", () => {
    makeGitRepo();
    expect(isHookInstalled(sandbox)).toBe(false);
  });

  it("is true after a snift install", () => {
    makeGitRepo();
    installHook(sandbox);
    expect(isHookInstalled(sandbox)).toBe(true);
  });

  it("is false for a foreign hook without snift", () => {
    makeGitRepo();
    const existing = path.join(sandbox, ".git", "hooks", "pre-commit");
    writeFileSync(existing, "#!/bin/sh\nold-hook\n");
    expect(isHookInstalled(sandbox)).toBe(false);
  });
});
