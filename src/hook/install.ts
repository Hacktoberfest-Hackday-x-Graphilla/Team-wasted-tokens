import * as fs from "fs";
import * as path from "path";

export const HOOK_CONTENT = `#!/bin/sh

echo ""
echo "🔐 Snift scanning..."
echo ""

snift scan --staged

STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "❌ Snift blocked this commit."
  exit 1
fi

echo ""
echo "✓ Snift passed."
exit 0
`;

export interface InstallResult {
  ok: boolean;
  message: string;
  backedUp?: boolean;
}

export function installPreCommitHook(repoRoot: string): InstallResult {
  const hooksDir = path.join(repoRoot, ".git", "hooks");
  const hookPath = path.join(hooksDir, "pre-commit");

  if (!fs.existsSync(path.join(repoRoot, ".git"))) {
    return { ok: false, message: "Not a Git repository." };
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  let backedUp = false;
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf8");
    // Idempotent: already a Snift hook.
    if (existing.includes("snift scan --staged")) {
      return { ok: true, message: "Snift pre-commit hook is already installed." };
    }
    // Never overwrite silently: create a backup first.
    fs.copyFileSync(hookPath, `${hookPath}.snift-backup`);
    backedUp = true;
  }

  fs.writeFileSync(hookPath, HOOK_CONTENT, { mode: 0o755 });

  return {
    ok: true,
    message: backedUp
      ? "Pre-commit hook installed successfully. Existing hook backed up to pre-commit.snift-backup."
      : "Pre-commit hook installed successfully.",
    backedUp,
  };
}

export function hookExists(repoRoot: string): boolean {
  return fs.existsSync(path.join(repoRoot, ".git", "hooks", "pre-commit"));
}

export function hookIsExecutable(repoRoot: string): boolean {
  const hookPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
  try {
    fs.accessSync(hookPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function hookRunsSnift(repoRoot: string): boolean {
  const hookPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
  try {
    return fs.readFileSync(hookPath, "utf8").includes("snift scan --staged");
  } catch {
    return false;
  }
}
