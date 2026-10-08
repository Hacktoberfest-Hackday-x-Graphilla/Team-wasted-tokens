import chalk from "chalk";
import { HookInstallResult, HookInstallError } from "./install";

/**
 * Formats and prints success messages for `snift install`.
 */
export function printInstallSuccess(result: HookInstallResult): void {
  console.log(chalk.green("✓") + " Git repository detected");

  if (result.backedUp && result.backupPath) {
    console.log(
      chalk.green("✓") +
        ` Existing pre-commit hook backed up to ${chalk.cyan(result.backupPath)}`
    );
  }

  if (result.alreadyInstalled) {
    console.log(
      chalk.green("✓") +
        ` Pre-commit hook is already installed at ${chalk.cyan(result.hookPath)}`
    );
  } else {
    console.log(
      chalk.green("✓") +
        ` Pre-commit hook installed at ${chalk.cyan(result.hookPath)}`
    );
  }

  console.log(
    chalk.green("✓") + " Snift will scan staged changes before every commit"
  );
}

/**
 * Formats and prints clean user-facing error messages without stack traces.
 */
export function printInstallError(error: HookInstallError | Error): void {
  console.error(chalk.red("✗ ") + chalk.bold(error.message));
  if ("suggestion" in error && error.suggestion) {
    console.error("  " + chalk.dim(error.suggestion));
  }
}
