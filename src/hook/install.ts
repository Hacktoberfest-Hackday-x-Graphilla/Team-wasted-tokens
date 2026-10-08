import fs from "fs";
import path from "path";
import { resolveGitContext, GitError } from "../git";
import {
  HOOK_FILE_NAME,
  BACKUP_FILE_NAME,
  PRE_COMMIT_HOOK_CONTENT,
  isSniftHook,
} from "./template";

export interface HookInstallOptions {
  /**
   * Working directory to install the hook in. Defaults to `process.cwd()`.
   */
  cwd?: string;

  /**
   * Overwrite existing Snift hook if already installed.
   */
  force?: boolean;
}

export interface HookInstallResult {
  installed: boolean;
  hookPath: string;
  backupPath?: string;
  backedUp: boolean;
  alreadyInstalled?: boolean;
}

export class HookInstallError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_GIT_REPO"
      | "GIT_NOT_FOUND"
      | "BACKUP_EXISTS"
      | "FS_ERROR"
      | "VERIFICATION_FAILED"
      | "UNKNOWN" = "FS_ERROR",
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = "HookInstallError";
  }
}

/**
 * Ensures the target file has executable permissions (+x / 0o755)
 * on platforms where POSIX file permissions apply.
 */
export function ensureExecutable(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch (err: unknown) {
    // On Windows, chmod errors can occur or have no POSIX effect, but if it throws unexpectedly
    // on a non-Windows platform, we log or rethrow.
    if (process.platform !== "win32") {
      const error = err as Error;
      throw new HookInstallError(
        `Failed to set executable permissions on hook: ${error.message}`,
        "FS_ERROR",
        `Run 'chmod +x ${filePath}' manually.`
      );
    }
  }
}

/**
 * Safely installs the Snift pre-commit hook into the current Git repository.
 *
 * Sequence:
 * 1. Verify Git repository & resolve actual Git directory
 * 2. Ensure hooks directory exists
 * 3. Inspect existing pre-commit hook
 * 4. Safely back up existing hook (and prevent destroying any existing backup)
 * 5. Atomically write Snift hook with LF line endings
 * 6. Make hook executable (0o755)
 * 7. Verify hook exists and contains Snift invocation
 */
export async function installPreCommitHook(
  options: HookInstallOptions = {}
): Promise<HookInstallResult> {
  const targetCwd = options.cwd || process.cwd();

  // 1. Resolve Git repository context
  let gitContext;
  try {
    gitContext = resolveGitContext(targetCwd);
  } catch (err: unknown) {
    if (err instanceof GitError) {
      throw new HookInstallError(err.message, err.code, err.suggestion);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new HookInstallError(message, "FS_ERROR");
  }

  const { hooksDir } = gitContext;
  const hookPath = path.join(hooksDir, HOOK_FILE_NAME);
  const backupPath = path.join(hooksDir, BACKUP_FILE_NAME);

  // 2. Ensure hooks directory exists
  try {
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HookInstallError(
      `Failed to create Git hooks directory at '${hooksDir}': ${message}`,
      "FS_ERROR",
      "Check filesystem permissions for your .git directory."
    );
  }

  // 3. Inspect existing hook
  const hookExists = fs.existsSync(hookPath);
  const backupExists = fs.existsSync(backupPath);
  let backedUp = false;

  if (hookExists) {
    let existingContent: string;
    let existingStat: fs.Stats;
    try {
      existingContent = fs.readFileSync(hookPath, "utf8");
      existingStat = fs.statSync(hookPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HookInstallError(
        `Failed to read existing hook at '${hookPath}': ${message}`,
        "FS_ERROR",
        "Check file permissions."
      );
    }

    // Check if the existing hook is already Snift's hook
    if (isSniftHook(existingContent) && !options.force) {
      ensureExecutable(hookPath);
      return {
        installed: true,
        hookPath,
        backupPath: backupExists ? backupPath : undefined,
        backedUp: false,
        alreadyInstalled: true,
      };
    }

    // If a backup file already exists, NEVER silently overwrite it
    if (backupExists) {
      throw new HookInstallError(
        `Existing pre-commit hook backup already exists at '${backupPath}'.`,
        "BACKUP_EXISTS",
        "To prevent destroying your previous backup, Snift will not overwrite it. Please inspect, restore, or remove the existing backup before reinstalling."
      );
    }

    // Safely create backup
    const tempBackupPath = path.join(
      hooksDir,
      `.${BACKUP_FILE_NAME}.tmp.${Date.now()}_${process.pid}`
    );

    try {
      // Write backup to temp file, preserve permissions if possible, then rename atomically
      fs.writeFileSync(tempBackupPath, existingContent, {
        encoding: "utf8",
        mode: existingStat.mode,
      });
      fs.renameSync(tempBackupPath, backupPath);

      // Verify backup exists and exact contents match
      if (!fs.existsSync(backupPath)) {
        throw new Error("Backup file was not created successfully.");
      }
      const verifiedBackup = fs.readFileSync(backupPath, "utf8");
      if (verifiedBackup !== existingContent) {
        throw new Error("Backup verification failed: contents do not match.");
      }
      backedUp = true;
    } catch (err: unknown) {
      // Clean up temp backup file if it exists
      if (fs.existsSync(tempBackupPath)) {
        try {
          fs.unlinkSync(tempBackupPath);
        } catch {}
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new HookInstallError(
        `Failed to create safe backup of existing pre-commit hook: ${message}`,
        "FS_ERROR",
        "Your existing hook was not modified. Please check write permissions for the hooks directory."
      );
    }
  }

  // 4. Atomically write new Snift hook
  const tempHookPath = path.join(
    hooksDir,
    `.${HOOK_FILE_NAME}.tmp.${Date.now()}_${process.pid}`
  );

  try {
    fs.writeFileSync(tempHookPath, PRE_COMMIT_HOOK_CONTENT, {
      encoding: "utf8",
      mode: 0o755,
    });
    ensureExecutable(tempHookPath);

    // Atomic rename
    fs.renameSync(tempHookPath, hookPath);
    ensureExecutable(hookPath);
  } catch (err: unknown) {
    if (fs.existsSync(tempHookPath)) {
      try {
        fs.unlinkSync(tempHookPath);
      } catch {}
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new HookInstallError(
      `Failed to write Snift pre-commit hook: ${message}`,
      "FS_ERROR",
      "Check filesystem permissions for the .git/hooks directory."
    );
  }

  // 5. Verify installation
  if (!fs.existsSync(hookPath)) {
    throw new HookInstallError(
      `Hook verification failed: file '${hookPath}' does not exist after installation.`,
      "VERIFICATION_FAILED",
      "Check disk space and write permissions."
    );
  }

  let finalContent: string;
  try {
    finalContent = fs.readFileSync(hookPath, "utf8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new HookInstallError(
      `Failed to verify installed hook: ${message}`,
      "VERIFICATION_FAILED"
    );
  }

  if (!isSniftHook(finalContent)) {
    throw new HookInstallError(
      "Hook verification failed: hook content does not contain 'snift scan --staged'.",
      "VERIFICATION_FAILED",
      "Re-run 'snift install' to ensure the hook was properly installed."
    );
  }

  return {
    installed: true,
    hookPath,
    backupPath: backedUp ? backupPath : undefined,
    backedUp,
    alreadyInstalled: false,
  };
}
