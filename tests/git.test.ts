import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { isGitRepository, resolveGitContext, GitError } from "../src/git";

describe("git utilities", () => {
  let tempDir: string;
  let originalCeiling: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snift-git-test-"));
    originalCeiling = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = path.dirname(tempDir);
  });

  afterEach(() => {
    if (originalCeiling !== undefined) {
      process.env.GIT_CEILING_DIRECTORIES = originalCeiling;
    } else {
      delete process.env.GIT_CEILING_DIRECTORIES;
    }

    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it("detects when a directory is not a Git repository", () => {
    expect(isGitRepository(tempDir)).toBe(false);

    expect(() => resolveGitContext(tempDir)).toThrowError(GitError);
    try {
      resolveGitContext(tempDir);
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect((err as GitError).code).toBe("NOT_GIT_REPO");
    }
  });

  it("detects when a directory is a Git repository", () => {
    execSync("git init", { cwd: tempDir, stdio: "ignore" });

    expect(isGitRepository(tempDir)).toBe(true);

    const context = resolveGitContext(tempDir);
    expect(context.gitDir).toBeDefined();
    expect(context.hooksDir).toBe(path.join(context.gitDir, "hooks"));
  });

  it("correctly resolves Git context from a nested subdirectory", () => {
    execSync("git init", { cwd: tempDir, stdio: "ignore" });
    const subDir = path.join(tempDir, "src", "nested");
    fs.mkdirSync(subDir, { recursive: true });

    expect(isGitRepository(subDir)).toBe(true);

    const context = resolveGitContext(subDir);
    expect(context.gitDir).toBe(path.join(tempDir, ".git"));
    expect(context.hooksDir).toBe(path.join(tempDir, ".git", "hooks"));
  });
});
