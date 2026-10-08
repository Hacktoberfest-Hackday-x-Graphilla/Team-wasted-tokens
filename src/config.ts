/** Central configuration: limits, model, thresholds, skip rules. */

/** Model used for contextual triage. gemini-3.8-flash hangs on some keys. */
export const AI_MODEL = "gemini-3.5-flash";
export const AI_TIMEOUT_MS = 20_000;
/** AI confidence at or above which a `secret`/`likely_secret` verdict blocks. */
export const AI_BLOCK_CONFIDENCE = 0.8;

export interface DiffLimits {
  maxTotalAddedLines: number;
  maxAddedLinesPerFile: number;
  contextLines: number;
}

export const DIFF_LIMITS: DiffLimits = {
  maxTotalAddedLines: 2000,
  maxAddedLinesPerFile: 500,
  contextLines: 3,
};

/** Files that are never new-exposure risks: lockfiles and vendored code. */
const SKIP_FILE_PATTERNS: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)[^/]*\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)composer\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/)poetry\.lock$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
];

export function shouldSkipFile(file: string): boolean {
  return SKIP_FILE_PATTERNS.some((re) => re.test(file));
}

/** Length + Shannon-entropy threshold for generic high-entropy candidates. */
export const ENTROPY_MIN_LENGTH = 20;
export const ENTROPY_THRESHOLD = 3.5;
