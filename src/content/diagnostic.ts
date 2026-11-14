/**
 * Diagnostic (P2.6) et marqueurs (P5.10) : compteurs par statut et surlignage des textes.
 *
 * Le surlignage passe par la CSS Custom Highlight API (`CSS.highlights`) : des plages (`Range`) sont
 * enregistrées sous les noms `finethnic-*`, stylés par `content.css` (`::highlight()`). Aucun nœud,
 * attribut ni style n'est ajouté au DOM de la page. Les styles se distinguent par la forme du trait,
 * pas seulement par la couleur.
 *
 * - Diagnostic : chaque texte suivi selon sa catégorie, seulement en mode diagnostic.
 * - Marqueurs : chaque traduction non vérifiée affichée (tirets) ou brouillon (vagues), toujours (contrat §5.4-2).
 */
import type { TranslationResult, TranslationStatus, UnverifiedKind } from '../language/contract';
import { COUNT_KEYS, DISPLAY_KEYS, EXTRACTION_KEYS, type CountKey, type DisplayKey, type ExtractionKey, type TextClass } from '../shared/messages';
import type { Display } from './renderer';
import type { TextKind } from './scanner';

/** État d'un texte suivi. Gardé en mémoire seulement, jamais journalisé ni transmis. */
export interface Tracked {
  kind: TextKind;
  /** `null` : pas encore évalué (aucun moteur, ou en file d'attente). */
  status: TranslationStatus | null;
  unverifiedKind: UnverifiedKind | null;
  /** Dernier résultat du moteur et texte évalué, pour réafficher sans réévaluer quand une option change (P5). */
  result?: TranslationResult | null;
  evaluated?: string | null;
  /** Ce qui est affiché en éton, `null` si le texte d'origine est conservé (P5). */
  shown?: Display | null;
  /** Traduction écartée par le contrôle d'intégrité (P5.8). */
  refused?: boolean;
  /** Classe du texte à traduire (phase 2), `null` pour une valeur ou un nombre. */
  textClass?: TextClass | null;
  /** Texte lu dans un attribut (`placeholder`, `title`, `aria-label`). */
  attribute?: boolean;
}

export type DiagnosticClass = Exclude<CountKey, 'candidates' | DisplayKey | ExtractionKey>;

const isDisplayKey = (key: CountKey): key is DisplayKey => DISPLAY_KEYS.some((display) => display === key);
const isExtractionKey = (key: CountKey): key is ExtractionKey => EXTRACTION_KEYS.some((extraction) => extraction === key);

export const DIAGNOSTIC_CLASSES: readonly DiagnosticClass[] = COUNT_KEYS.filter(
  (key): key is DiagnosticClass => key !== 'candidates' && !isDisplayKey(key) && !isExtractionKey(key),
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
    if (entry.shown) counts.displayed++;
    if (entry.shown === 'unverified' || entry.shown === 'partial') counts.displayedUnverified++;
    if (entry.refused) counts.refused++;
    if (entry.attribute) counts.attributes++;
    if (entry.kind === 'candidate' && entry.textClass) counts[entry.textClass]++;
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

/** Plage du texte d'un nœud sans ses espaces de bord, ou `null` s'il est vide ou hors de la page. */
function rangeOf(node: Text): Range | null {
  if (!node.isConnected) return null;
  const start = /^\s*/u.exec(node.data)?.[0].length ?? 0;
  const end = node.data.length - (/\s*$/u.exec(node.data)?.[0].length ?? 0);
  if (end <= start) return null;
  const range = node.ownerDocument.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

function paintGroups(api: HighlightApi, groups: ReadonlyMap<string, readonly Range[]>): void {
  for (const [name, ranges] of groups) {
    if (ranges.length > 0) api.set(name, ranges);
    else api.delete(name);
  }
}

/** Surligne chaque texte suivi selon sa catégorie, sans les espaces de bord. */
export function paintHighlights(api: HighlightApi, entries: Iterable<readonly [Text, Tracked]>): void {
  const groups = new Map<string, Range[]>(DIAGNOSTIC_CLASSES.map((cls) => [highlightName(cls), []]));
  for (const [node, entry] of entries) {
    const range = rangeOf(node);
    if (range) groups.get(highlightName(classOf(entry)))?.push(range);
  }
  paintGroups(api, groups);
}

/** Marqueurs des traductions non vérifiées affichées (contrat §5.4-2 et 6), repris par `content.css`. */
export const MARK_NAMES: Readonly<Record<Exclude<Display, 'approved'>, string>> = {
  unverified: 'finethnic-mark-unverified',
  partial: 'finethnic-mark-partial',
};

export function paintMarks(api: HighlightApi, entries: Iterable<readonly [Text, Tracked]>): void {
  const groups = new Map<string, Range[]>(Object.values(MARK_NAMES).map((name) => [name, []]));
  for (const [node, entry] of entries) {
    if (entry.shown !== 'unverified' && entry.shown !== 'partial') continue;
    const range = rangeOf(node);
    if (range) groups.get(MARK_NAMES[entry.shown])?.push(range);
  }
  paintGroups(api, groups);
}

export function clearMarks(api: HighlightApi): void {
  for (const name of Object.values(MARK_NAMES)) api.delete(name);
}
