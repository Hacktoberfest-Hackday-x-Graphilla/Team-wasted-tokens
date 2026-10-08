import type { Rule } from "./patterns.js";
import { RULES, isPlaceholder } from "./patterns.js";

/** A value matched by a format rule on a single line. */
export interface RegexMatch {
  rule: string;
  confidence: Rule["confidence"];
  value: string;
}

/** Runs every known-format rule over one line and returns unique matches. */
export function matchFormatRules(line: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, "g" + rule.pattern.flags);
    for (const m of line.matchAll(re)) {
      const value = m[1] ?? m[0];
      if (!value || isPlaceholder(value)) continue;
      const key = `${rule.id}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ rule: rule.id, confidence: rule.confidence, value });
    }
  }
  return matches;
}
