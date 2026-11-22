// main.ts — hands Orchard at Dusk in: copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json with
// buildDossier from vendor/makefun-game.ts. Standard library only; runs on
// Node 22. The output directory is /output, or MAKEFUN_OUTPUT_DIR outside
// the grader. Both runs must write the same bytes, so the output directory is
// emptied entry by entry (never removed as a whole) before the copy.

import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function emptyDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    throw new Error(`main.ts: missing directory ${src}`);
  }
  cpSync(src, dest, { recursive: true });
}

function main(): void {
  emptyDir(outDir);
  copyTree(join(repoRoot, "game"), join(outDir, "game"));
  copyTree(join(repoRoot, "screenshots"), join(outDir, "screenshots"));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, "dossier.json"), dossier);
  const gameFiles = readdirSync(join(outDir, "game"));
  const shotFiles = readdirSync(join(outDir, "screenshots"));
  console.log(`orchard-at-dusk: wrote ${outDir} (game: ${gameFiles.length} top-level entries, screenshots: ${shotFiles.join(", ")}, dossier.json: ${dossier.length} bytes)`);
}

main();
