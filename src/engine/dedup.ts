/**
 * Déduplication avant l'envoi vers D8 (mission §3.2).
 *
 * Un texte extrait d'une page n'est envoyé vers D8 que s'il n'y est pas déjà. La comparaison ignore
 * la casse, les espaces, la ponctuation, les apostrophes et les accents (« Échéance » = « echeance »).
 * Une entrée à variables de D8 (« Solde : {solde} ») couvre aussi le texte réel affiché
 * (« Solde : 5 000 FCFA ») : la correspondance de gabarit de `matchWhole` est réutilisée.
 *
 * La clé sans accents ne sert qu'à la déduplication : le moteur, lui, garde les accents pour la
 * recherche (ROADMAP BM5.1), car « côte » et « cote » n'ont pas le même sens.
 *
 * Module pur, sans dépendance à Node.
 */
import { buildCorpus, type Corpus, type CorpusEntry, matchWhole } from './corpus';
import { normalize } from './normalize';

/** Clé de déduplication : sans accents, sans ponctuation, minuscules, variables anonymisées. */
export function dedupKey(text: string, guards: readonly string[] = []): string {
  return normalize(text, { guards }).tokens
    .filter((t) => t.kind !== 'punct')
    .map((t) => (t.kind === 'variable' ? '{}' : t.key.normalize('NFD').replace(/\p{M}+/gu, '').replace(/'/gu, '')))
    .filter((k) => k !== '')
    .join(' ');
}

export interface D8Index {
  /** Le texte est-il déjà dans D8 ? */
  has(text: string): boolean;
  /** Entrée de D8 qui couvre le texte, ou null. */
  find(text: string): CorpusEntry | null;
  /** Ajoute des entrées à l'index (après un enrichissement). */
  add(entries: readonly CorpusEntry[]): void;
  readonly size: number;
}

/**
 * Index de D8 pour la déduplication. `corpus` (déjà construit par le moteur) évite de reconstruire
 * l'index des gabarits ; à défaut, il est construit ici.
 */
export function createD8Index(entries: readonly CorpusEntry[], options: { guards?: readonly string[]; corpus?: Corpus } = {}): D8Index {
  const guards = options.guards ?? options.corpus?.guards ?? [];
  let corpus = options.corpus ?? buildCorpus(entries, { guards });
  const byKey = new Map<string, CorpusEntry>();
  const index = (list: readonly CorpusEntry[]): void => {
    for (const entry of list) {
      const key = dedupKey(entry.text, guards);
      if (key !== '' && !byKey.has(key)) byKey.set(key, entry);
    }
  };
  index(entries);
  let all = [...entries];

  function find(text: string): CorpusEntry | null {
    const key = dedupKey(text, guards);
    if (key === '') return null;
    const direct = byKey.get(key);
    if (direct) return direct;
    return matchWhole(corpus, normalize(text, { guards }).tokens, text)?.entry ?? null;
  }

  return {
    has: (text) => find(text) !== null,
    find,
    add(added) {
      index(added);
      all = [...all, ...added];
      if (added.some((e) => e.text.includes('{'))) corpus = buildCorpus(all, { guards });
    },
    get size() {
      return byKey.size;
    },
  };
}

/**
 * Textes absents de D8, dans l'ordre d'arrivée et sans doublon dans le lot lui-même
 * (« Payer » et « payer ! » ne sont gardés qu'une fois). Les textes vides ou sans mot sont ignorés.
 */
export function filterAbsent(texts: readonly string[], index: D8Index, guards: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    const key = dedupKey(text, guards);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    if (!normalize(text, { guards }).tokens.some((t) => t.kind === 'word')) continue;
    if (!index.has(text)) out.push(text);
  }
  return out;
}
