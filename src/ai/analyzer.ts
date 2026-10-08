import { SecretAnalysisInput, SecretAnalysisResult } from "../types";

/**
 * Provider-independent AI interface. The rest of Snift depends on this
 * interface, never on Gemma directly.
 */
export interface AIAnalyzer {
  analyzeCandidate(input: SecretAnalysisInput): Promise<SecretAnalysisResult>;
}

export class AIUnavailableError extends Error {
  constructor(message: string = "AI analysis unavailable") {
    super(message);
    this.name = "AIUnavailableError";
  }
}
