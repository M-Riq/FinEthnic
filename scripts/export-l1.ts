/**
 * Export minimal des fiches L1 (BM2.5) → data/exports/csv/l1-pages.csv.
 *
 *   npm run export-l1                    → régénère la fiche vierge
 *   npm run export-l1 -- --out <fichier> → l'écrit ailleurs (essai, tests)
 *
 * Lecture seule sur data/. La fiche est un EXPORT, pas une seconde source de vérité : les copies
 * remplies par les locutrices reviennent dans data/ par import-review (BM4), jamais à la main.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLibraryEntries } from './lib/data-files';
import { validateEntries } from './lib/data-validation';
import { buildL1Rows, L1_COLUMNS, renderCsv } from './lib/l1-sheet';
import { loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_OUT = join(ROOT, 'data/exports/csv/l1-pages.csv');

const args = process.argv.slice(2);
const out = args.length === 0 ? DEFAULT_OUT : args.length === 2 && args[0] === '--out' && args[1] ? resolve(args[1]) : null;
if (out === null) {
  console.error('Usage : npm run export-l1 -- [--out <fichier>]');
  process.exit(2);
}

try {
  const { files, entries } = readLibraryEntries(ROOT);
  const issues = validateEntries(files, loadSchemaValidators());
  if (issues.length > 0) throw new Error(`${issues.length} problème(s) dans data/ : lancer d'abord \`npm run validate-data\``);
  const rows = buildL1Rows(entries);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderCsv(L1_COLUMNS, rows), 'utf8');
  console.log(`Fiche L1 écrite : ${relative(ROOT, out)} (${rows.length} textes uniques des pages)`);
} catch (error) {
  console.error(`✗ ${(error as Error).message}`);
  process.exitCode = 1;
}
