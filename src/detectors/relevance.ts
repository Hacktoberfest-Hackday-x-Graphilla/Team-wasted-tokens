/**
 * Relevance heuristics: how strongly does the surrounding text suggest that a
 * generic (e.g. high-entropy) candidate is a credential rather than, say, a
 * content hash or a build artifact name?
 */

const CREDENTIAL_KEYWORDS =
  /(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|auth|credential|private[_-]?key|signing)/i;

/** True when the line (or nearby context) mentions credential-style naming. */
export function isCredentialRelevant(line: string, context: string[] = []): boolean {
  if (CREDENTIAL_KEYWORDS.test(line)) return true;
  return context.some((l) => CREDENTIAL_KEYWORDS.test(l));
}
