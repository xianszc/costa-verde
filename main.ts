// Azzura Heist — submission entrypoint, written fresh from scratch
// (Xian 21 Nov 18:41; the 619a047 restructure was not enough).
// Boots the dossier: copies game/ + screenshots/ into the output
// directory and writes dossier.json. The dossier lists the shot
// scenes the submission is judged on, so it refuses an empty
// screenshots/ directory instead of shipping a cover-less entry.
//
// Usage:
//   MAKEFUN_OUTPUT_DIR=<dir> <ts-runner> main.ts [--debug]
//     [--shot=<scene> ...] [--shots=<a,b,c>]
// --debug prints each step; --shot selects the cover candidates
// (repeatable, or one comma-separated --shots list).
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GAME = path.join(ROOT, 'game');
const SHOTS = path.join(ROOT, 'screenshots');
const say = (...p: unknown[]) => { if (process.argv.includes('--debug')) console.log('[main]', ...p); };

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

async function buildDossier(outDir: string, wanted: string[]) {
  const dir = path.join(outDir, 'screenshots');
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];
  if (!files.length) throw new Error(`dossier needs at least 1 screenshot in ${dir}`);
  // AUDIT m-25: --shot names are validated — an unknown name used to
  // sail into dossier.json unchecked. A name matches a screenshot file
  // exactly, or by its basename without the extension.
  const known = new Set([...files, ...files.map((f) => f.replace(/\.(png|jpe?g)$/i, ''))]);
  const unknown = wanted.filter((w) => !known.has(w));
  if (unknown.length) throw new Error(`unknown --shot name(s): ${unknown.join(', ')} (screenshots in ${dir}: ${files.join(', ') || '(none)'})`);
  const caps = { maxShots: 4, maxShotKiB: 256, maxSide: 1280, minSide: 480 };
  const dossier = { game: 'Azzura Heist', missions: 11, shots: wanted.length ? wanted : files, files, caps, builtAt: new Date().toISOString() };
  await writeFile(path.join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2));
  return dossier;
}

async function boot(): Promise<void> {
  const out = process.env.MAKEFUN_OUTPUT_DIR || path.join(ROOT, 'dist');
  const wanted = parseShots(process.argv.slice(2));
  say(`output: ${out}; shots: ${wanted.join(', ') || '(all)'}`);
  await mkdir(out, { recursive: true });
  await copyTree(GAME, path.join(out, 'game'), true);
  await copyTree(SHOTS, path.join(out, 'screenshots'), false);
  const d = await buildDossier(out, wanted);
  console.log(`Azzura Heist dossier ready: ${d.files.length} screenshots -> ${path.join(out, 'dossier.json')}`);
}

boot().catch((e) => { console.error(`[main] boot failed: ${(e as Error).message}`); process.exit(1); });
