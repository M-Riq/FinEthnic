/**
 * Import du dictionnaire D7 (BM3.3) : lexique Markdown → dictionnaire de la cascade + rapport.
 *
 *   npm run import-dictionary -- [--source <lexique.md>] [--out <dictionary.json>] [--report <rapport.md>]
 *
 * Défauts : data/language-resources/raw/dictionnaire_eton_lexique.md → raw/dictionary.json et
 * raw/import-report.md. D7 est une œuvre publiée (Q17) : dans ce dépôt, le script n'écrit que dans
 * raw/ (ignoré par Git). Le dictionnaire est validé (schéma et contrôles de la cascade) AVANT toute
 * écriture. Code de sortie : 0 si tout s'est bien passé, 1 si la source est invalide (rien n'est
 * écrit), 2 pour une erreur d'usage.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCascadeResources } from './lib/cascade';
import { buildD7Dictionary, D7ImportError, readD7, renderD7Report } from './lib/d7-import';
import { formatSchemaErrors, loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = join(ROOT, 'data/language-resources/raw');
const USAGE = 'Usage : npm run import-dictionary -- [--source <lexique.md>] [--out <dictionary.json>] [--report <rapport.md>]';

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
  if (['--source', '--out', '--report'].includes(arg) && args[i + 1] !== undefined && !options.has(arg)) {
    options.set(arg, resolve(args[i + 1] as string));
    i++;
  } else usage(`Argument inattendu : ${arg}`);
}
const sourcePath = options.get('--source') ?? join(RAW, 'dictionnaire_eton_lexique.md');
const outPath = options.get('--out') ?? join(RAW, 'dictionary.json');
const reportPath = options.get('--report') ?? join(RAW, 'import-report.md');

const inside = (dir: string, path: string): boolean => {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
for (const path of [outPath, reportPath]) {
  if (inside(ROOT, path) && !inside(RAW, path)) {
    usage(`${relative(ROOT, path)} : dans ce dépôt, les formes de D7 ne s'écrivent que dans ${relative(ROOT, RAW)}/ (hors Git, Q17).`);
  }
}

let markdown: string;
try {
  markdown = readFileSync(sourcePath, 'utf8');
} catch (error) {
  fail(`${sourcePath} illisible : ${(error as Error).message}`);
}
const sha256 = createHash('sha256').update(readFileSync(sourcePath)).digest('hex');

const rows = (() => {
  try {
    return readD7(markdown!);
  } catch (error) {
    if (error instanceof D7ImportError) return fail(error.message);
    throw error;
  }
})();
const result = buildD7Dictionary(rows, `D7 — Dictionnaire éton–français (Van de Velde & Essele Essele, CLÉ 2022), lexique ${basename(sourcePath)}, SHA-256 ${sha256.slice(0, 12)}`);

const validators = loadSchemaValidators();
if (!validators.dictionary(result.dictionary)) {
  fail(`dictionnaire non conforme à dictionary.schema.json :\n  ${formatSchemaErrors(validators.dictionary.errors).join('\n  ')}`);
}
const issues = checkCascadeResources(result.dictionary, { description: '', source: '', ignoredWords: [], rules: [] });
if (issues.length > 0) fail(`dictionnaire refusé par la cascade (rien n'est écrit) :\n  ${issues.slice(0, 20).join('\n  ')}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result.dictionary, null, 2)}\n`, 'utf8');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderD7Report(result, { source: basename(sourcePath), sha256, rows }), 'utf8');

const shown = (path: string): string => relative(process.cwd(), path) || path;
console.log(`✓ D7 : ${result.rows} entrées lues, ${result.dictionary.entries.length} clés françaises écrites dans ${shown(outPath)}.`);
console.log(`  Écartées : ${result.excludedForms.length} forme(s) hors liste blanche, ${result.noKey.length} entrée(s) sans clé, ${result.unknownCategories.length} catégorie(s) inconnue(s).`);
console.log(`  Rapport : ${shown(reportPath)}`);
