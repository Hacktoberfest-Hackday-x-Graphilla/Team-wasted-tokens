import { execFile } from "child_process";
import {
  SecretAnalysisInput,
  SecretAnalysisResult,
} from "../types";
import { AIAnalyzer, AIUnavailableError } from "./analyzer";
import { validateAnalysisOutput } from "./schema";
import { loadConfig } from "../config";

export const SYSTEM_PROMPT = `You are Snift, a security analysis engine.

Determine whether a suspicious code value is likely to be a real credential or a harmless placeholder.

SECURITY RULES:
1. The secret value has been redacted.
2. Never ask for the original secret.
3. Never attempt to reconstruct the original secret.
4. Never output or guess the original secret.
5. Use code context, variable names, provider hints, detector type, entropy, and usage.
6. Distinguish production credentials from placeholders, documentation examples, test values, mock credentials, and generated identifiers.
7. Prefer conservative security decisions.
8. Return ONLY valid JSON matching the requested schema.

Determine:
- whether this is a real secret
- secret type
- provider
- confidence
- severity
- whether it is a placeholder
- explanation
- recommended remediation
- whether Snift should block the commit

Respond with ONLY a JSON object with these exact keys:
{"is_secret": boolean, "secret_type": string, "provider": string, "confidence": number (0-1), "severity": "low"|"medium"|"high"|"critical", "is_placeholder": boolean, "reason": string, "recommended_action": string, "should_block": boolean}`;

function buildUserPrompt(input: SecretAnalysisInput): string {
  // Input context MUST already be redacted by the caller; redact again defensively.
  return JSON.stringify(
    {
      file: input.file,
      line: input.line,
      variable_name: input.variableName,
      provider_hint: input.providerHint,
      detector: input.detector,
      entropy_score: input.entropyScore,
      context: input.context,
    },
    null,
    2
  );
}

/**
 * Gemma analyzer. Talks to a configurable local or HTTP inference endpoint
 * (OpenAI-compatible /v1/chat/completions by default). Not coupled to any
 * single inference service; another provider can implement AIAnalyzer.
 */
export class GemmaAnalyzer implements AIAnalyzer {
  private endpoint: string;
  private model: string;

  constructor(endpoint?: string, model?: string) {
    const cfg = loadConfig();
    this.endpoint = endpoint ?? cfg.gemmaEndpoint;
    this.model = model ?? cfg.gemmaModel;
  }

  async analyzeCandidate(input: SecretAnalysisInput): Promise<SecretAnalysisResult> {
    if (!this.endpoint) {
      throw new AIUnavailableError(
        "GEMMA_ENDPOINT is not configured; set it in .env or .sniftrc.json"
      );
    }
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0,
      stream: false,
    });

    const raw = await this.post(body);
    const content = extractChatContent(raw);
    if (content === null) {
      throw new AIUnavailableError("Gemma returned an unreadable response");
    }
    const validated = validateAnalysisOutput(content);
    if (!validated) {
      throw new AIUnavailableError("Gemma returned malformed output");
    }
    return validated;
  }

  private post(body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "curl",
        [
          "-sS",
          "--max-time",
          "60",
          "-H",
          "Content-Type: application/json",
          "-d",
          body,
          this.endpoint,
        ],
        { maxBuffer: 16 * 1024 * 1024 },
        (err, stdout) => {
          if (err) reject(new AIUnavailableError(`Gemma endpoint unreachable: ${err.message}`));
          else resolve(stdout);
        }
      );
    });
  }
}

/** Extract the assistant message content from a chat-completions response. */
export function extractChatContent(responseJson: string): string | null {
  try {
    const parsed = JSON.parse(responseJson);
    const content = parsed?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
