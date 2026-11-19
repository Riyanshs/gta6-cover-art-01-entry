// Vice Cover Studio — the hand-in program (Node 22, standard library only).
//
// It copies the app (app/) and the maker's screenshots (screenshots/) from
// beside this file into the grading output directory, then writes
// dossier.json there with the vendored make.fun library. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice in the grader and both runs must write the same
// bytes, so it does nothing time- or random-dependent: a plain copy plus
// the deterministic dossier build.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
  }
  // The scorer's own caps: only text_max_bytes shapes the bytes; the rest
  // refuse an entry the scorer would refuse (more than 4 screenshots or one
  // over 256 KiB; more than 993 files in app/ or 48 MiB of app files in
  // all, or a path under app/ over 1000 bytes).
  const caps = {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  };
  // The grader runs this program twice and both runs must write the same
  // bytes, so prove the dossier is deterministic before writing it: build
  // it twice and refuse to hand in a dossier that wobbles. (buildDossier
  // returns a Uint8Array, so compare bytes, not object identity.)
  const first = buildDossier(outputDir, caps);
  const second = buildDossier(outputDir, caps);
  if (!Buffer.from(first).equals(Buffer.from(second))) {
    throw new Error('dossier is not deterministic across two builds');
  }
  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(dossierPath, first);
  const bytes = statSync(dossierPath).size;
  // How many screenshots went in — a quick sanity line for the builder.
  const shotDir = join(outputDir, 'screenshots');
  const shotCount = existsSync(shotDir)
    ? readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).length
    : 0;
  console.log(`wrote ${dossierPath} (${bytes} bytes, ${shotCount} screenshots)`);
}

main();
