import type { Candidate, Verdict } from "../types.js";
import { AI_TIMEOUT_MS } from "../config.js";
import { callModel } from "./gemma.js";
import { verdictSchema } from "./schema.js";

export interface TriageResult {
  verdicts: Map<string, Verdict>;
  /** False when the AI layer was skipped or failed — caller falls back to rules. */
  ok: boolean;
}

/**
 * Sends redacted candidates to the model for triage. Returns ok=false on any
 * failure (no API key, error, timeout, unparseable response) so the caller
 * can fall back to the deterministic layer alone.
 */
export async function triageWithAI(
  candidates: Candidate[],
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<TriageResult> {
  if (!process.env.GEMINI_API_KEY || candidates.length === 0) {
    return { verdicts: new Map(), ok: false };
  }

  // Abort the in-flight request on timeout so the process can exit promptly.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await callModel(candidates, controller.signal);
    const parsed = verdictSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { verdicts: new Map(), ok: false };
    }

    const verdicts = new Map<string, Verdict>();
    for (const f of parsed.data.findings) {
      if (candidates.some((c) => c.id === f.id)) {
        verdicts.set(f.id, {
          id: f.id,
          classification: f.classification,
          confidence: f.confidence,
          reason: f.reason,
        });
      }
    }
    return { verdicts, ok: true };
  } catch (err) {
    // Fail safe: caller falls back to the deterministic layer. Never log
    // candidate content here — only the transport/API error itself.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`snift: AI triage skipped (${msg})`);
    return { verdicts: new Map(), ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
