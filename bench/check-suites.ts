#!/usr/bin/env bun
/**
 * Lint all benchmark suites for substring-scoring hazards.
 *
 * The scorer is raw case-insensitive includes(): answers[] must appear,
 * negative_answers[] must not (negatives checked first). This linter catches
 * the hazard classes that scoring model responses with substrings creates:
 *
 *  1. BLOCKER nested-tokens: a negative that is a substring of an answer
 *     makes a test unpassable; an answer that is a substring of a negative's
 *     natural vocabulary creates false passes.
 *  2. WARN short-token: answers under 3 chars, or bare digits under 4 chars,
 *     match incidental prose ("7", "op", "1").
 *  3. WARN prompt-leak: an answer token appearing verbatim in the prompt
 *     passes models that merely echo the question.
 *  4. WARN generic-word: single common English words as sole match targets.
 *
 * Usage: bun run suites   (exit 1 on any BLOCKER)
 */
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const TESTS_DIR = join(import.meta.dir, "tests");

const GENERIC_WORDS = new Set([
  "yes",
  "no",
  "true",
  "false",
  "contract",
  "owner",
  "transfer",
  "view",
  "merge",
  "combine",
  "challenge",
  "gateway",
  "metadata",
  "address",
  "key",
  "token",
  "account",
  "block",
  "chain",
  "hash",
  "value",
  "output",
  "input",
  "privacy",
  "constraint",
  "op",
]);

interface Test {
  prompt: string;
  answers: string[];
  negative_answers?: string[];
}

let blockers = 0;
let warns = 0;

function report(level: "BLOCKER" | "WARN", suite: string, q: number, msg: string) {
  if (level === "BLOCKER") blockers++;
  else warns++;
  console.log(`${level.padEnd(7)} ${suite} Q${q}: ${msg}`);
}

const files = (await readdir(TESTS_DIR)).filter((f) => f.endsWith(".json"));
for (const file of files.sort()) {
  const suite = JSON.parse(await readFile(join(TESTS_DIR, file), "utf-8")) as {
    id?: string;
    tests?: Test[];
  };
  if (!suite.id || !Array.isArray(suite.tests)) continue;

  suite.tests.forEach((t, q) => {
    const answers = t.answers.map((a) => a.toLowerCase());
    const negatives = (t.negative_answers ?? []).map((n) => n.toLowerCase());
    const prompt = t.prompt.toLowerCase();

    // 0. Short or generic negatives veto nearly any response. Forced-choice
    // items (system-prompt-enforced one-word replies) get a WARN instead:
    // the reply format makes incidental prose matches unlikely by design.
    const isForcedChoice = /exactly one word/i.test(t.prompt);
    for (const n of negatives) {
      if (n.length < 4) {
        report(
          isForcedChoice ? "WARN" : "BLOCKER",
          suite.id ?? file,
          q,
          `negative "${n}" is under 4 chars — it appears in ordinary prose, making the test nearly unpassable`
        );
      } else if (GENERIC_WORDS.has(n)) {
        report(
          isForcedChoice ? "WARN" : "BLOCKER",
          suite.id ?? file,
          q,
          `negative "${n}" is a generic word — it vetoes correct responses that merely use the word`
        );
      }
    }

    // 1. Nested answer/negative tokens
    for (const n of negatives) {
      for (const a of answers) {
        if (a.includes(n)) {
          report(
            "BLOCKER",
            suite.id ?? file,
            q,
            `negative "${n}" is a substring of answer "${a}" — a correct response can never pass`
          );
        } else if (n.includes(a)) {
          report(
            "BLOCKER",
            suite.id ?? file,
            q,
            `answer "${a}" is a substring of negative "${n}" — the wrong answer's vocabulary contains the pass token`
          );
        }
      }
    }

    for (const a of answers) {
      // 2. Short / bare-digit tokens
      if (a.length < 3) {
        report(
          "WARN",
          suite.id ?? file,
          q,
          `answer "${a}" is under 3 chars — matches incidental prose`
        );
      } else if (/^\d+$/.test(a) && a.length < 4) {
        report(
          "WARN",
          suite.id ?? file,
          q,
          `answer "${a}" is a bare short number — matches incidental digits`
        );
      }

      // 3. Prompt leak (skip forced-choice items, which state options by design)
      const forcedChoice = /exactly one word/i.test(t.prompt);
      if (!forcedChoice && a.length >= 3 && prompt.includes(a)) {
        report(
          "WARN",
          suite.id ?? file,
          q,
          `answer "${a}" appears verbatim in the prompt — echoing the question passes`
        );
      }

      // 4. Generic single words
      if (GENERIC_WORDS.has(a)) {
        report(
          "WARN",
          suite.id ?? file,
          q,
          `answer "${a}" is a generic word — high false-positive rate`
        );
      }
    }
  });
}

console.log(`\n${blockers} blockers, ${warns} warnings across ${files.length} suite files.`);
process.exit(blockers > 0 ? 1 : 0);
