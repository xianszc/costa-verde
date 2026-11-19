// COSTA VERDE — entry program for the gta6-01 bounty (Node 22, stdlib only).
//
// The game is plain static files in this repo's game/ folder: index.html plus
// ES modules, Three.js vendored under game/vendor/, no network at runtime.
// This program packages the entry: it copies game/ and screenshots/ into
// /output and writes /output/dossier.json, the summary the judge reads, using
// the vendored make.fun helper. Local dry run (no grader container):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play the game locally: `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// This file's directory is the repo root; the grader writes to /output, and
// a local run can point elsewhere with MAKEFUN_OUTPUT_DIR.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Game files first, then the screenshot set (if the repo has one yet).
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's limits so an entry this program accepts is one
// the scorer accepts: at most 4 screenshots of 256 KiB each; game/ at most
// 993 files and 48 MiB total; no path under game/ over 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
