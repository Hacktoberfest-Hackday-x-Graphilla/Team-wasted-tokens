import { execFile } from "child_process";
import { AddedLine } from "./types";

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Run `git diff --cached --unified=20` in the given repo root and return the
 * raw diff output.
 */
export function getStagedDiff(repoRoot: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["diff", "--cached", "--unified=20"],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        if (err) reject(new Error(`git diff failed: ${err.message}`));
        else resolve(stdout);
      }
    );
  });
}

export function isGitRepository(repoRoot: string): boolean {
  return execFileSyncSafe(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
}

function execFileSyncSafe(cwd: string, args: string[]): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execFileSync } = require("child_process");
    const out = execFileSync("git", args, { cwd, encoding: "utf8" });
    return out.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Parse a unified diff into per-file added lines.
 * - Strips diff metadata (diff --git, index, ---, +++, @@, mode lines).
 * - Only extracts lines beginning with `+` (added), removing the leading `+`.
 * - Never treats `+++ b/...` headers as source content.
 * - Unchanged context lines (starting with space) are ignored.
 */
export function parseAddedLines(diff: string): AddedLine[] {
  const added: AddedLine[] = [];
  let currentFile = "";
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    const header = FILE_HEADER.exec(raw);
    if (header) {
      currentFile = header[2];
      continue;
    }
    const hunk = HUNK_HEADER.exec(raw);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      continue;
    }
    if (!currentFile) continue;

    // Skip any remaining metadata lines before real content.
    if (
      raw.startsWith("index ") ||
      raw.startsWith("old mode") ||
      raw.startsWith("new mode") ||
      raw.startsWith("new file mode") ||
      raw.startsWith("deleted file mode") ||
      raw.startsWith("similarity index") ||
      raw.startsWith("rename from") ||
      raw.startsWith("rename to") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ")
    ) {
      continue;
    }

    if (raw.startsWith("+")) {
      added.push({
        file: currentFile,
        line: newLine,
        content: raw.slice(1),
      });
      newLine += 1;
    } else if (raw.startsWith("-")) {
      // deletion: does not advance new-file line counter
    } else if (raw.startsWith(" ") || raw === "") {
      newLine += 1;
    }
  }

  return added;
}
