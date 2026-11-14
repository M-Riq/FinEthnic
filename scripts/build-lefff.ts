/**
 * Construit l'extrait de Lefff utilisé par le moteur (MOT2).
 *
 *   npm run build-lefff -- [--lefff <lefff-3.4.mlex>] [--d7 <lexique.md>] [--out <extrait.mlex>]
 *
 * Défauts :
 * - Lefff : data/language-resources/raw/lefff-3.4.mlex (hors Git), téléchargé depuis la version figée
 *   s'il est absent. Sa somme SHA-256 est toujours vérifiée.
 * - D7 : data/language-resources/raw/dictionnaire_eton_lexique.md (hors Git). Obligatoire : sans lui,
 *   l'extrait perdrait le vocabulaire du dictionnaire.
 * - Sortie : data/language-resources/lefff/lefff-3.4-finethnic.mlex (versionnée, LGPL-LR).
 *
 * Code de sortie : 0 si tout s'est bien passé, 1 si une source manque ou est invalide, 2 pour une
 * erreur d'usage.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLibraryEntries } from './lib/data-files';
import { LEFFF_SOURCE, LEFFF_URL, selectLefff, subsetHeader, wordsOf } from './lib/lefff-subset';
import * as french from '../src/engine/french';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = join(ROOT, 'data/language-resources/raw');
const USAGE = 'Usage : npm run build-lefff -- [--lefff <lefff-3.4.mlex>] [--d7 <lexique.md>] [--out <extrait.mlex>]';

const usage = (message: string): never => {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
};
const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const options = new Map<string, string>();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (['--lefff', '--d7', '--out'].includes(arg) && args[i + 1] !== undefined && !options.has(arg)) {
    options.set(arg, resolve(args[i + 1] as string));
    i++;
  } else usage(`Argument inattendu : ${arg}`);
}
const lefffPath = options.get('--lefff') ?? join(RAW, 'lefff-3.4.mlex');
const d7Path = options.get('--d7') ?? join(RAW, 'dictionnaire_eton_lexique.md');
const outPath = options.get('--out') ?? join(ROOT, 'data/language-resources/lefff/lefff-3.4-finethnic.mlex');
const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

if (!existsSync(lefffPath)) {
  if (options.has('--lefff')) fail(`${lefffPath} introuvable.`);
  console.log(`Téléchargement de Lefff ${LEFFF_SOURCE.version} (${LEFFF_URL})…`);
  const response = await fetch(LEFFF_URL).catch((error: unknown) => fail(`téléchargement impossible : ${(error as Error).message}`));
  if (!response.ok) fail(`téléchargement impossible : HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (sha256(data) !== LEFFF_SOURCE.sha256) fail(`le fichier téléchargé n'a pas la somme SHA-256 attendue (${LEFFF_SOURCE.sha256}).`);
  mkdirSync(dirname(lefffPath), { recursive: true });
  writeFileSync(lefffPath, data);
}
const lefff = readFileSync(lefffPath);
if (sha256(lefff) !== LEFFF_SOURCE.sha256) fail(`${lefffPath} : somme SHA-256 inattendue (attendu ${LEFFF_SOURCE.sha256}).`);
if (!existsSync(d7Path)) fail(`${d7Path} introuvable : D7 est nécessaire pour choisir le vocabulaire (git show origin/private/d7-raw:dictionnaire_eton_lexique.md).`);
const d7 = readFileSync(d7Path);

const words = wordsOf(d7.toString('utf8'));
const { entries } = readLibraryEntries(ROOT);
for (const e of entries) {
  wordsOf(e.source.fr.text, words);
  for (const s of e.source.fr.simple?.synonyms ?? []) wordsOf(s, words);
  if (e.source.fr.simple?.definition) wordsOf(e.source.fr.simple.definition, words);
}
for (const value of Object.values(french)) {
  if (value instanceof Set) for (const w of value as ReadonlySet<string>) wordsOf(w, words);
}

const lines = lefff.toString('utf8').split('\n');
const selection = selectLefff(lines, words);
const header = subsetHeader({
  date: new Date().toISOString().slice(0, 10),
  d7Sha256: sha256(d7),
  d8Entries: entries.length,
  lines: selection.kept.length,
  total: lines.filter((l) => l.trim() !== '').length,
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${header}${selection.kept.join('\n')}\n`, 'utf8');

const shown = (path: string): string => relative(process.cwd(), path) || path;
console.log(`✓ ${selection.kept.length} lignes de Lefff (${selection.lemmas} lemmes) écrites dans ${shown(outPath)}.`);
console.log(`  ${words.size} mots cherchés, dont ${selection.missing.length} absents de Lefff (noms propres, mots éton, fautes…).`);
