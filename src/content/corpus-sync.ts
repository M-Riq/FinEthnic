/**
 * Couche « corpus (D8) » de l'extension (mission §3.2, §3.4 ; phase 4).
 *
 * Après chaque évaluation, la chaîne (`pipeline.ts`) propose ses textes ici. Ils sont comparés à D8
 * (déduplication du moteur, `d8-store.ts`) ; seuls les textes absents sont enrichis (analyse grammaticale,
 * synonymes, définition ou variantes simplifiées) puis gardés **sur l'appareil**, dans
 * `chrome.storage.local` (clé `corpusEnrichi`). Rien n'est transmis. Les entrées utiles sont aussitôt
 * ajoutées au moteur (`extend`), puis la page est réévaluée : un texte nouveau peut alors être traduit
 * par ses variantes.
 *
 * Valeurs : les montants, numéros, téléphones, références et adresses sont remplacés par `{valeur}`
 * avant stockage (`templateValues`). L'entrée devient un gabarit, comme celles de D8 (« Solde : {solde} ») :
 * elle couvre aussi les autres montants, sans créer une entrée par valeur. Les noms restent tels quels
 * (décision du responsable, phase 5). Hypothèses (ROADMAP, phases 4 et 5) :
 * - un texte dont moins de la moitié des mots sont connus du lexique français n'est pas proposé
 *   (texte d'une autre langue, code produit…) ;
 * - au plus `MAX_STORED_ENTRIES` entrées sont gardées ; les plus anciennes partent les premières.
 */
import { createEnrichedCorpus, type CorpusStore, type EnrichedCorpus } from '../engine/d8-store';
import type { LoadedEngine } from '../engine/bundle';
import type { CorpusEntry } from '../engine/corpus';
import { dedupKey } from '../engine/dedup';
import { buildD7Index } from '../engine/d7';
import { createEnricher, type EnrichedEntry, type Enricher, toEngineEntries } from '../engine/enrich';
import { normalize, type TokenKind } from '../engine/normalize';
import { createRuleSimplifier, type Simplifier } from '../engine/simplifier';
import type { ProtectedDetector, TranslationResult } from '../language/contract';
import { detectProtected } from '../protection/patterns';
import type { StorageLike } from '../shared/settings';

export const CORPUS_KEY = 'corpusEnrichi';
export const MAX_STORED_ENTRIES = 1000;
/** Attente après le dernier texte proposé avant d'enrichir (les SPA ajoutent leurs textes par rafales). */
export const OFFER_DELAY_MS = 400;
/** Textes enrichis par passe : le reste attend la passe suivante, pour ne pas bloquer la page. */
export const BATCH_SIZE = 50;
export const VALUE_PLACEHOLDER = '{valeur}';

/** Texte évalué par la chaîne, avec le résultat du moteur. */
export interface EvaluatedText {
  text: string;
  result: TranslationResult;
}

/** Ce que la page voit du corpus : `controller.ts` ne connaît que cette interface. */
export interface PageCorpus {
  offer(items: readonly EvaluatedText[]): void;
  /** Appelé quand le moteur a reçu de nouvelles entrées (la page doit être réévaluée). */
  subscribe(listener: () => void): () => void;
}

const isEntry = (value: unknown): value is EnrichedEntry => {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Partial<EnrichedEntry>;
  return typeof e.id === 'string' && typeof e.terme === 'string' && typeof e.cle === 'string' && typeof e.classe === 'string'
    && Array.isArray(e.synonymes) && Array.isArray(e.variantes) && (e.definition_simple === null || typeof e.definition_simple === 'string')
    && (e.statut === 'enrichi' || e.statut === 'a_enrichir');
};

