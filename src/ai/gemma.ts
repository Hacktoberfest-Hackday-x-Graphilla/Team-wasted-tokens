import { GoogleGenAI } from "@google/genai";
import type { Candidate } from "../types.js";
import { AI_MODEL } from "../config.js";
import { REDACTED_MARKER } from "../redact.js";
import { responseJsonSchema } from "./schema.js";

/**
 * Model client. The file is named for the project's open-weight Gemma plan:
 * open-weight Gemma models (e.g. gemma-4-31b-it) are selectable via AI_MODEL
 * in config.ts, but they must be verified to honor JSON response mode first.
 * The verified default is gemini-3.5-flash.
 */

/**
 * SCAFF-structured prompt: the AI sees only REDACTED context — the secret
 * values themselves never leave the machine.
 */
export function buildPrompt(candidates: Candidate[]): string {
  const items = candidates
    .map(
      (c) =>
        [
          `id: ${c.id}`,
          `file: ${c.file}`,
          `line: ${c.line}`,
          `rule: ${c.rule}`,
          `value masked as: ${REDACTED_MARKER}`,
          `line content: ${c.redactedLine}`,
          `context:`,
          ...c.context.map((l) => `  | ${l}`),
        ].join("\n"),
    )
    .join("\n---\n");

  return [
    "Situation: you are reviewing lines about to be committed to Git, as part of an automated pre-commit secret scanner. Every candidate value has been redacted before reaching you; you never see the raw secret.",
    "Challenge: for each candidate, classify whether it is a real credential (secret), plausibly one (likely_secret), or benign (a placeholder, hash, UUID, test fixture, documentation example, or non-credential identifier). Judge from structure, naming, and context.",
    "Audience: an automated hook that consumes machine-readable output only.",
    "Format: respond with JSON matching the provided schema: an object with a `findings` array where each item has `id` (echo the candidate id), `classification` (secret | likely_secret | benign), `confidence` (0.0-1.0), and `reason` (one short sentence). No text outside the JSON.",
    "Foundations: judge only from the supplied snippet and context. Do not guess beyond it. If the evidence is inconclusive, use likely_secret with a lower confidence rather than inventing a verdict.",
    "",
    "Candidates:",
    items,
  ].join("\n");
}

/** Sends the redacted prompt to the configured model and returns raw text. */
export async function callModel(
  candidates: Candidate[],
  abortSignal: AbortSignal,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: buildPrompt(candidates),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      temperature: 0,
      abortSignal,
    },
  });
  return response.text ?? "";
}
