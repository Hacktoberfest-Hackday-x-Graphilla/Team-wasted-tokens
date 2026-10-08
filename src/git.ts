import { spawnSync, SpawnSyncReturns } from "child_process";
import path from "path";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_GIT_REPO" | "GIT_NOT_FOUND" | "UNKNOWN" = "UNKNOWN",
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = "GitError";
  }
}

export interface GitContext {
  gitDir: string;
  hooksDir: string;
}

/**
 * Executes a Git command safely using spawnSync with argument arrays.
 * Prevents shell injection.
 */
export function execGit(args: string[], cwd: string = process.cwd()): SpawnSyncReturns<string> {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: process.env,
  });
}

/**
 * Checks whether the specified working directory belongs to a Git repository.
 */
export function isGitRepository(cwd: string = process.cwd()): boolean {
  try {
    const res = execGit(["rev-parse", "--git-dir"], cwd);
    return res.status === 0 && Boolean(res.stdout && res.stdout.trim());
  } catch {
    return false;
  }
}

/**
 * Resolves the Git directory and hooks directory for the given working directory.
 * Throws GitError if not a Git repository or Git is unavailable.
 */
export function resolveGitContext(cwd: string = process.cwd()): GitContext {
  let res: SpawnSyncReturns<string>;
  try {
    res = execGit(["rev-parse", "--git-dir"], cwd);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new GitError(
        "Git is not installed or not available in PATH.",
        "GIT_NOT_FOUND",
        "Please install Git and ensure it is available in your PATH."
      );
    }
    throw new GitError(`Failed to execute Git: ${error.message}`, "UNKNOWN");
  }

  if (res.error) {
    const error = res.error as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new GitError(
        "Git is not installed or not available in PATH.",
        "GIT_NOT_FOUND",
        "Please install Git and ensure it is available in your PATH."
      );
    }
    throw new GitError(`Failed to execute Git: ${res.error.message}`, "UNKNOWN");
  }

  if (res.status !== 0) {
    throw new GitError(
      "Not a Git repository.",
      "NOT_GIT_REPO",
      "Run `snift install` from inside a Git repository."
    );
  }

  const rawGitDir = res.stdout.trim();
  if (!rawGitDir) {
    throw new GitError("Could not resolve Git directory.", "UNKNOWN");
  }

  const resolvedGitDir = path.isAbsolute(rawGitDir)
    ? path.normalize(rawGitDir)
    : path.resolve(cwd, rawGitDir);

  const hooksDir = path.join(resolvedGitDir, "hooks");

  return {
    gitDir: resolvedGitDir,
    hooksDir,
  };
}
