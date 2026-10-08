#!/usr/bin/env node
import { Command } from "commander";

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
  .action(() => {
    console.log("install: not implemented yet");
  });


program.parse(process.argv);
