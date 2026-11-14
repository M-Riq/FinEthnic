/**
 * Paquet ZIP de l'extension (P8) : `npm run package` construit l'extension de production (vrai moteur, D7
 * requis) puis l'empaquette dans `release/`, avec les avis de licence des données embarquées.
 *
 *   tsx scripts/package-extension.ts [--dist <dossier>] [--out <dossier>]
 *
 * Seule une construction de production est acceptée (manifeste de production, aucun code de développement).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packageExtension } from './lib/extension-package';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function option(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  if (index !== -1 && value === undefined) throw new Error(`Valeur manquante après ${name}`);
  return path.resolve(value ?? fallback);
}

try {
  const args = process.argv.slice(2);
  const build = (await import(pathToFileURL(path.join(ROOT, 'build.mjs')).href)) as {
    BUILD_MARKER: string;
    findForbidden(code: string, options: { production: boolean }): string[];
  };
  const result = await packageExtension({
    root: ROOT,
    distDir: option(args, '--dist', path.join(ROOT, 'dist')),
    outDir: option(args, '--out', path.join(ROOT, 'release')),
    buildMarker: build.BUILD_MARKER,
    findForbidden: build.findForbidden,
  });
  console.log(`Paquet écrit : ${path.relative(process.cwd(), result.file) || result.file} (${result.bytes} o, version ${result.version})`);
  console.log(result.engine ? '  Moteur embarqué : avis Lefff (LGPL-LR) et D7 (CC BY-NC-SA 4.0) joints.' : '  Sans moteur de traduction.');
  result.entries.forEach((entry) => console.log(`  ${entry}`));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
