// COSTA VERDE — gta6-01 entry program (Node 22, standard library only).
//
// The game lives in this repository's game/ folder: plain static files that a
// desktop browser loads offline (game/index.html and its ES modules, Three.js
// vendored under game/vendor/, no network request at runtime). This program
// hands the game in: it copies game/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library. Run it outside the grader with
// MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Directory holding this file; output goes to /output unless the caller
// overrides it (the grader's container sets MAKEFUN_OUTPUT_DIR for local runs).
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: only text_max_bytes shapes the dossier's bytes; the
// rest refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
// all; a path under game/ over 1000 bytes). game/ counts beside /output's
// own 1000-entry cap, its screenshots/ and dossier.json.
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
