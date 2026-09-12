#!/usr/bin/env node
/**
 * Keeps the Deno copy of the scoring model identical to the canonical one.
 *
 *   node scripts/sync-scoring.mjs          # write the copy
 *   node scripts/sync-scoring.mjs --check  # exit 1 if the copy is stale
 *
 * Why a copy rather than a shared import: the Edge Function is bundled by the
 * Supabase CLI, which only follows relative imports inside supabase/functions/,
 * while Next.js cannot import from outside its own root. Neither toolchain can
 * reach the other's tree, so the file is duplicated and this script is what
 * makes the duplication safe — `npm run verify:scoring` fails the build the
 * moment the two diverge.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../lib/scoring-core.ts");
const TARGET = resolve(
  here,
  "../../supabase/functions/_shared/scoring-core.ts",
);

const BANNER = `// ============================================================
// GENERATED FILE — DO NOT EDIT
//
// Copied from dashboard/lib/scoring-core.ts by
// dashboard/scripts/sync-scoring.mjs. Edit the canonical file there and run
// \`npm run sync:scoring\`. CI/build runs \`npm run verify:scoring\`, which fails
// if this copy is stale, so the Edge Function and the dashboard can never
// disagree about how a score is calculated.
// ============================================================

`;

const check = process.argv.includes("--check");
const source = readFileSync(SOURCE, "utf8");
const expected = BANNER + source;

if (check) {
  if (!existsSync(TARGET)) {
    console.error(
      "verify:scoring FAILED — the Deno copy is missing.\n  expected: " +
        TARGET +
        "\n  run: npm run sync:scoring",
    );
    process.exit(1);
  }

  const actual = readFileSync(TARGET, "utf8");
  if (actual !== expected) {
    console.error(
      "verify:scoring FAILED — the scoring model has drifted.\n" +
        "  canonical: dashboard/lib/scoring-core.ts\n" +
        "  copy:      supabase/functions/_shared/scoring-core.ts\n" +
        "  run: npm run sync:scoring",
    );
    process.exit(1);
  }

  console.log("verify:scoring OK — Deno copy matches the canonical model.");
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, expected, "utf8");
console.log(
  "sync:scoring wrote supabase/functions/_shared/scoring-core.ts from lib/scoring-core.ts",
);
