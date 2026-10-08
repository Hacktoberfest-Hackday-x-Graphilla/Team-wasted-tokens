import { getStagedAdditions } from "./git.js";
import { scanAdditions } from "./detectors/index.js";
import { triageWithAI } from "./ai/analyzer.js";
import { toFindings } from "./policy.js";
import type { ScanResult } from "./types.js";

/**
 * Full staged-change pipeline:
 * staged-diff extraction -> deterministic detectors -> AI triage of redacted
 * candidates -> block/warn/pass decision.
 */
export async function scanStaged(): Promise<ScanResult> {
  const { additions, truncated } = getStagedAdditions();
  if (additions.length === 0) {
    return { blocked: [], warned: [], aiUsed: false, truncated: false };
  }

  const candidates = scanAdditions(additions);
  if (candidates.length === 0) {
    return { blocked: [], warned: [], aiUsed: false, truncated };
  }

  const { verdicts, ok: aiUsed } = await triageWithAI(candidates);
  const { blocked, warned } = toFindings(candidates, verdicts);

  return { blocked, warned, aiUsed, truncated };
}
