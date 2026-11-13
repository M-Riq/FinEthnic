/**
 * Rapport de doublons (BM2.4, ROADMAP §8) → data/exports/markdown/duplicates.md.
 *
 *   npm run check-duplicates                    → régénère le rapport
 *   npm run check-duplicates -- --out <fichier> → l'écrit ailleurs (essai, tests)
 *
 * Lecture seule sur data/ : rien n'est supprimé ni fusionné. Les données doivent d'abord passer
 * validate-data. Code de sortie : 0 si le rapport est produit (même avec des points à arbitrer),
 * 1 si les données ou data/language-resources/duplicate-review.json sont invalides.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLibraryEntries } from './lib/data-files';
import { validateEntries } from './lib/data-validation';
import { analyzeDuplicates, parseReviewLists, renderDuplicatesMarkdown } from './lib/duplicates';
import { loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LISTS_PATH = join(ROOT, 'data/language-resources/duplicate-review.json');
const DEFAULT_OUT = join(ROOT, 'data/exports/markdown/duplicates.md');

const args = process.argv.slice(2);
const out = args.length === 0 ? DEFAULT_OUT : args.length === 2 && args[0] === '--out' && args[1] ? resolve(args[1]) : null;
if (out === null) {
  console.error('Usage : npm run check-duplicates -- [--out <fichier>]');
  process.exit(2);
}

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const { files, entries } = (() => {
  try {
    return readLibraryEntries(ROOT);
  } catch (error) {
    return fail(`lecture de data/ impossible : ${(error as Error).message}`);
  }
})();
const issues = validateEntries(files, loadSchemaValidators());
if (issues.length > 0) fail(`${issues.length} problème(s) dans data/ : lancer d'abord \`npm run validate-data\``);

const lists = (() => {
  try {
    return parseReviewLists(JSON.parse(readFileSync(LISTS_PATH, 'utf8')));
  } catch (error) {
    return fail((error as Error).message);
  }
})();

const report = analyzeDuplicates(entries, lists);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderDuplicatesMarkdown(report), 'utf8');

for (const e of report.errors) console.error(`✗ ${e}`);
for (const w of report.warnings) console.warn(`⚠ ${w}`);
console.log(`Rapport écrit : ${relative(ROOT, out)}`);
console.log(`  doublons stricts ${report.strict.length}, normalisés ${report.normalized.length}, potentiels ${report.potential.length}`);
console.log(`  pages : ${report.pageGroups.length} groupe(s) répétés, ${report.exactLinks.length} lien(s) exact, ${report.meaningLinks.length} par le sens`);
console.log(`  synonymes égaux au texte d'une autre entrée : ${report.synonymCollisions.length} ; libellé ↔ gabarit : ${report.labelTemplates.length}`);
console.log(`  points à arbitrer : ${report.warnings.length} ; erreurs de liste : ${report.errors.length}`);
process.exitCode = report.errors.length === 0 ? 0 : 1;
