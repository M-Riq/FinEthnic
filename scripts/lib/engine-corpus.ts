/**
 * Passage des entrées de la bibliothèque (D8) au corpus du moteur (src/engine/corpus.ts).
 * Les entrées PROTECTED et dépréciées sont écartées : elles ne se simplifient ni ne se traduisent.
 */
import type { CorpusEntry } from '../../src/engine/corpus';
import type { LibraryEntry } from './library-entry';

export function corpusEntries(entries: readonly LibraryEntry[]): CorpusEntry[] {
  return entries
    .filter((e) => e.disposition === 'TRANSLATABLE' && !e.deprecated)
    .map((e) => ({
      id: e.id,
      text: e.source.fr.text,
      synonyms: e.source.fr.simple?.synonyms ?? [],
      definition: e.source.fr.simple?.definition ?? null,
    }));
}

/** Noms protégés (marques, devises) : textes des entrées de type guard. */
export function guardTexts(entries: readonly LibraryEntry[]): string[] {
  return entries.filter((e) => e.kind === 'guard').map((e) => e.source.fr.text);
}
