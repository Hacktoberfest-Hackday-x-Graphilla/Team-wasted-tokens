import { AddedLine, ScanReport, ScanFinding, SecretCandidate, SecretAnalysisInput } from "./types";
import { getStagedDiff, parseAddedLines } from "./git";
import { filterRelevantLines } from "./detectors/relevance";
import { detectSecrets } from "./detectors";
import { redactInText, ensureRedacted, REDACTED } from "./redact";
import { extractVariableName } from "./detectors/regex";
import { AIAnalyzer } from "./ai/analyzer";
import { evaluatePolicy } from "./policy";
import { SniftConfig } from "./config";

/**
 * Convert a candidate into the safe analysis input that may be sent to AI.
 * Redaction happens here, at the boundary — the raw matched value never
 * leaves this function.
 */
export function toAnalysisInput(
  candidate: SecretCandidate,
  surroundingCode: string
): SecretAnalysisInput {
  const redactedContext = ensureRedacted(surroundingCode, candidate.matchedValue);
  const varName = extractVariableName(
    surroundingCode.split("\n")[0] ?? "",
    candidate.matchedValue ?? ""
  );
  return {
    file: candidate.file,
    line: candidate.line,
    variableName: varName,
    providerHint: candidate.providerHint,
    detector: candidate.detector,
    entropyScore: candidate.entropyScore,
    context: redactedContext,
  };
}

export interface ScannerDeps {
  getDiff: (repoRoot: string) => Promise<string>;
}

export const defaultDeps: ScannerDeps = { getDiff: getStagedDiff };

/**
 * Full pipeline:
 * git diff -> parse added lines -> relevance filter -> deterministic
 * detection -> context building -> redaction -> AI -> policy.
 */
export async function scanStaged(
  repoRoot: string,
  analyzer: AIAnalyzer,
  config: SniftConfig,
  deps: ScannerDeps = defaultDeps
): Promise<ScanReport> {
  const diff = await deps.getDiff(repoRoot);
  const addedLines: AddedLine[] = parseAddedLines(diff);
  const relevantLines = filterRelevantLines(addedLines);
  const files = new Set(addedLines.map((l) => l.file));
  const candidates = detectSecrets(relevantLines);

  const findings: ScanFinding[] = [];
  let aiFailure = false;

  for (const candidate of candidates) {
    const input = toAnalysisInput(candidate, candidate.surroundingCode);
    try {
      const analysis = config.gemmaEnabled
        ? await analyzer.analyzeCandidate(input)
        : unavailableAnalysis();
      const policy = evaluatePolicy(
        analysis,
        config.confidenceThreshold,
        0.6,
        candidate.confidence
      );
      findings.push({ candidate, analysis, policy });
    } catch {
      // Safe Gemma failure: fall back to deterministic-only decision.
      aiFailure = true;
      findings.push({
        candidate,
        analysis: unavailableAnalysis(),
        policy: failClosedPolicy(candidate),
      });
    }
  }

  return {
    findings,
    aiFailure,
    stats: {
      filesScanned: files.size,
      addedLines: addedLines.length,
      relevantLines: relevantLines.length,
      candidates: candidates.length,
      secrets: findings.filter((f) => f.policy.decision === "BLOCK").length,
      warnings: findings.filter((f) => f.policy.decision === "WARN").length,
    },
  };
}

function unavailableAnalysis() {
  return {
    is_secret: false,
    secret_type: "unknown",
    provider: "unknown",
    confidence: 0,
    severity: "low" as const,
    is_placeholder: false,
    reason: "AI analysis unavailable.",
    recommended_action: "Review the candidate manually.",
    should_block: false,
  };
}

/**
 * Fail closed: a high-confidence deterministic candidate must not become
 * allowed just because Gemma is unavailable.
 */
function failClosedPolicy(candidate: SecretCandidate) {
  if (candidate.confidence >= 0.85) {
    return {
      decision: "BLOCK" as const,
      reason: "Gemma analysis unavailable; high-confidence deterministic candidate blocked for safety.",
    };
  }
  if (candidate.confidence >= 0.6) {
    return {
      decision: "WARN" as const,
      reason: "Gemma analysis unavailable; suspicious candidate reported as warning.",
    };
  }
  return { decision: "ALLOW" as const, reason: "Low deterministic confidence; allowed." };
}

export { REDACTED };
