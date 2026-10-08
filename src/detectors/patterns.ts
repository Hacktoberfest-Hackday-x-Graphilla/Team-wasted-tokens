export interface SecretPattern {
  name: string;
  regex: RegExp;
  typeHint: string;
  providerHint?: string;
  confidence: number;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "aws-access-key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    typeHint: "AWS access key",
    providerHint: "AWS",
    confidence: 0.95,
  },
  {
    name: "github-token",
    regex: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/,
    typeHint: "GitHub token",
    providerHint: "GitHub",
    confidence: 0.95,
  },
  {
    name: "github-pat",
    regex: /\b(github_pat_[A-Za-z0-9_]{20,})\b/,
    typeHint: "GitHub personal access token",
    providerHint: "GitHub",
    confidence: 0.95,
  },
  {
    name: "stripe-key",
    regex: /\b(sk_(?:live|test)_[A-Za-z0-9_-]{10,})\b/,
    typeHint: "Stripe API credential",
    providerHint: "Stripe",
    confidence: 0.9,
  },
  {
    name: "google-api-key",
    regex: /\b(AIza[0-9A-Za-z_-]{30,})\b/,
    typeHint: "Google API key",
    providerHint: "Google",
    confidence: 0.9,
  },
  {
    name: "slack-token",
    regex: /\b(xox[abprs]-[A-Za-z0-9-]{10,})\b/,
    typeHint: "Slack token",
    providerHint: "Slack",
    confidence: 0.9,
  },
  {
    name: "jwt",
    regex: /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/,
    typeHint: "JSON Web Token",
    providerHint: "unknown",
    confidence: 0.8,
  },
  {
    name: "private-key",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
    typeHint: "Private key",
    providerHint: "unknown",
    confidence: 0.97,
  },
  {
    name: "database-url",
    regex: /\b\w[\w+.-]*:\/\/[^:\s"'`]+:[^@\s"'`]+@/,
    typeHint: "Database connection string",
    providerHint: "unknown",
    confidence: 0.85,
  },
  {
    name: "bearer-token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
    typeHint: "Bearer token",
    providerHint: "unknown",
    confidence: 0.75,
  },
  {
    name: "generic-api-key",
    regex: /(?:api[_-]?key)["'\s]*[:=]\s*["'`]([^"'`\s]{8,})["'`]/i,
    typeHint: "API key",
    providerHint: "unknown",
    confidence: 0.7,
  },
  {
    name: "generic-secret",
    regex: /(?:secret[_-]?key|client[_-]?secret)["'\s]*[:=]\s*["'`]([^"`\s]{8,})["'`]/i,
    typeHint: "Secret key",
    providerHint: "unknown",
    confidence: 0.7,
  },
  {
    name: "generic-password",
    regex: /(?:password|passwd|pwd)["'\s]*[:=]\s*["'`]([^"'`\s]{4,})["'`]/i,
    typeHint: "Password",
    providerHint: "unknown",
    confidence: 0.65,
  },
  {
    name: "generic-token",
    regex: /(?:access[_-]?token|auth[_-]?token|token)["'\s]*[:=]\s*["'`]([^"'`\s]{8,})["'`]/i,
    typeHint: "Access token",
    providerHint: "unknown",
    confidence: 0.65,
  },
];
