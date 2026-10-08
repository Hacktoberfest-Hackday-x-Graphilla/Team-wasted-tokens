import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { installPreCommitHook } from "../../src/hook/install";

describe("Test 8 — Integration behavior (Git hook execution & exit code propagation)", () => {
  let tempRepo: string;
  let mockBinDir: string;
  let argsLogFile: string;
  let originalCeiling: string | undefined;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), "snift-integration-repo-"));
    mockBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "snift-mock-bin-"));
    argsLogFile = path.join(mockBinDir, "snift-invocations.log");

    originalCeiling = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = path.dirname(tempRepo);

    // Initialize temporary Git repository and set dummy author details
    execSync("git init", { cwd: tempRepo, stdio: "ignore", env: process.env });
    execSync('git config user.name "Snift Tester"', { cwd: tempRepo, stdio: "ignore", env: process.env });
    execSync('git config user.email "tester@snift.local"', { cwd: tempRepo, stdio: "ignore", env: process.env });

    // Create mock `snift` shell script for Git's hook runner (sh)
    const mockShScript = `#!/bin/sh
printf "%s\\n" "$*" >> "${argsLogFile.replace(/\\/g, "/")}"
if [ -n "$SNIFT_MOCK_EXIT" ]; then
  exit "$SNIFT_MOCK_EXIT"
fi
exit 0
`.replace(/\r\n/g, "\n");

    const mockShPath = path.join(mockBinDir, "snift");
    fs.writeFileSync(mockShPath, mockShScript, { encoding: "utf8", mode: 0o755 });
    try {
      fs.chmodSync(mockShPath, 0o755);
    } catch {}

    // Also create Windows batch wrapper if on Windows
    if (process.platform === "win32") {
      const mockBatScript = `@echo off
echo %*>> "${argsLogFile}"
if defined SNIFT_MOCK_EXIT (
  exit /b %SNIFT_MOCK_EXIT%
)
exit /b 0
`;
      fs.writeFileSync(path.join(mockBinDir, "snift.cmd"), mockBatScript, { encoding: "utf8" });
    }
  });

  afterEach(() => {
    if (originalCeiling !== undefined) {
      process.env.GIT_CEILING_DIRECTORIES = originalCeiling;
    } else {
      delete process.env.GIT_CEILING_DIRECTORIES;
    }

    for (const dir of [tempRepo, mockBinDir]) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  });

  it("invokes snift scan --staged and allows commit when exit code is 0", async () => {
    // 1. Install Snift hook in the temporary repository
    const installResult = await installPreCommitHook({ cwd: tempRepo });
    expect(installResult.installed).toBe(true);

    // 2. Stage a file
    const testFile = path.join(tempRepo, "sample.txt");
    fs.writeFileSync(testFile, "clean content", "utf8");
    execSync("git add sample.txt", { cwd: tempRepo, stdio: "ignore", env: process.env });

    // 3. Run git commit with PATH pointing to mock snift and SNIFT_MOCK_EXIT=0
    const env = {
      ...process.env,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH || ""}`,
      SNIFT_MOCK_EXIT: "0",
    };

    const commitRes = spawnSync("git", ["commit", "-m", "Clean commit"], {
      cwd: tempRepo,
      env,
      encoding: "utf8",
    });

    expect(commitRes.status).toBe(0);

    // 4. Verify hook invoked snift with scan --staged
    expect(fs.existsSync(argsLogFile)).toBe(true);
    const loggedArgs = fs.readFileSync(argsLogFile, "utf8");
    expect(loggedArgs).toContain("scan --staged");

    // Verify commit was created
    const logRes = spawnSync("git", ["log", "-1", "--oneline"], {
      cwd: tempRepo,
      encoding: "utf8",
      env,
    });
    expect(logRes.stdout).toContain("Clean commit");
  });

  it("blocks git commit when snift scan exits with 1 (blocking secret detected)", async () => {
    // 1. Install Snift hook
    await installPreCommitHook({ cwd: tempRepo });

    // 2. Stage a file
    const testFile = path.join(tempRepo, "secret.txt");
    fs.writeFileSync(testFile, "secret content", "utf8");
    execSync("git add secret.txt", { cwd: tempRepo, stdio: "ignore", env: process.env });

    // 3. Run git commit with SNIFT_MOCK_EXIT=1
    const env = {
      ...process.env,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH || ""}`,
      SNIFT_MOCK_EXIT: "1",
    };

    const commitRes = spawnSync("git", ["commit", "-m", "Secret commit"], {
      cwd: tempRepo,
      env,
      encoding: "utf8",
    });

    // Commit must be rejected (non-zero exit code)
    expect(commitRes.status).not.toBe(0);

    // Verify hook invoked snift scan --staged
    expect(fs.existsSync(argsLogFile)).toBe(true);
    const loggedArgs = fs.readFileSync(argsLogFile, "utf8");
    expect(loggedArgs).toContain("scan --staged");

    // Verify no commit was made
    const logRes = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: tempRepo,
      encoding: "utf8",
      env,
    });
    // In a new repository with blocked commit, HEAD should not exist
    expect(logRes.status).not.toBe(0);
  });

  it("blocks git commit when snift scan exits with 2 (runtime error)", async () => {
    // 1. Install Snift hook
    await installPreCommitHook({ cwd: tempRepo });

    // 2. Stage a file
    const testFile = path.join(tempRepo, "test.txt");
    fs.writeFileSync(testFile, "test", "utf8");
    execSync("git add test.txt", { cwd: tempRepo, stdio: "ignore", env: process.env });

    // 3. Run git commit with SNIFT_MOCK_EXIT=2
    const env = {
      ...process.env,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH || ""}`,
      SNIFT_MOCK_EXIT: "2",
    };

    const commitRes = spawnSync("git", ["commit", "-m", "Runtime error test"], {
      cwd: tempRepo,
      env,
      encoding: "utf8",
    });

    // Must block commit
    expect(commitRes.status).not.toBe(0);
  });
});
