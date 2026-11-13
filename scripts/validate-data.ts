/**
 * Valide la bibliothèque linguistique (BM1.4) sans rien modifier.
 *
 *   npm run validate-data             → valide data/financial-corpus/ et data/safinum-test-pages/
 *   npm run validate-data -- <dossier> → valide les fichiers JSON d'un autre dossier
 *
 * Code de sortie : 0 si aucun problème, 1 sinon.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntries, type DataFile, type Issue } from './lib/data-validation';
import { loadSchemaValidators } from './lib/schemas';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_DIRS = ['data/financial-corpus', 'data/safinum-test-pages'];

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return listJsonFiles(path);
      return name.endsWith('.json') ? [path] : [];
    });
}

const explicit = process.argv.length > 2;
const dirs = explicit ? process.argv.slice(2) : DEFAULT_DIRS.map((d) => join(ROOT, d));
const files: DataFile[] = [];
const issues: Issue[] = [];

// Un dossier demandé explicitement doit exister et contenir du JSON : une faute de frappe ne doit pas passer pour un succès.
// Les dossiers par défaut peuvent manquer tant que l'import BM2 ne les a pas créés.
for (const dir of dirs) {
  if (!existsSync(dir)) {
    if (explicit) issues.push({ file: dir, id: null, path: '/', message: 'dossier introuvable' });
    else console.log(`(dossier absent, ignoré : ${relative(ROOT, dir)})`);
  }
}
const paths = dirs.flatMap(listJsonFiles);
if (explicit && paths.length === 0 && issues.length === 0) {
  issues.push({ file: dirs.join(', '), id: null, path: '/', message: 'aucun fichier JSON trouvé' });
}

for (const path of paths) {
  const file = relative(ROOT, path);
  try {
    files.push({ file, data: JSON.parse(readFileSync(path, 'utf8')) });
  } catch (error) {
    issues.push({ file, id: null, path: '/', message: `JSON illisible : ${(error as Error).message}` });
  }
}

issues.push(...validateEntries(files, loadSchemaValidators()));
const entryCount = files.reduce((n, f) => n + (Array.isArray(f.data) ? f.data.length : 0), 0);

for (const i of issues) {
  console.error(`✗ ${i.file}${i.id ? ` [${i.id}]` : ''} ${i.path} — ${i.message}`);
}
console.log(`${files.length} fichier(s), ${entryCount} entrée(s), ${issues.length} problème(s).`);
process.exitCode = issues.length === 0 ? 0 : 1;
