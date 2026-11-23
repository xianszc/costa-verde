// Azzura Heist — submission entrypoint, written fresh from scratch
// (Xian 21 Nov 18:41; the 619a047 restructure was not enough).
// Boots the dossier: copies game/ + screenshots/ into the output
// directory and writes dossier.json with make.fun's own buildDossier
// (vendor/makefun-game.ts, the kit's SDK file, byte-identical to the
// starter). The dossier is the Game block + the game's source text the
// judge reads, so it MUST be what buildDossier writes, byte for byte
// (RULES.txt baris 21, dossier_matches): a hand-rolled JSON object
// fails the gate — round 7 was rejected on exactly that, after all
// 30 other checks passed. The dossier lists the shot scenes the
// submission is judged on, so it refuses an empty screenshots/
// directory instead of shipping a cover-less entry.
//
// Usage:
//   MAKEFUN_OUTPUT_DIR=<dir> <ts-runner> main.ts [--debug]
//     [--shot=<scene> ...] [--shots=<a,b,c>]
// --debug prints each step; --shot selects the cover candidates
// (repeatable, or one comma-separated --shots list).
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Repo root is resolved from this file's own location, never from the
// working directory: the grader runs `node /bot/main.ts` from a CWD
// that is not /bot, so process.cwd() pointed at the wrong tree and the
// run died with "missing required tree: /game" (round 5, run_completes).
// MAKEFUN_BOT_DIR (/bot in the grader) wins when set; otherwise the
// script's directory covers local runs from anywhere.
const ROOT = process.env.MAKEFUN_BOT_DIR || path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(ROOT, 'game');
const SHOTS = path.join(ROOT, 'screenshots');
const say = (...p: unknown[]) => { if (process.argv.includes('--debug')) console.log('[main]', ...p); };

// The scorer's own caps (kit starter/main.ts, reference/gate.json):
// only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files, in all, or a
// path under game/ over 1000 bytes). Passing them too makes this
// program fail where the scorer would — never loosen them.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function parseShots(argv: string[]): string[] {
  const shots: string[] = [];
  for (const a of argv) {
    if (a.startsWith('--shot=')) shots.push(a.slice('--shot='.length));
    else if (a.startsWith('--shots=')) shots.push(...a.slice('--shots='.length).split(',').filter(Boolean));
  }
  return shots;
}

async function copyTree(src: string, dst: string, required: boolean): Promise<boolean> {
  if (!existsSync(src)) {
    if (required) throw new Error(`missing required tree: ${src}`);
    say(`skip optional tree (absent): ${src}`);
    return false;
  }
  await cp(src, dst, { recursive: true });
  say(`copied ${src} -> ${dst}`);
  return true;
}

// AUDIT m-25: --shot names are validated — an unknown name used to
// sail into dossier.json unchecked. A name matches a screenshot file
// exactly, or by its basename without the extension. This only
// validates; the dossier itself is written by the SDK's buildDossier,
// which takes every screenshot in the output directory by name.
async function validateShots(outDir: string, wanted: string[]): Promise<string[]> {
  const dir = path.join(outDir, 'screenshots');
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];
  if (!files.length) throw new Error(`dossier needs at least 1 screenshot in ${dir}`);
  const known = new Set([...files, ...files.map((f) => f.replace(/\.(png|jpe?g)$/i, ''))]);
  const unknown = wanted.filter((w) => !known.has(w));
  if (unknown.length) throw new Error(`unknown --shot name(s): ${unknown.join(', ')} (screenshots in ${dir}: ${files.join(', ') || '(none)'})`);
  return files;
}

async function boot(): Promise<void> {
  const out = process.env.MAKEFUN_OUTPUT_DIR || path.join(ROOT, 'dist');
  const wanted = parseShots(process.argv.slice(2));
  say(`output: ${out}; shots: ${wanted.join(', ') || '(all)'}`);
  await mkdir(out, { recursive: true });
  await copyTree(GAME, path.join(out, 'game'), true);
  await copyTree(SHOTS, path.join(out, 'screenshots'), false);
  const files = await validateShots(out, wanted);
  // No wall-clock field anywhere: the SDK dossier is deterministic —
  // the same directory writes the same bytes — so the grader's two
  // runs stay byte-identical (round 6 failed on a builtAt timestamp).
  const bytes = buildDossier(out, DOSSIER_CAPS);
  await writeFile(path.join(out, 'dossier.json'), bytes);
  console.log(`Azzura Heist dossier ready: ${files.length} screenshots, ${bytes.length} bytes -> ${path.join(out, 'dossier.json')}`);
}

boot().catch((e) => { console.error(`[main] boot failed: ${(e as Error).message}`); process.exit(1); });
