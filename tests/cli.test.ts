import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync } from "child_process";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("snift CLI", () => {
  let tempDir: string;
  let originalCeiling: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snift-cli-test-"));
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

  // Test 7 — CLI registration
  describe("Test 7 — CLI registration", () => {
    it("displays 'install' command in snift --help output", () => {
      const res = spawnSync("node", [CLI_PATH, "--help"], {
        encoding: "utf8",
        env: process.env,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("install");
      expect(res.stdout).toContain("Install the Git pre-commit hook");
    });

    it("displays options in snift install --help output", () => {
      const res = spawnSync("node", [CLI_PATH, "install", "--help"], {
        encoding: "utf8",
        env: process.env,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("--force");
    });
  });

  describe("CLI Execution Behavior", () => {
    it("exits with code 2 when run outside a Git repository", () => {
      const res = spawnSync("node", [CLI_PATH, "install"], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CEILING_DIRECTORIES: path.dirname(tempDir),
        },
      });

      expect(res.status).toBe(2);
      expect(res.stderr).toContain("Not a Git repository");
      expect(res.stderr).toContain("Run `snift install` from inside a Git repository");
      // Must not expose stack traces to regular users
      expect(res.stderr).not.toContain("at Object.<anonymous>");
      expect(res.stderr).not.toContain("HookInstallError:");
    });

    it("exits with code 0 and reports success when run inside a Git repository", () => {
      execSync("git init", { cwd: tempDir, stdio: "ignore", env: process.env });

      const res = spawnSync("node", [CLI_PATH, "install"], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CEILING_DIRECTORIES: path.dirname(tempDir),
        },
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("Git repository detected");
      expect(res.stdout).toContain("Pre-commit hook installed");
      expect(res.stdout).toContain("Snift will scan staged changes before every commit");

      const hookFile = path.join(tempDir, ".git", "hooks", "pre-commit");
      expect(fs.existsSync(hookFile)).toBe(true);
    });

    it("preserves existing commands like snift scan", () => {
      const res = spawnSync("node", [CLI_PATH, "scan"], {
        encoding: "utf8",
        env: process.env,
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain("scan: not implemented yet");
    });
  });
});
