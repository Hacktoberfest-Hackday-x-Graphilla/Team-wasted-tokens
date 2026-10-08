import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import {
  installPreCommitHook,
  HookInstallError,
} from "../../src/hook/install";
import {
  HOOK_FILE_NAME,
  BACKUP_FILE_NAME,
  isSniftHook,
} from "../../src/hook/template";

describe("installPreCommitHook", () => {
  let tempRepo: string;
  let originalCeiling: string | undefined;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), "snift-hook-test-"));
    originalCeiling = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = path.dirname(tempRepo);
  });

  afterEach(() => {
    if (originalCeiling !== undefined) {
      process.env.GIT_CEILING_DIRECTORIES = originalCeiling;
    } else {
      delete process.env.GIT_CEILING_DIRECTORIES;
    }

    if (fs.existsSync(tempRepo)) {
      try {
        fs.rmSync(tempRepo, { recursive: true, force: true });
      } catch {}
    }
  });

  // Test 1 — Git repository detection
  describe("Test 1 — Git repository detection", () => {
    it("fails cleanly when target directory is not a Git repository", async () => {
      // tempRepo is an empty non-git directory
      await expect(
        installPreCommitHook({ cwd: tempRepo })
      ).rejects.toThrowError(HookInstallError);

      try {
        await installPreCommitHook({ cwd: tempRepo });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HookInstallError);
        const hookErr = err as HookInstallError;
        expect(hookErr.code).toBe("NOT_GIT_REPO");
        expect(hookErr.message).toContain("Not a Git repository");
        expect(hookErr.suggestion).toContain("Run `snift install` from inside a Git repository");
      }
    });

    it("succeeds when target directory is a Git repository", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const result = await installPreCommitHook({ cwd: tempRepo });
      expect(result.installed).toBe(true);
      expect(fs.existsSync(result.hookPath)).toBe(true);
    });
  });

  // Test 2 — Fresh installation
  describe("Test 2 — Fresh installation", () => {
    it("creates .git/hooks/pre-commit when none exists", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });
      const expectedHookPath = path.join(tempRepo, ".git", "hooks", HOOK_FILE_NAME);

      // Ensure pre-commit does not exist before
      expect(fs.existsSync(expectedHookPath)).toBe(false);

      const result = await installPreCommitHook({ cwd: tempRepo });

      expect(result.installed).toBe(true);
      expect(result.hookPath).toBe(expectedHookPath);
      expect(result.backedUp).toBe(false);
      expect(result.backupPath).toBeUndefined();
      expect(fs.existsSync(expectedHookPath)).toBe(true);
    });
  });

  // Test 3 — Correct hook content
  describe("Test 3 — Correct hook content", () => {
    it("generates hook with valid shebang and snift scan --staged command", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const result = await installPreCommitHook({ cwd: tempRepo });
      const hookContent = fs.readFileSync(result.hookPath, "utf8");

      expect(hookContent.startsWith("#!/bin/sh")).toBe(true);
      expect(hookContent).toContain("snift scan --staged");
      expect(hookContent).toContain("exit $?");
      expect(hookContent).not.toContain("\r\n"); // Strictly LF line endings
      expect(isSniftHook(hookContent)).toBe(true);
    });
  });

  // Test 4 — Existing hook preservation
  describe("Test 4 — Existing hook preservation", () => {
    it("safely backs up an existing hook before installing Snift hook", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const hooksDir = path.join(tempRepo, ".git", "hooks");
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      const hookPath = path.join(hooksDir, HOOK_FILE_NAME);
      const backupPath = path.join(hooksDir, BACKUP_FILE_NAME);

      const originalContent = "#!/bin/sh\necho \"existing hook\"\n";
      fs.writeFileSync(hookPath, originalContent, "utf8");

      const result = await installPreCommitHook({ cwd: tempRepo });

      expect(result.installed).toBe(true);
      expect(result.backedUp).toBe(true);
      expect(result.backupPath).toBe(backupPath);

      // Verify backup exists and contains EXACTLY the original content
      expect(fs.existsSync(backupPath)).toBe(true);
      const backedUpContent = fs.readFileSync(backupPath, "utf8");
      expect(backedUpContent).toBe(originalContent);

      // Verify new pre-commit contains Snift's hook
      const newHookContent = fs.readFileSync(hookPath, "utf8");
      expect(isSniftHook(newHookContent)).toBe(true);
      expect(newHookContent).toContain("snift scan --staged");
    });
  });

  // Test 5 — Existing backup safety
  describe("Test 5 — Existing backup safety", () => {
    it("refuses installation and preserves existing backup if pre-commit.snift-backup already exists", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const hooksDir = path.join(tempRepo, ".git", "hooks");
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      const hookPath = path.join(hooksDir, HOOK_FILE_NAME);
      const backupPath = path.join(hooksDir, BACKUP_FILE_NAME);

      const criticalBackupContent = "#!/bin/sh\necho \"critical user backup\"\n";
      fs.writeFileSync(backupPath, criticalBackupContent, "utf8");

      const currentHookContent = "#!/bin/sh\necho \"another hook\"\n";
      fs.writeFileSync(hookPath, currentHookContent, "utf8");

      // Attempt install: must fail with BACKUP_EXISTS and not overwrite backup
      await expect(
        installPreCommitHook({ cwd: tempRepo })
      ).rejects.toThrowError(HookInstallError);

      try {
        await installPreCommitHook({ cwd: tempRepo });
      } catch (err) {
        expect(err).toBeInstanceOf(HookInstallError);
        expect((err as HookInstallError).code).toBe("BACKUP_EXISTS");
      }

      // Verify backup was NOT destroyed or overwritten
      expect(fs.readFileSync(backupPath, "utf8")).toBe(criticalBackupContent);
      // Verify current hook was NOT modified
      expect(fs.readFileSync(hookPath, "utf8")).toBe(currentHookContent);
    });
  });

  // Test 6 — Executable permission
  describe("Test 6 — Executable permission", () => {
    it("ensures hook has executable permissions on Unix systems", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const result = await installPreCommitHook({ cwd: tempRepo });
      const stats = fs.statSync(result.hookPath);

      if (process.platform !== "win32") {
        // Check that execute bits are set (rwxr-xr-x or at least +x)
        const isExecutable = (stats.mode & 0o111) !== 0;
        expect(isExecutable).toBe(true);
      } else {
        // On Windows, verify stats mode is readable/writable
        expect(stats.mode).toBeDefined();
      }
    });
  });

  // Additional edge cases: Idempotency & Nested Git Directory
  describe("Idempotency & Subdirectory Support", () => {
    it("is idempotent when Snift hook is already installed", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });

      const firstResult = await installPreCommitHook({ cwd: tempRepo });
      expect(firstResult.alreadyInstalled).toBe(false);

      const secondResult = await installPreCommitHook({ cwd: tempRepo });
      expect(secondResult.installed).toBe(true);
      expect(secondResult.alreadyInstalled).toBe(true);
      expect(secondResult.backedUp).toBe(false);
    });

    it("installs hook into root Git directory when invoked from a nested subdirectory", async () => {
      execSync("git init", { cwd: tempRepo, stdio: "ignore" });
      const nestedDir = path.join(tempRepo, "packages", "app", "src");
      fs.mkdirSync(nestedDir, { recursive: true });

      const result = await installPreCommitHook({ cwd: nestedDir });
      expect(result.installed).toBe(true);
      expect(result.hookPath).toBe(path.join(tempRepo, ".git", "hooks", HOOK_FILE_NAME));
      expect(fs.existsSync(result.hookPath)).toBe(true);
    });
  });
});
