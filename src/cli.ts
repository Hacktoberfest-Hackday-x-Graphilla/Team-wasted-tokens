#!/usr/bin/env node
import { Command } from "commander";
import * as path from "path";
import { loadConfig } from "./config";
import { isGitRepository } from "./git";
import { scanStaged } from "./scanner";
import { GemmaAnalyzer } from "./ai/gemma";
import { AIAnalyzer } from "./ai/analyzer";
import { installPreCommitHook } from "./hook/install";
import {
  printBanner,
  printScanStart,
  printProgress,
  printBlockedFinding,
  printWarningFinding,
  printAiFailureNote,
  printAiAnalyzing,
  printSummary,
  printAllowed,
  printError,
} from "./ui";
import { ScanReport } from "./types";

const VERSION = "0.1.0";

class MockAIAnalyzer implements AIAnalyzer {
  async analyzeCandidate() {
    return {
      is_secret: true,
      secret_type: "api_key",
      provider: "stripe",
      confidence: 0.98,
      severity: "critical" as const,
      is_placeholder: false,
      reason: "Credential-like value used as a Stripe key.",
      recommended_action:
        "Move the credential to an environment variable and rotate it.",
      should_block: true,
    };
  }
}

async function runScan(staged: boolean): Promise<number> {
  const config = loadConfig();
  const repoRoot = process.cwd();

  if (!isGitRepository(repoRoot)) {
    printError("Not a Git repository.");
    return 2;
  }

  printBanner();
  printScanStart();

  let report: ScanReport;
  try {
    const analyzer: AIAnalyzer = config.gemmaEnabled
      ? new GemmaAnalyzer()
      : new MockAIAnalyzer();
    report = await scanStaged(repoRoot, analyzer, config);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Scan failed.");
    return 2;
  }

  printProgress(report);

  if (report.aiFailure) {
    printAiFailureNote();
  }

  for (const finding of report.findings) {
    if (finding.policy.decision === "BLOCK") {
      printBlockedFinding(finding);
    } else if (finding.policy.decision === "WARN") {
      printWarningFinding(finding);
    }
  }

  printSummary(report);

  if (report.stats.secrets > 0) {
    return 1;
  }
  return 0;
}

const program = new Command();

program
  .name("snift")
  .description("Sniff out secrets before they enter Git history.")
  .version(VERSION);

program
  .command("scan")
  .description("Scan staged changes for hardcoded secrets")
  .option("--staged", "Scan staged changes only (default)")
  .action(async () => {
    const exit = await runScan(true);
    process.exitCode = exit;
  });

program
  .command("install")
  .description("Install the Git pre-commit hook")
  .action(() => {
    printBanner();
    const repoRoot = process.cwd();
    const result = installPreCommitHook(repoRoot);
    if (result.ok) {
      console.log("✓ Pre-commit hook installed successfully.");
      console.log();
      console.log("Secrets will now be scanned before every commit.");
    } else {
      printError(result.message);
      process.exitCode = 2;
    }
  });

program
  .command("explain")
  .description("Explain how Snift works")
  .action(() => {
    printBanner();
    console.log("How Snift works:");
    console.log();
    console.log("  1. Deterministic detection  - fast regex + entropy scanners find candidates in staged diffs.");
    console.log("  2. Secret redaction         - raw secret values are replaced with <SECRET_REDACTED> locally.");
    console.log("  3. Open-weight Gemma        - only redacted context is analyzed to confirm real secrets vs placeholders.");
    console.log("  4. Pre-commit enforcement   - the Git hook blocks commits containing confirmed secrets.");
    console.log();
    console.log("Your actual secret values never leave your machine.");
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
