import { spawnSync } from "node:child_process";
import { DIFF_LIMITS, shouldSkipFile } from "./config.js";
import { redactSafeContext } from "./redact.js";
import type { StagedAddition } from "./types.js";

export type { StagedAddition };
export { shouldSkipFile };

/**
 * Runs `git diff --cached` and returns added lines only. Removed lines are
 * already in history and are not a new exposure, so they are ignored.
 */
export function getStagedAdditions(
  limits: typeof DIFF_LIMITS = DIFF_LIMITS,
): { additions: StagedAddition[]; truncated: boolean } {
  const proc = spawnSync(
    "git",
    ["diff", "--cached", "--no-color", "--no-ext-diff", `-U${limits.contextLines}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (proc.error) {
    throw new Error(`Failed to run git diff --cached: ${proc.error.message}`);
  }
  return parseDiff(proc.stdout, limits);
}

/** Splits a unified diff into per-file sections ("diff --git ..." to next header). */
export function splitFileSections(diff: string): string[] {
  const sections: string[] = [];
  let current: string[] | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current) sections.push(current.join("\n"));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) sections.push(current.join("\n"));
  return sections;
}

/** Parses one `diff --git a/<path> b/<path>` section into staged additions. */
export function parseFileSection(
  section: string,
  limits: typeof DIFF_LIMITS = DIFF_LIMITS,
): StagedAddition[] {
  const headerLine = section.split("\n")[0];
  const file = extractNewPath(section, headerLine);
  if (!file || shouldSkipFile(file)) return [];

  // Binary patches carry no diff hunk headers we can parse; skip them.
  if (/^Binary files |^GIT binary patch$/m.test(section)) return [];

  const additions: StagedAddition[] = [];
  let newLine = 0;
  let inHunk = false;
  let contextWindow: string[] = [];

  for (const line of section.split("\n")) {
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      inHunk = true;
      newLine = parseInt(hunkMatch[1], 10);
      contextWindow = [];
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) {
      const text = line.slice(1);
      additions.push({
        file,
        line: newLine,
        text,
        context: [...contextWindow.slice(-limits.contextLines), text].map(redactSafeContext),
      });
      contextWindow.push(text);
      newLine++;
    } else if (line.startsWith("-")) {
      // Removed line: exists in history, not a new exposure. Not in new-file numbering.
      continue;
    } else if (line.startsWith(" ") || line === "") {
      contextWindow.push(line.startsWith(" ") ? line.slice(1) : line);
      newLine++;
    }
    // "\ No newline at end of file" and other markers are ignored.
  }
  return additions;
}

function extractNewPath(section: string, headerLine: string): string | null {
  // Prefer the +++ line: handles renames and quoted paths.
  const plus = /^\+\+\+ b\/(.+)$/m.exec(section);
  if (plus) return stripQuotes(plus[1]);
  const m = /^diff --git a\/(.+) b\/(.+)$/.exec(headerLine);
  return m ? stripQuotes(m[2]) : null;
}

function stripQuotes(path: string): string {
  if (path.startsWith('"') && path.endsWith('"')) {
    try {
      return JSON.parse(path) as string;
    } catch {
      /* fall through */
    }
  }
  return path;
}

/** Full parse of a unified diff output. */
export function parseDiff(
  diff: string,
  limits: typeof DIFF_LIMITS = DIFF_LIMITS,
): { additions: StagedAddition[]; truncated: boolean } {
  const additions: StagedAddition[] = [];
  let truncated = false;

  for (const section of splitFileSections(diff)) {
    let fileAdditions = parseFileSection(section, limits);
    if (fileAdditions.length > limits.maxAddedLinesPerFile) {
      fileAdditions = fileAdditions.slice(0, limits.maxAddedLinesPerFile);
      truncated = true;
    }
    additions.push(...fileAdditions);
    if (additions.length >= limits.maxTotalAddedLines) {
      truncated = true;
      break;
    }
  }
  return { additions: additions.slice(0, limits.maxTotalAddedLines), truncated };
}
