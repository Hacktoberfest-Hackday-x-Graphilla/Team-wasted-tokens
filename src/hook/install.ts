import { copyFileSync, existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Installs the Git pre-commit hook. An existing hook is backed up (not
 * overwritten) so teams can restore or chain it manually.
 */
export function installHook(cwd: string = process.cwd()): string {
  const gitDir = path.join(cwd, ".git");
  if (!existsSync(gitDir)) {
    throw new Error("not a git repository (no .git directory found)");
  }

  const hooksDir = path.join(gitDir, "hooks");
  const target = path.join(hooksDir, "pre-commit");
  const templatePath = findTemplate(cwd);

  if (existsSync(target)) {
    const backup = target + ".snift.bak";
    copyFileSync(target, backup);
    console.log(`snift: existing pre-commit hook backed up to ${path.basename(backup)}`);
  }

  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(templatePath, target);
  chmodSync(target, 0o755);
  return target;
}

/** Locates the hooks/pre-commit template shipped with the project. */
function findTemplate(cwd: string): string {
  const candidates = [
    path.join(cwd, "hooks", "pre-commit"),
    // When installed as a package, dist/hook/install.js -> ../../hooks/pre-commit
    path.join(__dirname, "..", "..", "hooks", "pre-commit"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error("hooks/pre-commit template not found next to the project or package");
}

/** True when the target hook already runs snift (idempotent installs). */
export function isHookInstalled(cwd: string = process.cwd()): boolean {
  const target = path.join(cwd, ".git", "hooks", "pre-commit");
  if (!existsSync(target)) return false;
  try {
    return readFileSync(target, "utf8").includes("snift scan --staged");
  } catch {
    return false;
  }
}

/** Template content, also used to (re)generate hooks/pre-commit. */
export const PRE_COMMIT_TEMPLATE = [
  "#!/bin/sh",
  "# Installed by snift — block commits that introduce secrets.",
  "snift scan --staged",
  "",
].join("\n");

/** Writes the template into the repo's hooks/ directory if missing. */
export function ensureTemplateFile(cwd: string = process.cwd()): void {
  const templatePath = path.join(cwd, "hooks", "pre-commit");
  if (!existsSync(templatePath)) {
    mkdirSync(path.dirname(templatePath), { recursive: true });
    writeFileSync(templatePath, PRE_COMMIT_TEMPLATE);
    chmodSync(templatePath, 0o755);
  }
}
