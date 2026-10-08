#!/usr/bin/env node
import { Command } from "commander";
import { installPreCommitHook, HookInstallError } from "./hook/install";
import { printInstallSuccess, printInstallError } from "./hook/ui";

const program = new Command();

program
  .name("snift")
  .description("Sniff out secrets before they enter Git history.")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan the working tree for secrets")
  .option("--staged", "Scan staged changes only")
  .action(() => {
    console.log("scan: not implemented yet");
  });

program
  .command("install")
  .description("Install the Git pre-commit hook")
  .option("-f, --force", "Force installation even if hook is already installed")
  .action(async (options) => {
    try {
      const result = await installPreCommitHook({ force: options.force });
      printInstallSuccess(result);
      process.exit(0);
    } catch (err: unknown) {
      if (err instanceof HookInstallError) {
        printInstallError(err);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        printInstallError(new HookInstallError(message, "FS_ERROR"));
      }
      process.exit(2);
    }
  });

program.parse(process.argv);
