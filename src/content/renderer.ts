/**
 * Rendu (P5) : la seule partie de l'extension qui écrit dans la page.
 *
 * - `decide` (pur) choisit le texte à afficher pour un résultat du moteur : `output` si `APPROVED`,
 *   `unverifiedOutput` si `PENDING_VALIDATION` et que l'option « non vérifiées » est active (Q9, contrat §5.4),
 *   sinon rien (5.6). Le texte passe d'abord le contrôle d'intégrité (5.8). Ni `output` ni `unverifiedOutput`
 *   ne sont retouchés (5.9) : le mode bilingue (Q3 b) ajoute seulement le français entre parenthèses.
 * - `createRenderer` écrit **uniquement `Text.data`** (5.1) : aucun nœud ajouté ou retiré, aucun attribut,
 *   pas d'`innerHTML`. L'original et la dernière écriture de chaque nœud restent en mémoire seulement.
 *   Un nœud n'est restauré que s'il contient encore notre écriture (5.2) ; sinon l'application l'a changé
 *   et on n'y touche plus (5.4).
 *
 * Les nœuds écrits sont rangés dans une `Map` plutôt qu'une `WeakMap` (5.1) : il faut pouvoir tous les
 * restaurer à la désactivation. La chaîne de lecture restaure et oublie un nœud dès qu'il quitte la page :
 * aucun nœud retiré n'est retenu, et un nœud remis plus tard dans la page revient en français.
 *
 * Phase 2 (mission §3.1) : la même logique sert aux attributs `placeholder`, `title` et `aria-label`
 * (`attributes.ts`). Le rendu est donc paramétré par un accès en lecture et en écriture (`ValueAccess`) :
 * `Text.data` par défaut, `getAttribute`/`setAttribute` pour un attribut. Rien d'autre n'est jamais écrit.
 */
import type { ProtectedDetector, TranslationResult } from '../language/contract';
import { checkIntegrity, type IntegrityFailure } from '../protection/integrity';
import { detectProtected } from '../protection/patterns';
import type { DisplayMode } from '../shared/settings';

/** Nature d'un texte affiché : traduction approuvée, non vérifiée complète, ou brouillon incomplet. */
export type Display = 'approved' | 'unverified' | 'partial';

export interface DisplaySettings {
  showUnverified: boolean;
  displayMode: DisplayMode;
}

export type Decision =
  /** Garder le texte d'origine : statut sans texte, option désactivée ou résultat inutilisable. */
  | { action: 'keep' }
  /** Garder le texte d'origine : la traduction modifierait une valeur protégée. */
  | { action: 'refuse'; failure: IntegrityFailure }
  | { action: 'write'; text: string; display: Display };

export const KEEP: Decision = Object.freeze({ action: 'keep' });

/** Découpe un texte en espaces de début, cœur et espaces de fin (même découpage que le moteur, I4). */
export function edges(text: string): [lead: string, core: string, trail: string] {
  const lead = /^\s*/u.exec(text)?.[0] ?? '';
  const rest = text.slice(lead.length);
  const trail = /\s*$/u.exec(rest)?.[0] ?? '';
  return [lead, rest.slice(0, rest.length - trail.length), trail];
}

/** Mode bilingue : `traduction (français)`, la traduction restant intacte et les espaces de bord à leur place. */
export function bilingual(source: string, translation: string): string {
  const [, core] = edges(source);
  const [lead, translated, trail] = edges(translation);
  if (core === '' || translated === core) return translation;
  return `${lead}${translated} (${core})${trail}`;
}