/** Stockage des entrées enrichies dans `chrome.storage.local` ; une valeur mal formée est ignorée. */
export function createChromeCorpusStore(storage: StorageLike, max = MAX_STORED_ENTRIES): CorpusStore {
  let queue: Promise<unknown> = Promise.resolve();
  const load = async (): Promise<EnrichedEntry[]> => {
    const stored = (await storage.local.get(CORPUS_KEY))[CORPUS_KEY];
    return Array.isArray(stored) ? stored.filter(isEntry) : [];
  };
  return {
    load,
    save(entries) {
      const run = async (): Promise<void> => {
        const byKey = new Map((await load()).map((e) => [e.cle, e] as const));
        for (const e of entries) {
          // Une entrée remplacée passe en dernier : elle est gardée le plus longtemps.
          byKey.delete(e.cle);
          byKey.set(e.cle, e);
        }
        await storage.local.set({ [CORPUS_KEY]: [...byKey.values()].slice(-max) });
      };
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

/** Jetons du moteur qui portent une valeur : montants, nombres, adresses web et électroniques. */
const VALUE_KINDS: ReadonlySet<TokenKind> = new Set(['amount', 'number', 'url', 'email']);

export interface TemplateOptions {
  guards?: readonly string[];
  detect?: ProtectedDetector;
}

/**
 * Remplace par `{valeur}` les valeurs du texte : jetons de valeur du moteur (montants, nombres, adresses)
 * et motifs protégés de l'extension (téléphones, références…). Les noms protégés de D8 (« FCFA »,
 * « Safinum »), les variables déjà présentes (« {nom} ») et les noms de personnes restent.
 */
export function templateValues(text: string, options: TemplateOptions = {}): string {
  const { guards = [], detect = detectProtected } = options;
  const normalized = normalize(text, { guards });
  const base = normalized.text.replace(/\n/gu, ' ');
  const spans: [number, number][] = normalized.tokens.filter((t) => VALUE_KINDS.has(t.kind)).map((t) => [t.start, t.end]);
  let at = 0;
  for (const segment of detect(base)) {
    const i = segment === '' ? -1 : base.indexOf(segment, at);
    if (i < 0) continue;
    spans.push([i, i + segment.length]);
    at = i + segment.length;
  }
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = '';
  let from = 0;
  for (const [start, end] of spans) {
    if (end <= from) continue;
    out += base.slice(from, Math.max(from, start)) + (start >= from ? VALUE_PLACEHOLDER : '');
    from = end;
  }
  return (out + base.slice(from)).replace(/ {2,}/gu, ' ').trim();
}

/** Texte (valeurs en `{valeur}`) à proposer à D8, ou null : texte déjà dans D8, statut sans enrichissement possible, ou texte peu français. */
export function corpusText(
  item: EvaluatedText,
  isFrench: (word: string) => boolean,
  options: { guards?: readonly string[] } = {},
): string | null {
  const { guards = [] } = options;
  const { result } = item;
  // Un texte rattaché à une entrée de D8 (exacte ou par gabarit) n'en est pas absent : rien à proposer.
  if (result.entryId !== null) return null;
  if (result.status === 'APPROVED' || result.status === 'PROTECTED' || result.reason === 'too-long' || result.reason === 'unsupported-language') {
    return null;
  }
  const text = templateValues(item.text, { guards });
  const words = normalize(text, { guards }).tokens.filter((t) => t.kind === 'word');
  if (words.length === 0) return null;
  const known = words.filter((t) => isFrench(t.key)).length;
  return known * 2 >= words.length ? text : null;
}

export interface CorpusSyncOptions {
  loaded: LoadedEngine;
  store: CorpusStore;
  /** Stratégie de simplification ; par défaut, celle à base de règles et de D8 (créée au premier besoin). */
  simplifier?: Simplifier;
  delayMs?: number;
  batchSize?: number;
}

export interface CorpusSync extends PageCorpus {
  /** Résolu quand les entrées déjà gardées sont ajoutées au moteur. */
  readonly ready: Promise<void>;
  /** Enrichit tout de suite les textes en attente (tests, fermeture). */
  flush(): Promise<void>;
  stop(): void;
}

export function startCorpusSync(options: CorpusSyncOptions): CorpusSync {
  const { store } = options;
  const { resources, engine } = options.loaded;
  const delay = options.delayMs ?? OFFER_DELAY_MS;
  const batchSize = Math.max(1, options.batchSize ?? BATCH_SIZE);
  const { guards, lexicon } = resources;
  const listeners = new Set<() => void>();
  /** Clés déjà proposées dans cette page : un texte n'est comparé à D8 qu'une fois. */
  const offered = new Set<string>();
  const pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const teach = (entries: readonly CorpusEntry[]): void => {
    if (entries.length === 0 || stopped) return;
    engine.extend(entries);
    notify();
  };

  // Index de D7 et simplificateur ne sont construits qu'au premier texte absent de D8.
  let enricher: Enricher | null = null;
  const makeEnricher = (): Enricher => createEnricher({
    simplifier: options.simplifier ?? createRuleSimplifier({ corpus: resources.corpus, lexicon, guards }),
    d7: buildD7Index(resources.d7),
    lexicon,
    guards,
    translates: (text) => engine.core.translate(text).status === 'SUCCESS',
  });
  const protectedBase: CorpusEntry[] = (resources.protectedEntries ?? []).map((e) => ({ id: e.id, text: e.text, synonyms: [], definition: null }));

  const corpus: Promise<EnrichedCorpus> = createEnrichedCorpus({
    base: [...resources.corpus, ...protectedBase],
    store,
    guards,
    enricher: {
      enrich: (text) => (enricher ??= makeEnricher()).enrich(text),
      reenrich: (entry) => (enricher ??= makeEnricher()).reenrich(entry),
    },
    onAdded: (added) => teach(toEngineEntries(added)),
  });

  const ready = (async () => {
    const c = await corpus;
    // Les entrées gardées lors des visites précédentes, puis celles qui peuvent maintenant être enrichies.
    teach(await c.corpusEntries());
    await c.retry();
  })();
  ready.catch(() => undefined);

  async function run(): Promise<void> {
    timer = null;
    const c = await corpus;
    while (pending.length > 0 && !stopped) {
      await c.submit(pending.splice(0, batchSize));
      // Laisse la page respirer entre deux passes.
      if (pending.length > 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  let running: Promise<void> = Promise.resolve();
  const launch = (): Promise<void> => {
    running = running.then(run, run);
    return running;
  };

  return {
    ready,
    offer(items) {
      if (stopped) return;
      const isFrench = (word: string): boolean => lexicon.lookup(word).length > 0;
      for (const item of items) {
        const text = corpusText(item, isFrench, { guards });
        if (text === null) continue;
        const key = dedupKey(text, guards);
        if (key === '' || offered.has(key)) continue;
        offered.add(key);
        pending.push(text);
      }
      if (pending.length === 0) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void launch().catch(() => undefined), delay);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async flush() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      await ready.catch(() => undefined);
      await launch();
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
}
