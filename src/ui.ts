import chalk from "chalk";
import { ScanReport, ScanFinding } from "./types";
import { SECRET_PATTERNS } from "./detectors/patterns";
import { findHighEntropyStrings } from "./detectors/entropy";

/**
 * Last-resort leak guard: redact anything secret-shaped before it can be
 * printed to the terminal. Applied to every line of rendered output.
 */
function guardOutput(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern.regex, (m: string, g?: string) =>
      g !== undefined ? m.replace(g, "<SECRET_REDACTED>") : "<SECRET_REDACTED>"
    );
  }
  for (const hit of findHighEntropyStrings(out)) {
    out = out.split(hit.value).join("<SECRET_REDACTED>");
  }
  return out;
}

function box(lines: string[]): string {
  const width = Math.max(...lines.map((l) => stripAnsi(l).length)) + 2;
  const top = "╭" + "─".repeat(width) + "╮";
  const bottom = "╰" + "─".repeat(width) + "╯";
  const body = lines
    .map((l) => "│" + l + " ".repeat(width - stripAnsi(l).length) + "│")
    .map(guardOutput)
    .join("\n");
  return [top, body, bottom].join("\n");
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function printBanner(): void {
  console.log(chalk.magenta("🔐 Snift"));
  console.log();
}

export function printScanStart(): void {
  console.log("Scanning staged changes...");
  console.log();
}

export function printProgress(report: { stats: ScanReport["stats"] }): void {
  const s = report.stats;
  console.log(chalk.green(`✓ ${s.filesScanned} file${s.filesScanned === 1 ? "" : "s"} scanned`));
  console.log(chalk.green(`✓ ${s.addedLines} added line${s.addedLines === 1 ? "" : "s"}`));
  console.log(chalk.green("✓ Deterministic scan complete"));
  console.log();
}

export function printBlockedFinding(f: ScanFinding): void {
  const a = f.analysis;
  const c = f.candidate;
  const lines = [
    chalk.red("🔴 SECRET DETECTED"),
    "",
    `Type: ${a.secret_type || c.typeHint || "Unknown"}`,
    `File: ${c.file}`,
    `Line: ${c.line}`,
    `Confidence: ${Math.round(Math.max(a.confidence, c.confidence) * 100)}%`,
    `Severity: ${a.severity.toUpperCase()}`,
    "",
    "Why?",
    ...wrap(a.reason || c.typeHint || "Credential-like value.", 42),
    "",
    "Recommended fix:",
    ...wrap(a.recommended_action || "Move the credential to an environment variable.", 42),
  ];
  console.log(box(lines));
  console.log();
  console.log(chalk.red("❌ COMMIT BLOCKED"));
  console.log();
}

export function printWarningFinding(f: ScanFinding): void {
  const a = f.analysis;
  const c = f.candidate;
  const lines = [
    chalk.yellow("🟡 POSSIBLE SECRET"),
    "",
    `File: ${c.file}`,
    `Line: ${c.line}`,
    `Type: ${a.secret_type || c.typeHint || "Unknown"}`,
    `Confidence: ${Math.round(Math.max(a.confidence, c.confidence) * 100)}%`,
    "",
    ...wrap(a.reason || "Suspicious credential-like value.", 42),
  ];
  console.log(box(lines));
  console.log();
}

export function printAiFailureNote(): void {
  console.log(chalk.yellow("⚠ Gemma analysis unavailable."));
  console.log();
  console.log("A high-confidence credential candidate was detected.");
  console.log();
  console.log("For safety, Snift will block the commit.");
  console.log();
}

export function printAiAnalyzing(): void {
  console.log("Gemma analyzing context...");
  console.log();
}

export function printSummary(report: ScanReport): void {
  const s = report.stats;
  const status =
    s.secrets > 0 ? "BLOCKED" : s.warnings > 0 ? "WARNED" : "ALLOWED";
  console.log("Scan Summary");
  console.log("────────────────────────────");
  console.log(`Files scanned:       ${s.filesScanned}`);
  console.log(`Added lines:         ${s.addedLines}`);
  console.log(`Candidates:          ${s.candidates}`);
  console.log(`Secrets:             ${s.secrets}`);
  console.log(`Warnings:            ${s.warnings}`);
  console.log(`Status:              ${status}`);
  console.log();
}

export function printAllowed(noFindings: boolean): void {
  if (noFindings) {
    console.log(chalk.green("✓ 0 secrets detected"));
    console.log(chalk.green("✓ Gemma analysis passed"));
  }
  console.log();
  console.log(chalk.green("✓ COMMIT ALLOWED"));
  console.log();
}

export function printError(message: string): void {
  console.error(chalk.red(`❌ ${message}`));
}
