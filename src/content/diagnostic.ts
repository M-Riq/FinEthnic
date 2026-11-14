/**
 * Diagnostic (P2.6) : compteurs par statut et surlignage des textes détectés.
 *
 * Le surlignage passe par la CSS Custom Highlight API (`CSS.highlights`) : des plages (`Range`) sont
 * enregistrées sous les noms `finethnic-*`, stylés par `content.css` (`::highlight()`). Aucun nœud,
 * attribut ni style n'est ajouté au DOM de la page. Les styles se distinguent par la forme du trait,
 * pas seulement par la couleur.
 */
import type { TranslationStatus, UnverifiedKind } from '../language/contract';
import { COUNT_KEYS, type CountKey } from '../shared/messages';
import type { TextKind } from './scanner';

/** État d'un texte suivi. Gardé en mémoire seulement, jamais journalisé ni transmis. */
export interface Tracked {
  kind: TextKind;
  /** `null` : pas encore évalué (aucun moteur, ou en file d'attente). */
  status: TranslationStatus | null;
  unverifiedKind: UnverifiedKind | null;
}

export type DiagnosticClass = Exclude<CountKey, 'candidates'>;

export const DIAGNOSTIC_CLASSES: readonly DiagnosticClass[] = COUNT_KEYS.filter(
  (key): key is DiagnosticClass => key !== 'candidates',
);

const BY_STATUS: Record<TranslationStatus, DiagnosticClass> = {
  APPROVED: 'approved',
  PENDING_VALIDATION: 'unverified',
  KNOWN_UNTRANSLATED: 'untranslated',
  NO_MATCH: 'noMatch',
  AMBIGUOUS: 'ambiguous',
  PROTECTED: 'protected',
};

export function classOf(entry: Tracked): DiagnosticClass {
  if (entry.kind === 'numeric-like') return 'numeric';
  if (entry.kind === 'value') return 'values';
  if (entry.status === null) return 'waiting';
  if (entry.status === 'PENDING_VALIDATION' && entry.unverifiedKind === 'partial') return 'partial';
  return BY_STATUS[entry.status];
}

export function countEntries(entries: Iterable<Tracked>): Record<CountKey, number> {
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as Record<CountKey, number>;
  for (const entry of entries) {
    counts[classOf(entry)]++;
    if (entry.kind === 'candidate') counts.candidates++;
  }
  return counts;
}

/** Nom du surlignage d'une catégorie, repris par `content.css`. */
export const highlightName = (cls: DiagnosticClass): string =>
  `finethnic-${cls.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

/** Partie de `CSS.highlights` utilisée ici (remplaçable par un faux registre dans les tests). */
export interface HighlightApi {
  set(name: string, ranges: readonly Range[]): void;
  delete(name: string): void;
}

/** Registre de surlignage du navigateur, ou `null` s'il n'est pas pris en charge (Chrome < 105). */
export function cssHighlights(win: Window & typeof globalThis): HighlightApi | null {
  const registry = win.CSS?.highlights;
  const HighlightCtor = win.Highlight;
  if (!registry || typeof HighlightCtor !== 'function') return null;
  return {
    set: (name, ranges) => void registry.set(name, new HighlightCtor(...ranges)),
    delete: (name) => void registry.delete(name),
  };
}

export function clearHighlights(api: HighlightApi): void {
  for (const cls of DIAGNOSTIC_CLASSES) api.delete(highlightName(cls));
}

/** Surligne chaque texte suivi selon sa catégorie, sans les espaces de bord. */
export function paintHighlights(api: HighlightApi, entries: Iterable<readonly [Text, Tracked]>): void {
  const groups = new Map<DiagnosticClass, Range[]>(DIAGNOSTIC_CLASSES.map((cls) => [cls, []]));
  for (const [node, entry] of entries) {
    const doc = node.ownerDocument;
    if (!node.isConnected) continue;
    const start = /^\s*/u.exec(node.data)?.[0].length ?? 0;
    const end = node.data.length - (/\s*$/u.exec(node.data)?.[0].length ?? 0);
    if (end <= start) continue;
    const range = doc.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    groups.get(classOf(entry))?.push(range);
  }
  for (const [cls, ranges] of groups) {
    if (ranges.length > 0) api.set(highlightName(cls), ranges);
    else api.delete(highlightName(cls));
  }
}
