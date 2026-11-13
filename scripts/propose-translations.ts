/**
 * Cascade de traduction (BM3.7, PROJECT_CONTEXT §3.10) → propositions pour les locutrices.
 *
 *   npm run propose-translations -- --dictionary <fichier> [options]
 *     --rules <fichier>   règles de formation des phrases (défaut : data/language-resources/grammar-rules.json)
 *     --report <fichier>  rapport Markdown (défaut : data/exports/markdown/cascade-report.md)
 *     --root <dossier>    racine contenant data/ (défaut : ce dépôt ; autre valeur pour les essais et tests)
 *     --write             écrit les propositions dans data/ (sinon : essai, seul le rapport est écrit)
 *
 * Le script n'écrit jamais target.eto.text ni VALIDATED_OBALA : une entrée proposée passe en
 * REVIEW_PENDING. Avec un dictionnaire de test (formes ⟦TEST:…⟧), toute écriture dans le data/ de
 * ce dépôt est refusée. Code de sortie : 0 si tout s'est bien passé, 1 si les ressources ou les données
 * sont invalides (rien n'est écrit), 2 pour une erreur d'usage.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyOutcome, checkCascadeResources, prepareResources, renderCascadeReport, runCascade,
  type Dictionary, type GrammarRules,
} from './lib/cascade';
import { readLibraryEntries } from './lib/data-files';
import { validateEntries } from './lib/data-validation';
import { serializeEntries } from './lib/d8-import';
import type { LibraryEntry } from './lib/library-entry';
import { formatSchemaErrors, loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'Usage : npm run propose-translations -- --dictionary <fichier> [--rules <fichier>] [--report <fichier>] [--root <dossier>] [--write]';

const usage = (message: string): never => {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
};
const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const options = new Map<string, string>();
let write = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === '--write') write = true;
  else if (['--dictionary', '--rules', '--report', '--root'].includes(arg) && args[i + 1] !== undefined && !options.has(arg)) {
    options.set(arg, resolve(args[i + 1] as string));
    i++;
  } else usage(`Argument inattendu : ${arg}`);
}
const dictionaryPath = options.get('--dictionary') ?? usage('--dictionary est obligatoire.');
const rulesPath = options.get('--rules') ?? join(ROOT, 'data/language-resources/grammar-rules.json');
const reportPath = options.get('--report') ?? join(ROOT, 'data/exports/markdown/cascade-report.md');
const root = options.get('--root') ?? ROOT;

const validators = loadSchemaValidators();
const readJson = (path: string, schema: 'dictionary' | 'grammar-rules'): unknown => {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fail(`${path} illisible : ${(error as Error).message}`);
  }
  if (!validators[schema](data)) {
    return fail(`${path} non conforme à ${schema}.schema.json :\n  ${formatSchemaErrors(validators[schema].errors).join('\n  ')}`);
  }
  return data;
};
const dictionary = readJson(dictionaryPath, 'dictionary') as Dictionary;
const grammar = readJson(rulesPath, 'grammar-rules') as GrammarRules;
const resourceIssues = checkCascadeResources(dictionary, grammar);
if (resourceIssues.length > 0) fail(`ressources invalides :\n  ${resourceIssues.join('\n  ')}`);

const inside = (dir: string, path: string): boolean => {
  const rel = relative(dir, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
if (dictionary.kind === 'test') {
  if (write && resolve(root) === resolve(ROOT)) {
    fail('dictionnaire de TEST : écriture dans le data/ de ce dépôt refusée (formes fictives, PROJECT_CONTEXT §3.10). Utiliser --root vers une copie.');
  }
  if (inside(join(ROOT, 'data'), reportPath)) {
    fail('dictionnaire de TEST : rapport dans le data/ de ce dépôt refusé. Utiliser --report vers un autre fichier.');
  }
}

const { files, entries } = (() => {
  try {
    return readLibraryEntries(root);
  } catch (error) {
    return fail(`lecture de ${join(root, 'data')} impossible : ${(error as Error).message}`);
  }
})();
const dataIssues = validateEntries(files, validators);
if (dataIssues.length > 0) {
  fail(`data/ invalide (${dataIssues.length} problème(s)) : lancer d'abord npm run validate-data.`);
}

const guards = entries.filter((e) => e.kind === 'guard').map((e) => e.source.fr.text);
const outcomes = runCascade(entries, prepareResources(dictionary, grammar, guards));
const byId = new Map(outcomes.map((o) => [o.id, o]));

if (write) {
  const updated = files.map((f) => ({
    file: f.file,
    entries: (f.data as LibraryEntry[]).map((e) => {
      const outcome = byId.get(e.id);
      return outcome ? applyOutcome(e, outcome) : e;
    }),
  }));
  const issues = validateEntries(updated.map((f) => ({ file: f.file, data: f.entries })), validators);
  if (issues.length > 0) {
    fail(`propositions refusées par validate-data, rien n'est écrit :\n  ${issues.slice(0, 10).map((i) => `${i.file} ${i.id ?? ''} ${i.path} : ${i.message}`).join('\n  ')}`);
  }
  for (const f of updated) {
    const text = serializeEntries(f.entries);
    const path = join(root, f.file);
    if (readFileSync(path, 'utf8') !== text) writeFileSync(path, text, 'utf8');
  }
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, renderCascadeReport(outcomes, {
  dictionary: { kind: dictionary.kind, source: dictionary.source, entries: dictionary.entries.length },
  grammar: { source: grammar.source, rules: grammar.rules.length },
  written: write,
}), 'utf8');

const count = (pick: (o: (typeof outcomes)[number]) => boolean): number => outcomes.filter(pick).length;
console.log(
  `✓ Cascade : ${count((o) => o.method === 'direct')} terme, ${count((o) => o.method === 'synonym')} synonyme, `
  + `${count((o) => o.method === 'definition')} définition, ${count((o) => o.result === 'failed')} échec, `
  + `${count((o) => o.result === 'skipped')} non traitée(s).`,
);
console.log(`  ${write ? 'Propositions écrites dans data/ (REVIEW_PENDING).' : 'Essai : data/ inchangé (ajouter --write pour écrire).'}`);
console.log(`  Rapport : ${relative(process.cwd(), reportPath) || reportPath}`);
