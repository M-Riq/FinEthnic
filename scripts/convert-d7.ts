/**
 * Conversion complète de D7 et de l'esquisse grammaticale (HAL) en JSON versionné.
 *
 *   npm run convert-d7 -- [--lexique <lexique.md>] [--esquisse <esquisse.md>] [--check]
 *
 * Défauts :
 *   data/language-resources/raw/dictionnaire_eton_lexique.md (D7 tel que reçu, hors Git)
 *   docs/sources/grammaire_eton_esquisse_complete.md          (esquisse, versionnée telle quelle)
 * Sorties (versionnées, CC BY-NC-SA 4.0, voir data/language-resources/d7/LICENCE.md) :
 *   data/language-resources/d7/d7.json                      (lexique, index français, grammaire de D7)
 *   data/language-resources/d7/esquisse-grammaticale.json   (section 8 du livre)
 *
 * Le résultat est validé (schémas d7 et esquisse) AVANT toute écriture et ne dépend que des sources :
 * deux exécutions donnent des fichiers identiques. `--check` n'écrit rien et sort en 1 si les fichiers
 * versionnés diffèrent de ce que donneraient les sources.
 * Code de sortie : 0 si tout va bien, 1 si une source est invalide ou un fichier périmé, 2 pour une erreur d'usage.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLexicon } from '../src/engine/lexicon';
import { D7ImportError } from './lib/d7-import';
import { conversionStats, convertD7, convertEsquisse } from './lib/d7-convert';
import { LEXICON_PATH } from './lib/engine-load';
import { formatSchemaErrors, loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const D7_JSON_PATH = 'data/language-resources/d7/d7.json';
export const ESQUISSE_JSON_PATH = 'data/language-resources/d7/esquisse-grammaticale.json';
const USAGE = 'Usage : npm run convert-d7 -- [--lexique <lexique.md>] [--esquisse <esquisse.md>] [--check]';

const usage = (message: string): never => {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
};
const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const options = new Map<string, string>();
let check = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === '--check' && !check) check = true;
  else if (['--lexique', '--esquisse'].includes(arg) && args[i + 1] !== undefined && !options.has(arg)) {
    options.set(arg, resolve(args[i + 1] as string));
    i++;
  } else usage(`Argument inattendu : ${arg}`);
}
const lexiquePath = options.get('--lexique') ?? join(ROOT, 'data/language-resources/raw/dictionnaire_eton_lexique.md');
const esquissePath = options.get('--esquisse') ?? join(ROOT, 'docs/sources/grammaire_eton_esquisse_complete.md');

const read = (path: string, hint: string): { text: string; sha256: string } => {
  if (!existsSync(path)) fail(`${path} introuvable. ${hint}`);
  const bytes = readFileSync(path);
  return { text: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
};
const lexique = read(lexiquePath,
  'D7 brut : `git show origin/private/d7-raw:dictionnaire_eton_lexique.md > data/language-resources/raw/dictionnaire_eton_lexique.md`');
const esquisse = read(esquissePath, 'Esquisse : docs/sources/grammaire_eton_esquisse_complete.md');

// Les formes du lexique français Lefff (versionné) départagent « très », « côté »… d'un mot éton.
const french = parseLexicon(readFileSync(join(ROOT, LEXICON_PATH), 'utf8'));
const isFrench = (word: string): boolean => french.lookup(word).length > 0;

let d7;
let hal;
try {
  d7 = convertD7(lexique.text, { file: basename(lexiquePath), sha256: lexique.sha256 }, isFrench);
  hal = convertEsquisse(esquisse.text, { file: basename(esquissePath), sha256: esquisse.sha256 });
} catch (error) {
  if (error instanceof D7ImportError) fail(error.message);
  throw error;
}

const validators = loadSchemaValidators();
if (!validators.d7(d7)) fail(`d7.json non conforme à d7.schema.json :\n  ${formatSchemaErrors(validators.d7.errors).slice(0, 20).join('\n  ')}`);
if (!validators.esquisse(hal)) {
  fail(`esquisse non conforme à esquisse.schema.json :\n  ${formatSchemaErrors(validators.esquisse.errors).slice(0, 20).join('\n  ')}`);
}

const outputs: [string, unknown][] = [[D7_JSON_PATH, d7], [ESQUISSE_JSON_PATH, hal]];
const stale: string[] = [];
for (const [path, data] of outputs) {
  const full = join(ROOT, path);
  const text = `${JSON.stringify(data, null, 1)}\n`;
  if (check) {
    if (!existsSync(full) || readFileSync(full, 'utf8') !== text) stale.push(path);
    continue;
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text, 'utf8');
}

const stats = conversionStats(d7);
const examples = hal.sections.reduce((n, s) => n + s.blocks.reduce((k, b) => k + (b.type === 'exemples' ? b.examples.length : 0), 0), 0);
console.log(`✓ D7 : ${Object.entries(stats).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`✓ Esquisse : ${hal.sections.length} sections, ${examples} exemples numérotés.`);
if (check) {
  if (stale.length > 0) fail(`fichiers à régénérer (npm run convert-d7) : ${stale.join(', ')}`);
  console.log('✓ Fichiers versionnés à jour.');
} else console.log(`  Écrits : ${outputs.map(([p]) => relative(process.cwd(), join(ROOT, p))).join(', ')}`);
