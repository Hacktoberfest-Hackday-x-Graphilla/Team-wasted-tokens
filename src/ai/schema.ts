import { z } from "zod";

export const SecretAnalysisResultSchema = z.object({
  is_secret: z.boolean(),
  secret_type: z.string(),
  provider: z.string(),
  confidence: z.number().min(0).max(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  is_placeholder: z.boolean(),
  reason: z.string(),
  recommended_action: z.string(),
  should_block: z.boolean(),
});

export type SecretAnalysisResult = z.infer<typeof SecretAnalysisResultSchema>;

/**
 * Strip Markdown code fences (```json ... ```) that models often wrap
 * around JSON, then return the raw payload string for parsing.
 */
export function stripCodeFence(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Parse and validate a model response. Malformed output is treated as an
 * AI failure: returns null instead of trusting raw output.
 */
export function validateAnalysisOutput(raw: string): SecretAnalysisResult | null {
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    const result = SecretAnalysisResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