export function decide(
  source: string,
  result: TranslationResult,
  settings: DisplaySettings,
  detect: ProtectedDetector = detectProtected,
): Decision {
  let translation: unknown;
  let display: Display;
  if (result.status === 'APPROVED') {
    translation = result.output;
    display = 'approved';
  } else if (result.status === 'PENDING_VALIDATION' && settings.showUnverified) {
    translation = result.unverifiedOutput;
    // Une traduction dont la nature est inconnue n'est jamais présentée comme complète (contrat §2-1).
    display = result.unverifiedKind === 'complete' ? 'unverified' : 'partial';
  } else {
    return KEEP;
  }
  if (typeof translation !== 'string' || edges(translation)[1] === '') return KEEP;
  const segments = Array.isArray(result.protectedSegments) ? result.protectedSegments : [];
  const failure = checkIntegrity(source, translation, segments, detect);
  if (failure) return { action: 'refuse', failure };
  return { action: 'write', text: settings.displayMode === 'bilingual' ? bilingual(source, translation) : translation, display };
}

/** Ce que l'extension a écrit dans un nœud. En mémoire seulement : jamais journalisé, rangé ni transmis. */
export interface Written {
  readonly original: string;
  readonly text: string;
  readonly display: Display;
}

/**
 * - `ours` : le nœud contient encore notre dernière écriture ;
 * - `changed` : nous y avons écrit, mais l'application a remplacé le texte depuis ;
 * - `null` : nous n'y avons jamais écrit (ou il a été rendu).
 */
export type Ownership = 'ours' | 'changed' | null;

export interface Renderer<T = Text> {
  /** Écrit `text` dans le nœud. L'original est gardé à la première écriture, ou repris si l'application l'a changé. */
  write(node: T, text: string, display: Display): void;
  /** Rend le nœud : remet l'original s'il contient encore notre écriture, puis l'oublie. Vrai si l'original a été remis. */
  restore(node: T): boolean;
  /** Rend tous les nœuds écrits ; renvoie le nombre d'originaux remis. */
  restoreAll(): number;
  /** Oublie le nœud sans y toucher (l'application a remplacé notre écriture). */
  release(node: T): void;
  ownership(node: T): Ownership;
  /** Texte d'origine d'un nœud qui contient notre écriture, sinon son texte actuel. */
  sourceOf(node: T): string;
  /** Nœuds qui contiennent encore notre écriture, dans l'ordre des écritures. */
  entries(): Generator<readonly [T, Written]>;
}

/** Lecture et écriture de la valeur d'une cible (nœud texte, attribut…). */
export interface ValueAccess<T> {
  read(target: T): string;
  write(target: T, value: string): void;
}

export const TEXT_ACCESS: ValueAccess<Text> = {
  read: (node) => node.data,
  write: (node, value) => {
    node.data = value;
  },
};

export function createRenderer(): Renderer;
export function createRenderer<T extends object>(access: ValueAccess<T>): Renderer<T>;
export function createRenderer<T extends object>(access: ValueAccess<T> = TEXT_ACCESS as unknown as ValueAccess<T>): Renderer<T> {
  const written = new Map<T, Written>();

  const ownership = (node: T): Ownership => {
    const current = written.get(node);
    if (!current) return null;
    return access.read(node) === current.text ? 'ours' : 'changed';
  };

  const restore = (node: T): boolean => {
    const current = written.get(node);
    if (!current) return false;
    written.delete(node);
    if (access.read(node) !== current.text) return false;
    if (access.read(node) !== current.original) access.write(node, current.original);
    return true;
  };

  return {
    write(node, text, display) {
      const current = written.get(node);
      const original = current && access.read(node) === current.text ? current.original : access.read(node);
      // Écrire la même valeur créerait quand même une mutation : on l'évite.
      if (access.read(node) !== text) access.write(node, text);
      written.set(node, { original, text, display });
    },
    restore,
    restoreAll() {
      let restored = 0;
      for (const node of [...written.keys()]) if (restore(node)) restored++;
      return restored;
    },
    release(node) {
      written.delete(node);
    },
    ownership,
    sourceOf(node) {
      const current = written.get(node);
      return current && access.read(node) === current.text ? current.original : access.read(node);
    },
    *entries() {
      for (const [node, entry] of written) if (access.read(node) === entry.text) yield [node, entry] as const;
    },
  };
}
