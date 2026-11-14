/**
 * Moteur de traduction français → éton (MOT5) : assemble classification, simplification par D8,
 * construction éton avec D7 et sélection.
 *
 * Un seul moteur TypeScript pur (M3) : l'extension l'embarque (index D7 construit localement) et
 * l'API HTTP locale (scripts/serve-engine.ts) l'expose. Les ressources sont fournies par l'appelant.
 * Module pur, sans dépendance à Node.
 */
import { buildCorpus, type CorpusEntry } from './corpus';
import { buildD7Index, type D7Entry } from './d7';
import { type Connective, ETON_RULES, type IgnoredWords, type Partitive, type Possessive } from './eton';
import type { Lexicon } from './lexicon';
import { type SelectOptions, selectText, type TextResult, type WrongSense } from './select';
import { simplify } from './simplify';

export const ENGINE_VERSION = '0.1.0';

export interface EngineResources {
  /** Entrées de D8 traduisibles. */
  corpus: readonly CorpusEntry[];
  /** Noms protégés (marques, devises). */
  guards: readonly string[];
  lexicon: Lexicon;
  /** Entrées de D7. */
  d7: readonly D7Entry[];
  /** Articles ignorés (règle validée). */
  ignored: readonly IgnoredWords[];
  /** Partitifs supprimés après un verbe (M21) : grammar-rules.json, `partitives`. */
  partitives?: readonly Partitive[];
  /** Connectifs « de » entre deux noms (M26) : grammar-rules.json, `connectives`. */
  connectives?: readonly Connective[];
  /** Possessifs après le nom (M31) : grammar-rules.json, `possessives`. */
  possessives?: readonly Possessive[];
  /** Identifiants des entrées critiques de D8. */
  critical: readonly string[];
  /** Sens faux relevés (M18) : data/language-resources/sense-review.json. */
  wrongSenses?: readonly WrongSense[];
  /** Termes français gardés dans la phrase éton (M20) : data/language-resources/kept-french-terms.json. */
  keptFrench?: readonly string[];
}

export interface EngineInfo {
  version: string;
  d8Entries: number;
  d7Entries: number;
  d7Keys: number;
  lexiconForms: number;
  criticalEntries: number;
  /** Sens faux relevés (M18). */
  wrongSenses: number;
  /** Termes français gardés (M20). */
  keptFrench: number;
  /** Règles de D7 appliquées (classe A). Les classes B et C sont rendues comme des manques. */
  activeRules: string[];
}

export interface Engine {
  info(): EngineInfo;
  translate(text: string): TextResult;
  translateMany(texts: readonly string[]): TextResult[];
}

export interface EngineOptions {
  /** Nombre de résultats gardés en cache (les SPA réaffichent souvent les mêmes textes). 0 : aucun cache. */
  cacheSize?: number;
}

export function createEngine(resources: EngineResources, engineOptions: EngineOptions = {}): Engine {
  const { guards, lexicon, ignored } = resources;
  const corpus = buildCorpus(resources.corpus, { guards, lexicon });
  const d7 = buildD7Index(resources.d7);
  const references = new Map(resources.corpus.map((e) => [e.id, [e.text, ...e.synonyms, e.definition ?? ''].join(' . ')] as const));
  const options: SelectOptions = {
    guards, lexicon, ignored, critical: new Set(resources.critical), references, wrongSenses: resources.wrongSenses ?? [],
    kept: resources.keptFrench ?? [],
    partitives: resources.partitives ?? [],
    connectives: resources.connectives ?? [],
    possessives: resources.possessives ?? [],
  };
  const cacheSize = engineOptions.cacheSize ?? 1000;
  const cache = new Map<string, TextResult>();

  const info: EngineInfo = {
    version: ENGINE_VERSION,
    d8Entries: resources.corpus.length,
    d7Entries: resources.d7.length,
    d7Keys: d7.size,
    lexiconForms: lexicon.size,
    criticalEntries: options.critical?.size ?? 0,
    wrongSenses: options.wrongSenses?.length ?? 0,
    keptFrench: options.kept?.length ?? 0,
    activeRules: [...Object.values(ETON_RULES).filter((r) => r.ruleClass === 'A').map((r) => r.id), ...(options.partitives ?? []).map((p) => p.id),
      ...(options.connectives ?? []).map((c) => c.id), ...(options.possessives ?? []).map((p) => p.id)],
  };

  function translate(text: string): TextResult {
    const cached = cache.get(text);
    if (cached) return cached;
    const result = selectText(text, simplify(text, corpus, { guards, lexicon }), d7, options);
    if (cacheSize > 0) {
      if (cache.size >= cacheSize) cache.delete(cache.keys().next().value as string);
      cache.set(text, result);
    }
    return result;
  }

  return { info: () => ({ ...info, activeRules: [...info.activeRules] }), translate, translateMany: (texts) => texts.map(translate) };
}
