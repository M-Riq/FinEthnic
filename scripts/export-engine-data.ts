/**
 * Ressources du moteur pour l'extension (mission phase 4).
 *
 *   npx tsx scripts/export-engine-data.ts [dossier]     (appelé par `npm run build`)
 *
 * Écrit dans `build/engine-data/` (non versionné) :
 * - `resources.data` : paquet JSON de D8, D7 (conversion versionnée) et des règles de grammaire, avec les
 *   statistiques de la bibliothèque calculées ici (le démarrage dans la page n'a pas à les recalculer) ;
 * - `lefff.data` : l'extrait de Lefff, tel quel.
 * `build.mjs` intègre ces deux textes au script de contenu.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serializeBundle } from '../src/engine/bundle';
import { createContractEngine } from '../src/engine/contract-engine';
import { LEXICON_PATH, loadContractResources, MissingDictionaryError } from './lib/engine-load';

export const ENGINE_DATA_DIR = 'build/engine-data';
export const RESOURCES_FILE = 'resources.data';
export const LEFFF_FILE = 'lefff.data';

export function exportEngineData(root: string, outDir = join(root, ENGINE_DATA_DIR)): { resources: string; lefff: string } {
  const resources = loadContractResources(root);
  const info = createContractEngine(resources, { cacheSize: 0 }).info();
  mkdirSync(outDir, { recursive: true });
  const files = { resources: join(outDir, RESOURCES_FILE), lefff: join(outDir, LEFFF_FILE) };
  writeFileSync(files.resources, serializeBundle(resources, info));
  copyFileSync(join(root, LEXICON_PATH), files.lefff);
  return files;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const out = process.argv[2];
    const files = exportEngineData(process.cwd(), out ? resolve(out) : undefined);
    console.log(`Ressources du moteur écrites : ${files.resources}, ${files.lefff}`);
  } catch (error) {
    console.error(error instanceof MissingDictionaryError || error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
