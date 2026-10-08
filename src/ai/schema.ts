import { z } from "zod";

/** Runtime validation of the AI's JSON response. */
export const verdictSchema = z.object({
  findings: z.array(
    z.object({
      id: z.string(),
      classification: z.enum(["secret", "likely_secret", "benign"]),
      confidence: z.number().min(0).max(1),
      reason: z.string().max(500),
    }),
  ),
});

/**
 * Response JSON schema sent to Gemini so output stays machine-parseable.
 * Hand-written (not derived from the zod schema) for explicitness.
 */
export const responseJsonSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          classification: {
            type: "string",
            enum: ["secret", "likely_secret", "benign"],
          },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["id", "classification", "confidence", "reason"],
      },
    },
  },
  required: ["findings"],
} as const;
