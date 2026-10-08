import { AddedLine, SecretCandidate } from "../types";
import { SECRET_PATTERNS, SecretPattern } from "./patterns";
import { shannonEntropy, findHighEntropyStrings } from "./entropy";
import { isPlaceholderValue, extractVariableName } from "./regex";
import { REDACTED } from "../redact";

const CONTEXT_LINES = 5;

/** Build a small source context (5 before + candidate + 5 after) around a line index. */
function redactInTextLocal(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern.regex, (m: string, g?: string) =>
      g !== undefined ? m.replace(g, REDACTED) : REDACTED
    );
  }
  return out;
}

export function buildContext(
  lines: AddedLine[],
  index: number,
  radius: number = CONTEXT_LINES
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines
    .slice(start, end)
    .map((l) => redactInTextLocal(l.content))
    .join("\n");
}

function patternCandidates(
  line: AddedLine,
  index: number,
  allLines: AddedLine[]
): SecretCandidate[] {
  const out: SecretCandidate[] = [];
  for (const pattern of SECRET_PATTERNS) {
    const match = pattern.regex.exec(line.content);
    if (!match) continue;
    const matchedValue = match[1] ?? match[0];
    const placeholder = isPlaceholderValue(matchedValue);
    const candidate: SecretCandidate = {
      file: line.file,
      line: line.line,
      detector: pattern.name,
      typeHint: pattern.typeHint,
      providerHint: pattern.providerHint,
      matchedValue,
      redactedValue: REDACTED,
      surroundingCode: buildContext(allLines, index),
      entropyScore: shannonEntropy(matchedValue),
      confidence: placeholder ? Math.min(pattern.confidence, 0.5) : pattern.confidence,
    };
    const varName = extractVariableName(line.content, matchedValue);
    if (varName) {
      (candidate as SecretCandidate & { variableName?: string }).variableName = varName;
    }
    out.push(candidate);
  }
  return out;
}

function entropyCandidates(
  line: AddedLine,
  index: number,
  allLines: AddedLine[]
): SecretCandidate[] {
  return findHighEntropyStrings(line.content).map((hit) => {
    const candidate: SecretCandidate = {
      file: line.file,
      line: line.line,
      detector: "entropy",
      typeHint: "High-entropy string",
      providerHint: "unknown",
      matchedValue: hit.value,
      redactedValue: REDACTED,
      surroundingCode: buildContext(allLines, index),
      entropyScore: hit.entropy,
      confidence: 0.4,
    };
    const varName = extractVariableName(line.content, hit.value);
    if (varName) {
      (candidate as SecretCandidate & { variableName?: string }).variableName = varName;
    }
    return candidate;
  });
}

function dedupe(candidates: SecretCandidate[]): SecretCandidate[] {
  const seen = new Set<string>();
  const out: SecretCandidate[] = [];
  const ordered = [...candidates].sort((a, b) => b.confidence - a.confidence);
  for (const c of ordered) {
    const key = `${c.file}:${c.line}:${c.detector}`;
    // Same file+line from a pattern beats an entropy-only candidate.
    const broadKey = `${c.file}:${c.line}`;
    if (seen.has(key)) continue;
    if (c.detector === "entropy" && seen.has(broadKey)) continue;
    seen.add(key);
    if (c.detector !== "entropy") seen.add(broadKey);
    out.push(c);
  }
  return out;
}

/**
 * Run deterministic detectors over pre-filtered relevant lines.
 * Identifies suspicious candidates; never claims credentials are valid.
 */
export function detectSecrets(relevantLines: AddedLine[]): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];
  relevantLines.forEach((line, index) => {
    // Skip obvious environment-variable lookups (not hardcoded secrets).
    if (/process\.env\.\w+|os\.environ|ENV\[[^\]]+\]|getenv\(/.test(line.content)) {
      return;
    }
    candidates.push(...patternCandidates(line, index, relevantLines));
    candidates.push(...entropyCandidates(line, index, relevantLines));
  });
  return dedupe(candidates);
}

export { SECRET_PATTERNS, SecretPattern };
