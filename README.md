# Snift 🔐

> Sniff out secrets before they enter Git history.

Snift is an open-source, terminal-first Git pre-commit security tool that prevents developers from accidentally committing API keys, access tokens, passwords, private keys, database credentials, and other hardcoded secrets.

## Problem

Every day developers accidentally commit real credentials into Git history. Once pushed, secrets are effectively leaked forever — bots scrape public repos within minutes, and rewriting Git history is painful.

## Solution

Fast deterministic detection + secret redaction + open-weight Gemma contextual analysis + Git pre-commit enforcement.

```text
Deterministic Detection
        ↓
Secret Redaction
        ↓
Open-Weight Gemma
        ↓
Pre-Commit Enforcement
```

Deterministic scanners find suspicious candidates first. Gemma then analyzes the **redacted code context** to determine whether the candidate is actually a secret, its severity, confidence, and recommended remediation.

## Why Gemma

Snift uses Gemma for contextual reasoning — deciding whether a candidate is a real production credential or a harmless placeholder — rather than sending an entire repository to an LLM. Gemma receives only a tiny, redacted window of surrounding code.

## Privacy model

**Snift doesn't send your secrets to a proprietary AI API just to tell you not to leak them.**

```text
Secret detected locally
        ↓
Secret redacted locally
        ↓
Only safe context sent to Gemma
```

The actual secret value is replaced with `<SECRET_REDACTED>` before anything leaves your machine. Raw secrets never appear in AI prompts, AI responses, terminal output, error messages, or logs.

## Features

- `snift scan --staged` — scan staged changes only (not the whole repo)
- `snift install` — install the Git pre-commit hook (backs up existing hooks)
- `snift explain` — how Snift works
- Fast diff parsing + relevance pre-filtering (never send the raw diff anywhere)
- 14 deterministic detectors: AWS keys, GitHub tokens, Stripe keys, Google API keys, Slack tokens, JWTs, private keys, database URLs, bearer tokens, generic API keys / secrets / passwords / tokens
- Shannon entropy detection for high-entropy strings
- Placeholder / false-positive awareness (`YOUR_API_KEY`, `replace-me`, etc. are not blocked)
- Strict secret redaction at every boundary
- Zod validation of all AI output — malformed model responses are treated as AI failure
- Deterministic BLOCK / WARN / ALLOW policy engine
- Fail-closed: a high-confidence deterministic secret is blocked even if Gemma is unavailable

## Installation

```bash
npm install
npm run build
npm link
```

Verify:

```bash
snift --help
```

## Configuration

Optional `.sniftrc.json`:

```json
{
  "confidenceThreshold": 0.85,
  "scanStagedOnly": true,
  "gemmaEnabled": true
}
```

Environment (see `.env.example`; never commit `.env`):

```env
GEMMA_PROVIDER=local
GEMMA_MODEL=gemma
GEMMA_ENDPOINT=
GEMMA_ENABLED=true
```

`GEMMA_ENDPOINT` should point to any OpenAI-compatible chat completions endpoint serving Gemma. For Ollama:

```env
GEMMA_ENDPOINT=http://localhost:11434/v1/chat/completions
GEMMA_MODEL=gemma4:e2b
```

(Note: use Ollama's `/v1/chat/completions` URL, not `/api/generate`.)

## Demo

A pre-initialized sandbox lives at `examples/demo-repo` — Git is already initialized and the Snift pre-commit hook is already installed. Just copy an example in, stage it, and commit:

```bash
cd examples/demo-repo

cp ../vulnerable-project/payment.ts .   # fake hardcoded Stripe key
git add payment.ts
git commit -m "add payment integration"  # 🔴 BLOCKED by the hook

rm payment.ts
cp ../safe-project/payment.ts .
git add payment.ts
git commit -m "use environment variable" # ✓ ALLOWED
```

> After a blocked commit, the file stays staged. Run `rm <file> && git reset` before trying the next example, or the blocked file will ride along in the next commit.

To reset the sandbox to its clean state:

```bash
cd examples/demo-repo && git reset --hard HEAD
```

### Manual demo (any repo)
Install the hook:

```bash
snift install
```

Add a fake secret (never use a real one):

```ts
const stripeKey = "sk_live_FAKE_DEMO_SECRET";
```

Stage and commit:

```bash
git add .
git commit -m "add payment integration"
```

Expected:

```text
🔐 Snift

Scanning staged changes...

✓ 1 file scanned
✓ 18 added lines
✓ 1 suspicious candidate

Gemma analyzing context...

🔴 SECRET DETECTED

Stripe API credential
src/payment.ts:2
Confidence: 98%
Severity: CRITICAL

Move the credential to:
process.env.STRIPE_SECRET_KEY

Rotate the exposed credential.

❌ COMMIT BLOCKED
```

Fix it:

```ts
const stripeKey = process.env.STRIPE_SECRET_KEY;
```

Commit again — allowed:

```text
✓ 1 file scanned
✓ 0 secrets detected
✓ Gemma analysis passed

✓ COMMIT ALLOWED
```

## Exit codes

```text
0 = no blocking secrets
1 = blocking finding
2 = configuration/runtime error
```

## Testing

```bash
npm test
```

Tests cover deterministic detection, redaction (raw secrets never leak into AI input), the policy engine, diff parsing/filtering, and hook installation.

## Example projects

- `examples/vulnerable-project/` — fake hardcoded Stripe key
- `examples/placeholder-project/` — obvious placeholder values
- `examples/safe-project/` — environment-variable usage

## Security considerations

- Snift never prints, logs, stores, or transmits raw secret values.
- Snift detects suspicious credential patterns; it never claims a credential is valid.
- The raw Git diff is never sent to any AI service — only small redacted context windows around candidates.
- All model output is validated with Zod; malformed output is treated as an AI failure.
- If Gemma is unavailable, high-confidence deterministic candidates still block the commit (fail closed).

## Limitations

- Detection is heuristic; novel secret formats may be missed.
- Gemma classification depends on the configured endpoint being reachable.
- Entropy detection alone is not proof of a secret.
- Only staged changes are scanned.

## Roadmap

These are planned, not yet implemented:

- GitHub Actions integration
- SARIF output
- Sentry reporting
- MongoDB analytics
- GitHub integration
- More detectors
- IDE integrations
- Secret rotation

## License

MIT
