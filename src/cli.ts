#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
import { scanStaged } from "./scanner.js";
import { printScanResult } from "./ui.js";
import { installHook, isHookInstalled } from "./hook/install.js";

dotenv.config();

const program = new Command();

program
  .name("snift")
  .description("Sniff out secrets before they enter Git history.")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan the working tree for secrets")
  .option("--staged", "Scan staged changes only")
  .action(async ({ staged }: { staged?: boolean }) => {
    if (!staged) {
      console.error("snift scan: only --staged is supported in this version.");
      process.exitCode = 2;
      return;
    }

    const result = await scanStaged();
    printScanResult(result);
    if (result.blocked.length > 0) process.exitCode = 1;
  });

program
  .command("install")
  .description("Install the Git pre-commit hook")
  .action(() => {
    try {
      if (isHookInstalled()) {
        console.log("snift: pre-commit hook already installed.");
        return;
      }
      const target = installHook();
      console.log(`snift: pre-commit hook installed at ${target}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`snift install failed: ${msg}`);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
