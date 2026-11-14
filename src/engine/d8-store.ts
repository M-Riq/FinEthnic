/**
 * Corpus D8 enrichi (mission §3.2, §3.4) : déduplication, puis enrichissement, puis stockage.
 *
 * D8 livré avec l'extension est en lecture seule ; les entrées créées à partir des pages sont
 * gardées à part dans un `CorpusStore` (mémoire ici ; `chrome.storage.local` dans l'extension,
 * phase 4). Seuls les textes absents de D8 et des entrées déjà créées sont enrichis.
 *
 * Module pur, sans dépendance à Node.
 */
import type { CorpusEntry } from './corpus';
import { createD8Index, type D8Index, dedupKey, filterAbsent } from './dedup';
import { type EnrichedEntry, type Enricher, toCorpusEntry, toEngineEntries } from './enrich';

/** Stockage des entrées enrichies : interface remplaçable (mémoire, chrome.storage, fichier…). */
export interface CorpusStore {
  load(): Promise<EnrichedEntry[]>;
  /** Ajoute ou remplace (même `cle`) des entrées. */
  save(entries: readonly EnrichedEntry[]): Promise<void>;
}

export function createMemoryCorpusStore(initial: readonly EnrichedEntry[] = []): CorpusStore & { readonly entries: readonly EnrichedEntry[] } {
  const byKey = new Map(initial.map((e) => [e.cle, e] as const));
  return {
    load: async () => [...byKey.values()],
    async save(entries) {
      for (const e of entries) byKey.set(e.cle, e);
    },
    get entries() {
      return [...byKey.values()];
    },
  };
}

export interface SubmitResult {
  /** Entrées créées par cet envoi. */
  added: EnrichedEntry[];
  /** Textes reçus déjà présents dans D8 (ou en double dans le lot). */
  skipped: number;
}

export interface EnrichedCorpus {
  /** Envoie des textes extraits : seuls les absents de D8 sont enrichis et stockés. */
  submit(texts: readonly string[]): Promise<SubmitResult>;
  /** Reprend les entrées `a_enrichir` ; renvoie celles qui sont devenues `enrichi`. */
  retry(): Promise<EnrichedEntry[]>;
  /** Entrées enrichies utiles au moteur (à passer à `engine.extend`) : sans les entrées vides. */
  corpusEntries(): Promise<CorpusEntry[]>;
  has(text: string): boolean;
}

export interface EnrichedCorpusOptions {
  /** D8 livré (lecture seule). */
  base: readonly CorpusEntry[];
  store: CorpusStore;
  enricher: Enricher;
  guards?: readonly string[];
  /** Appelé après chaque ajout (par exemple pour étendre le moteur). */
  onAdded?: (entries: readonly EnrichedEntry[]) => void;
}

export async function createEnrichedCorpus(options: EnrichedCorpusOptions): Promise<EnrichedCorpus> {
  const guards = options.guards ?? [];
  const stored = await options.store.load();
  const index: D8Index = createD8Index([...options.base, ...stored.map(toCorpusEntry)], { guards });
  // Les envois sont traités l'un après l'autre : deux envois du même texte ne créent qu'une entrée.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  async function submit(texts: readonly string[]): Promise<SubmitResult> {
    const absent = filterAbsent(texts, index, guards);
    const added: EnrichedEntry[] = [];
    for (const text of absent) {
      for (const entry of await options.enricher.enrich(text)) {
        // Une phrase d'un paragraphe peut déjà être dans D8.
        if (index.has(entry.terme) || added.some((e) => e.cle === entry.cle)) continue;
        added.push(entry);
      }
    }
    if (added.length > 0) {
      await options.store.save(added);
      index.add(added.map(toCorpusEntry));
      options.onAdded?.(added);
    }
    const nonEmpty = texts.filter((t) => dedupKey(t, guards) !== '').length;
    return { added, skipped: Math.max(0, nonEmpty - absent.length) };
  }

  async function retry(): Promise<EnrichedEntry[]> {
    const pending = (await options.store.load()).filter((e) => e.statut === 'a_enrichir');
    const improved: EnrichedEntry[] = [];
    for (const entry of pending) {
      const again = await options.enricher.reenrich(entry);
      if (again.statut === 'enrichi') improved.push(again);
    }
    if (improved.length > 0) {
      await options.store.save(improved);
      options.onAdded?.(improved);
    }
    return improved;
  }

  return {
    submit: (texts) => serial(() => submit(texts)),
    retry: () => serial(retry),
    corpusEntries: async () => toEngineEntries(await options.store.load()),
    has: (text) => index.has(text),
  };
}
