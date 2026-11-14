/**
 * Passage des entrées de la bibliothèque (D8) au corpus du moteur (src/engine/corpus.ts).
 * Les entrées PROTECTED et dépréciées sont écartées : elles ne se simplifient ni ne se traduisent.
 */
import type { ProtectedEntry } from '../../src/engine/contract-engine';
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

/**
 * Entrées critiques (M7) : marquées `sensitivity: critical` dans D8 (actions financières), ou contenant
 * un montant ou une devise. Non rendues en éton, elles donnent FALLBACK (français seul).
 */
export function criticalEntryIds(entries: readonly LibraryEntry[]): string[] {
  return entries
    .filter((e) => e.sensitivity === 'critical' || e.variables.some((v) => v.type === 'amount' || v.type === 'currency'))
    .map((e) => e.id);
}

/** Données propres au contrat (MOT6) : entrées protégées ou hors périmètre, traductions validées ou rejetées. */
export interface ContractExtras {
  protectedEntries: ProtectedEntry[];
  approved: Map<string, string>;
  rejected: Set<string>;
}

export function contractExtras(entries: readonly LibraryEntry[]): ContractExtras {
  const live = entries.filter((e) => !e.deprecated);
  const protectedEntries: ProtectedEntry[] = live
    .filter((e) => e.disposition !== 'TRANSLATABLE')
    .map((e) => ({
      id: e.id,
      text: e.source.fr.text,
      reason: e.disposition === 'PROTECTED' ? 'protected-entry' : 'out-of-scope',
    }));
  const approved = new Map<string, string>();
  const rejected = new Set<string>();
  for (const e of live) {
    const eto = e.target.eto;
    if (e.disposition !== 'TRANSLATABLE' || eto === null) continue;
    const { linguistic, financialMeaning } = eto.validation;
    if (linguistic === 'REJECTED' || financialMeaning === 'REJECTED') rejected.add(e.id);
    else if (eto.text !== null && eto.translationStatus === 'VALIDATED_OBALA'
      && linguistic === 'VALIDATED' && financialMeaning === 'VALIDATED') approved.set(e.id, eto.text);
  }
  return { protectedEntries, approved, rejected };
}
