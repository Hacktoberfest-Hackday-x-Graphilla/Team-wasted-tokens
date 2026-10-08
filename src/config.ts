import * as fs from "fs";
import * as path from "path";

export interface SniftConfig {
  confidenceThreshold: number;
  scanStagedOnly: boolean;
  gemmaEnabled: boolean;
  gemmaProvider: string;
  gemmaModel: string;
  gemmaEndpoint: string;
}

export const DEFAULT_CONFIG: SniftConfig = {
  confidenceThreshold: 0.85,
  scanStagedOnly: true,
  gemmaEnabled: true,
  gemmaProvider: "local",
  gemmaModel: "gemma",
  gemmaEndpoint: "",
};

function readRcFile(cwd: string): Partial<SniftConfig> {
  const rcPath = path.join(cwd, ".sniftrc.json");
  try {
    const raw = fs.readFileSync(rcPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<SniftConfig>;
    }
  } catch {
    // no rc file or invalid JSON: use defaults
  }
  return {};
}

function readDotEnv(cwd: string): void {
  const envPath = path.join(cwd, ".env");
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      // Strip surrounding quotes and inline comments.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Never override variables already set in the real environment.
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // no .env file: fine
  }
}

function readEnv(): Partial<SniftConfig> {
  const out: Partial<SniftConfig> = {};
  if (process.env.SNIFT_CONFIDENCE_THRESHOLD) {
    const v = Number(process.env.SNIFT_CONFIDENCE_THRESHOLD);
    if (!Number.isNaN(v)) out.confidenceThreshold = v;
  }
  if (process.env.GEMMA_ENABLED !== undefined) {
    out.gemmaEnabled = process.env.GEMMA_ENABLED.toLowerCase() !== "false";
  }
  if (process.env.GEMMA_PROVIDER) out.gemmaProvider = process.env.GEMMA_PROVIDER;
  if (process.env.GEMMA_MODEL) out.gemmaModel = process.env.GEMMA_MODEL;
  if (process.env.GEMMA_ENDPOINT) out.gemmaEndpoint = process.env.GEMMA_ENDPOINT;
  return out;
}

export function loadConfig(cwd: string = process.cwd()): SniftConfig {
  readDotEnv(cwd);
  return { ...DEFAULT_CONFIG, ...readRcFile(cwd), ...readEnv() };
}
