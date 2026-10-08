import { PolicyResult, SecretAnalysisResult } from "./types";

/**
 * Deterministic, testable policy engine.
 *
 *  placeholder            -> ALLOW
 *  real secret, conf >= 0.85 -> BLOCK
 *  suspicious, conf >= 0.60  -> WARN
 *  otherwise              -> ALLOW
 *
 * `should_block` from the AI is considered but never trusted blindly.
 */
export function evaluatePolicy(
  analysis: SecretAnalysisResult,
  confidenceThreshold: number = 0.85,
  warnThreshold: number = 0.60,
  deterministicConfidence?: number
): PolicyResult {
  if (analysis.is_placeholder) {
    return { decision: "ALLOW", reason: "Classified as a placeholder." };
  }

  const aiConfidence = analysis.confidence;

  if (analysis.is_secret && aiConfidence >= confidenceThreshold) {
    return {
      decision: "BLOCK",
      reason: `Real ${analysis.secret_type} detected with ${Math.round(aiConfidence * 100)}% confidence.`,
    };
  }

  const combined = deterministicConfidence !== undefined
    ? Math.max(aiConfidence * 0.8 + deterministicConfidence * 0.2, aiConfidence - 0.15)
    : aiConfidence;

  const suspicious =
    (!analysis.is_secret && analysis.severity !== "low") ||
    analysis.should_block ||
    (deterministicConfidence !== undefined && deterministicConfidence >= 0.7);

  if (suspicious && combined >= warnThreshold) {
    return {
      decision: "WARN",
      reason: analysis.reason || "Suspicious credential-like value.",
    };
  }

  return { decision: "ALLOW", reason: "Below policy thresholds." };
}
