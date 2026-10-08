import chalk from "chalk";
import type { ScanResult } from "./types.js";

/** Prints scan output. Findings show file:line, rule, and a masked preview — never the secret. */
export function printScanResult(result: ScanResult): void {
  if (result.blocked.length === 0 && result.warned.length === 0) {
    if (result.truncated) {
      console.log(chalk.yellow("snift: diff was too large; scan was truncated."));
    } else {
      console.log(chalk.green("snift: no secrets detected in staged changes."));
    }
    return;
  }

  for (const f of result.warned) {
    console.log(
      chalk.yellow(`WARN  ${f.file}:${f.line} [${f.rule}] ${f.preview} — ${f.reason}`),
    );
  }
  for (const f of result.blocked) {
    console.log(
      chalk.red(`BLOCK ${f.file}:${f.line} [${f.rule}] ${f.preview} — ${f.reason}`),
    );
  }

  if (result.blocked.length > 0) {
    console.log(
      chalk.red(`\nsnift: ${result.blocked.length} finding(s) likely secret(s). Commit blocked.`),
    );
    console.log(
      "  Fix: move the value to an environment variable or a secrets manager, then rotate the credential.",
    );
    console.log(
      "  If it is a false positive, add an inline marker with a reason: `snift:ignore <justification>` on that line.",
    );
    console.log(
      chalk.yellow(
        "  Note: if this value was ever committed or pushed before, treat it as compromised and rotate it.",
      ),
    );
    if (!result.aiUsed) {
      console.log(
        chalk.yellow("  (AI triage unavailable — decided by the deterministic layer alone.)"),
      );
    }
  } else {
    console.log(
      chalk.yellow(`\nsnift: ${result.warned.length} warning(s); nothing blocked the commit.`),
    );
  }
}
