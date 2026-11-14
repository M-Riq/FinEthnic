/**
 * Import initial de D8 dans data/ (BM2.1 à BM2.3). À exécuter UNE SEULE FOIS : ensuite, le JSON de
 * data/ est la source de vérité et reçoit les relectures. L'import refuse donc d'écraser des fichiers
 * existants, sauf avec --force (qui effacerait toute relecture déjà intégrée).
 *
 *   npm run import-sources                    → écrit data/financial-corpus/ et data/safinum-test-pages/
 *   npm run import-sources -- --out <dossier> → écrit ailleurs (essai, tests)
 *   npm run import-sources -- --force         → écrase les fichiers existants
 *
 * L'empreinte SHA-256 de D8 doit être celle inscrite dans docs/sources/README.md.
 * Les entrées construites sont validées (validate-data) AVANT toute écriture.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntries } from './lib/data-validation';
import { buildLibraryFromD8, ImportError, readD8, serializeEntries } from './lib/d8-import';
import { loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const D8_PATH = join(ROOT, 'docs/sources/corpus_fusionne_SAFINUM_Eton.md');
const SOURCES_README = join(ROOT, 'docs/sources/README.md');

const args = process.argv.slice(2);
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
const outRoot = outIndex >= 0 ? args[outIndex + 1] : join(ROOT, 'data');
const unknown = args.filter((a, i) => a !== '--force' && a !== '--out' && i !== outIndex + 1);
if (outRoot === undefined || unknown.length > 0) {
  console.error('Usage : npm run import-sources -- [--out <dossier>] [--force]');
  process.exit(2);
}

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const markdown = readFileSync(D8_PATH, 'utf8');
const sha = createHash('sha256').update(markdown, 'utf8').digest('hex');
const expectedSha = /\| D8 \|[^\n]*`([0-9a-f]{64})`/u.exec(readFileSync(SOURCES_README, 'utf8'))?.[1];
if (sha !== expectedSha) {
  fail(`empreinte SHA-256 de D8 inattendue (${sha}, attendu ${expectedSha ?? 'introuvable dans docs/sources/README.md'})`);
}

const result = (() => {
  try {
    return buildLibraryFromD8(readD8(markdown));
  } catch (error) {
    return fail(error instanceof ImportError ? error.message : String(error));
  }
})();

const outputs = [
  ...result.corpusFiles.map((f) => ({ path: join(outRoot, 'financial-corpus', f.name), entries: f.entries })),
  ...result.pageFiles.map((f) => ({ path: join(outRoot, 'safinum-test-pages', f.name), entries: f.entries })),
];

const issues = validateEntries(
  outputs.map((o) => ({ file: relative(ROOT, o.path), data: JSON.parse(serializeEntries(o.entries)) as unknown })),
  loadSchemaValidators(),
);
if (issues.length > 0) {
  fail(`les entrées construites ne passent pas validate-data :\n${issues.map((i) => `  ${i.file} [${i.id}] ${i.path} — ${i.message}`).join('\n')}`);
}

const existing = outputs.filter((o) => existsSync(o.path));
if (existing.length > 0 && !force) {
  fail(`import déjà fait (${existing.length} fichier(s) existent, ex. ${relative(ROOT, existing[0]?.path ?? '')}).\n`
    + '  L\'import ne s\'exécute qu\'une fois : data/ est maintenant la source de vérité.\n'
    + '  --force écraserait les fichiers, y compris les relectures déjà intégrées.');
}

for (const o of outputs) {
  mkdirSync(join(o.path, '..'), { recursive: true });
  writeFileSync(o.path, serializeEntries(o.entries), 'utf8');
}

const s = result.stats;
console.log(`D8 importé (SHA-256 ${sha.slice(0, 12)}…) :`);
console.log(`  corpus : ${s.corpusEntries} entrées + ${s.guardEntries} entrées protégées (GUARD)`);
console.log(`  pages  : ${s.pageEntries} textes, ${s.uniquePageTexts} uniques`);
console.log(`  liens  : ${s.exactLinks} exact, ${s.meaningLinks} par le sens, ${s.pagLinks} vers PAG (textes uniques)`);
console.log(`  gabarits liés : ${s.templateRefs.length} (${s.templateRefs.join(', ')}) sur ${s.pagesWithTemplateRefs.length} textes de pages`);
console.log(`  fusions tracées : ${Object.entries(s.mergedFrom).map(([id, from]) => `${from.join(', ')} → ${id}`).join(' ; ') || 'aucune'}`);
console.log(`  « EtonFin » remplacé : ${s.renamedEtonFin}`);
console.log(`${outputs.length} fichier(s) écrit(s) dans ${relative(ROOT, outRoot) || '.'}.`);
