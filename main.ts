// AZZURA — entrypoint for make.fun gta6-01 (Node 22, standard library only).
//
// The game itself is plain static files under game/ (game/index.html and its ES
// modules, three.js vendored as a minified build, zero network requests). This
// program hands it in: it copies game/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// using the kit's vendored library (vendor/makefun-game.ts, unchanged).
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's caps: dossier text, screenshots, and the game/ tree.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy a tree that must exist (the game); fail loudly naming the path
// instead of surfacing the bare cpSync ENOENT when it is missing.
function copyRequiredTree(src, dst) {
  if (!existsSync(src)) throw new Error(`missing required tree: ${src}`);
  cpSync(src, dst, { recursive: true });
}

// Copy a tree only when it is present (the screenshots); a missing
// screenshots/ dir is fine — the dossier gate caps an empty set.
function copyOptionalTree(src, dst) {
  if (!existsSync(src)) return;
  cpSync(src, dst, { recursive: true });
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
copyRequiredTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
copyOptionalTree(join(here, 'screenshots'), join(out, 'screenshots'));
writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
