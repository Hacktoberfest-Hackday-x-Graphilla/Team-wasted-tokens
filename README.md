# Snift: detect and filter secrets before they reach Git.
Sniff out secrets before they enter Git history.

Snift is an open-source, terminal-first Git pre-commit security tool that prevents developers from accidentally committing API keys, access tokens, passwords, private keys, database credentials, bearer tokens, and other hardcoded secrets.

## Problem

Developers routinely commit credentials by accident. Once a secret enters Git history, it is effectively public — rebasing it away does not undo clones, forks, and CI caches.

## Solution

```text
Fast deterministic detection
        +
Secret redaction
        +
Open-weight Gemma contextual analysis
        +
Git pre-commit enforcement
```

Deterministic scanners find suspicious candidates first. Gemma then analyzes the **redacted** code context to determine whether a candidate is actually a secret, its severity, confidence, and recommended remediation.

## Features

- `snift scan` — scan the working tree
- `snift scan --staged` — scan staged changes (used by the hook)
- `snift install` — install the Git pre-commit hook (backs up existing hooks)
