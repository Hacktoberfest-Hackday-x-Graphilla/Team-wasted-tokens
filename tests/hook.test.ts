import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { installPreCommitHook, hookExists, hookIsExecutable, hookRunsSnift } from "../src/hook/install";

let tmpDir: string;

function initTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snift-test-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "test@test.com"', { cwd: dir });
  execSync('git config user.name "test"', { cwd: dir });
  return dir;
}

describe("hook installation", () => {
  beforeEach(() => {
    tmpDir = initTempRepo();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("installs hook in a git repo", () => {
    const result = installPreCommitHook(tmpDir);
    expect(result.ok).toBe(true);
    expect(hookExists(tmpDir)).toBe(true);
  });

  it("hook is executable", () => {
    installPreCommitHook(tmpDir);
    expect(hookIsExecutable(tmpDir)).toBe(true);
  });

  it("hook invokes snift scan --staged", () => {
    installPreCommitHook(tmpDir);
    expect(hookRunsSnift(tmpDir)).toBe(true);
  });

  it("backs up an existing hook instead of overwriting silently", () => {
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hookPath, "#!/bin/sh\necho custom\n");
    const result = installPreCommitHook(tmpDir);
    expect(result.ok).toBe(true);
    expect(result.backedUp).toBe(true);
    expect(fs.existsSync(`${hookPath}.snift-backup`)).toBe(true);
    expect(fs.readFileSync(`${hookPath}.snift-backup`, "utf8")).toContain("custom");
    expect(fs.readFileSync(hookPath, "utf8")).toContain("snift scan --staged");
  });

  it("is idempotent for its own hook", () => {
    installPreCommitHook(tmpDir);
    const second = installPreCommitHook(tmpDir);
    expect(second.ok).toBe(true);
  });

  it("refuses outside a git repository", () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "snift-norepo-"));
    try {
      const result = installPreCommitHook(notRepo);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Not a Git repository/i);
    } finally {
      fs.rmSync(notRepo, { recursive: true, force: true });
    }
  });
});
