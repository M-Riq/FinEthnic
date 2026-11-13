/** Lecture des fichiers JSON de la bibliothèque (data/), commune aux scripts. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { LibraryEntry } from './library-entry';

/** Dossiers de la bibliothèque, dans l'ordre de lecture. */
export const DEFAULT_DATA_DIRS = ['data/financial-corpus', 'data/safinum-test-pages'] as const;

/** Fichiers .json d'un dossier et de ses sous-dossiers, triés par nom. */
export function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return listJsonFiles(path);
      return name.endsWith('.json') ? [path] : [];
    });
}

/**
 * Lit toutes les entrées des dossiers par défaut. À appeler APRÈS validate-data (schéma) :
 * les entrées sont seulement typées, pas revalidées ici.
 */
export function readLibraryEntries(root: string): { files: { file: string; data: unknown }[]; entries: LibraryEntry[] } {
  const files = DEFAULT_DATA_DIRS.flatMap((d) => listJsonFiles(join(root, d))).map((path) => ({
    file: relative(root, path),
    data: JSON.parse(readFileSync(path, 'utf8')) as unknown,
  }));
  const entries = files.flatMap((f) => (Array.isArray(f.data) ? (f.data as LibraryEntry[]) : []));
  return { files, entries };
}
