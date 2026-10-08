export interface AddedLine {
  file: string;
  line: number;
  content: string;
}

export interface SecretCandidate {
  file: string;
  line: number;
  detector: string;
  typeHint?: string;
  providerHint?: string;
  matchedValue?: string;
  redactedValue?: string;
  surroundingCode: string;
  entropyScore?: number;
  confidence: number;
}

export interface SecretAnalysisInput {
  file: string;
  line: number;
  variableName?: string;
  providerHint?: string;
  detector: string;
  entropyScore?: number;
  context: string; // must be redacted before reaching any AI
}

export type Severity = "low" | "medium" | "high" | "critical";

export interface SecretAnalysisResult {
  is_secret: boolean;
  secret_type: string;
  provider: string;
  confidence: number;
  severity: Severity;
  is_placeholder: boolean;
  reason: string;
  recommended_action: string;
  should_block: boolean;
}

export type PolicyDecision = "BLOCK" | "WARN" | "ALLOW";

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

export interface ScanFinding {
  candidate: SecretCandidate;
  analysis: SecretAnalysisResult;
  policy: PolicyResult;
}

export interface ScanStats {
  filesScanned: number;
  addedLines: number;
  relevantLines: number;
  candidates: number;
  secrets: number;
  warnings: number;
}

export interface ScanReport {
  findings: ScanFinding[];
  stats: ScanStats;
  aiFailure: boolean;
}
