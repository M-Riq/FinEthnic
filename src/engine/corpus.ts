/**
 * Corpus D8 côté moteur (MOT3) : index des textes français et de leurs formes simples.
 *
 * Deux recherches :
 * - `matchWhole` : un texte (ou une phrase) correspond-il à une entrée de D8 ? La casse, les espaces,
 *   les apostrophes et la ponctuation finale sont ignorés. Une entrée à variables (« Total à débiter :
 *   {total} {devise} ») correspond aussi au texte réel affiché (« Total à débiter : 5 000 FCFA ») ;
 *   les valeurs prises par les variables sont rendues.
 * - `findTerms` : quels termes de D8 (mots ou expressions sans verbe conjugué) apparaissent dans une
 *   phrase ? Le plus long d'abord, sans chevauchement. Avec le lexique, un mot isolé est aussi
 *   reconnu par son lemme (« débité » → « Débiter »). Un mot à la fois nom et participe passé, juste
 *   après un nom ou un auxiliaire, est lu comme participe : « argent reçu » n'est pas le nom « Reçu ».
 *
 * Module pur, sans dépendance à Node. Les entrées sont fournies par l'appelant.
 */
import { classify } from './classify';
import { DETERMINERS, PREPOSITIONS } from './french';
import type { Lexicon } from './lexicon';
import { normalize, type Token } from './normalize';

export interface CorpusEntry {
  id: string;
  text: string;
  synonyms: readonly string[];
  definition: string | null;
}

export interface Corpus {
  readonly entries: readonly CorpusEntry[];
  readonly guards: readonly string[];
  /** Entrées sans variable, par clé de comparaison. */
  readonly exact: ReadonlyMap<string, CorpusEntry>;
  /** Entrées à variables, avec leurs jetons. */
  readonly templates: readonly { entry: CorpusEntry; tokens: Token[] }[];
  /** Termes (mots ou expressions sans verbe conjugué, avec synonymes ou définition), par clé des mots. */
  readonly terms: ReadonlyMap<string, CorpusEntry>;
  readonly maxTermWords: number;
}

export interface WholeMatch {
  entry: CorpusEntry;
  /** Valeur de chaque variable de l'entrée dans le texte reçu (« {total} » → « 5 000 FCFA »). */
  values: ReadonlyMap<string, string>;
}

export interface TermMatch {
  entry: CorpusEntry;
  /** Indices des jetons dans la phrase : [start, end). */
  start: number;
  end: number;
  /** FORM : mêmes mots que l'entrée ; LEMMA : même lemme, autre forme (« débité » / « Débiter »). */
  by: 'FORM' | 'LEMMA';
}

const SENTENCE_END = /^[.!?…]+$/u;
const hasSimple = (e: CorpusEntry): boolean => e.synonyms.length > 0 || e.definition !== null;

/** Jetons comparés : sans la ponctuation finale. */
export function comparedTokens(tokens: readonly Token[]): Token[] {
  let end = tokens.length;
  while (end > 0 && tokens[end - 1]?.kind === 'punct' && SENTENCE_END.test((tokens[end - 1] as Token).text)) end--;
  return tokens.slice(0, end);
}

const keyOf = (tokens: readonly Token[]): string => tokens.map((t) => t.key).join(' ');

/** Clé de comparaison d'un texte de D8 : deux entrées de même clé ont le même texte pour le moteur. */
export const textKey = (text: string, guards: readonly string[] = []): string => keyOf(comparedTokens(normalize(text, { guards }).tokens));
const isWordLike = (t: Token): boolean => t.kind === 'word' || t.kind === 'guard';

/**
 * Prépare l'index. Pour un même texte, la première entrée qui a des synonymes ou une définition est
 * gardée (sinon la première). `lexicon` sert à écarter des termes les entrées qui sont des phrases.
 */
export function buildCorpus(entries: readonly CorpusEntry[], options: { guards?: readonly string[]; lexicon?: Lexicon } = {}): Corpus {
  const guards = options.guards ?? [];
  const exact = new Map<string, CorpusEntry>();
  const templates: { entry: CorpusEntry; tokens: Token[] }[] = [];
  const terms = new Map<string, CorpusEntry>();
  let maxTermWords = 1;
  const keep = (map: Map<string, CorpusEntry>, key: string, entry: CorpusEntry): void => {
    const current = map.get(key);
    if (!current || (!hasSimple(current) && hasSimple(entry))) map.set(key, entry);
  };
  for (const entry of entries) {
    const tokens = comparedTokens(normalize(entry.text, { guards }).tokens);
    if (tokens.length === 0) continue;
    if (tokens.some((t) => t.kind === 'variable')) {
      templates.push({ entry, tokens });
      continue;
    }
    keep(exact, keyOf(tokens), entry);
    if (!hasSimple(entry) || !tokens.every(isWordLike)) continue;
    const [sentence, ...others] = classify(entry.text, { guards, ...(options.lexicon ? { lexicon: options.lexicon } : {}) }).sentences;
    if (others.length > 0 || !sentence || sentence.finiteVerbs.length > 0 || sentence.type !== null) continue;
    keep(terms, keyOf(tokens), entry);
    maxTermWords = Math.max(maxTermWords, tokens.length);
  }
  return { entries, guards, exact, templates, terms, maxTermWords };
}

type Segment = { kind: 'literal'; token: Token } | { kind: 'variables'; names: string[] };

function segments(pattern: readonly Token[]): Segment[] {
  const out: Segment[] = [];
  for (const token of pattern) {
    const last = out[out.length - 1];
    if (token.kind !== 'variable') out.push({ kind: 'literal', token });
    else if (last?.kind === 'variables') last.names.push(token.text);
    else out.push({ kind: 'variables', names: [token.text] });
  }
  return out;
}

/**
 * Correspondance d'un motif à variables. Une suite de variables consécutives prend au moins un jeton
 * (la plus courte d'abord) ; chaque variable y prend un jeton, la dernière le reste
 * (« {frais} {devise} » ← « 500 FCFA », un seul jeton : {frais} = « 500 FCFA », {devise} vide).
 */
function matchTemplate(pattern: readonly Token[], tokens: readonly Token[]): Map<string, [number, number]> | null {
  const segs = segments(pattern);
  const spans = new Map<string, [number, number]>();
  const step = (i: number, j: number): boolean => {
    const seg = segs[i];
    if (seg === undefined) return j === tokens.length;
    if (seg.kind === 'literal') return tokens[j]?.key === seg.token.key && step(i + 1, j + 1);
    for (let k = j + 1; k <= tokens.length; k++) {
      if (!step(i + 1, k)) continue;
      seg.names.forEach((name, n) => {
        const a = Math.min(j + n, k);
        spans.set(name, [a, n === seg.names.length - 1 ? k : Math.min(a + 1, k)]);
      });
      return true;
    }
    return false;
  };
  return step(0, 0) ? spans : null;
}

/** Entrée de D8 qui correspond à tout le texte des jetons donnés, ou null. */
export function matchWhole(corpus: Corpus, tokens: readonly Token[], text: string): WholeMatch | null {
  const compared = comparedTokens(tokens);
  if (compared.length === 0) return null;
  const entry = corpus.exact.get(keyOf(compared));
  if (entry) return { entry, values: new Map() };
  const offset = (compared[0] as Token).start;
  for (const template of corpus.templates) {
    const spans = matchTemplate(template.tokens, compared);
    if (!spans) continue;
    const values = new Map<string, string>();
    for (const [name, [a, b]] of spans) {
      values.set(name, a === b ? '' : text.slice((compared[a] as Token).start - offset, (compared[b - 1] as Token).end - offset));
    }
    return { entry: template.entry, values };
  }
  return null;
}

/**
 * « reçu », « arrondi », « garantie » : nom ou participe passé ? Participe juste après un nom ou un
 * auxiliaire (« l'argent reçu », « le code reçu », « il a reçu », « avez-vous reçu ») ; nom après un déterminant, une
 * préposition ou en tête (« le reçu », « Reçu de transaction »).
 */
function participleHere(tokens: readonly Token[], i: number, lexicon: Lexicon | undefined): boolean {
  const token = tokens[i] as Token;
  // Sujet inversé entre l'auxiliaire et le participe (« Avez-vous reçu ») : on regarde l'auxiliaire.
  const previous = tokens[i - 1]?.enclitic ? tokens[i - 2] : tokens[i - 1];
  if (!lexicon || token.kind !== 'word' || previous?.kind !== 'word') return false;
  if (DETERMINERS.has(previous.key) || PREPOSITIONS.has(previous.key)) return false;
  const readings = lexicon.lookup(token.key);
  if (!readings.some((r) => r.mood === 'PAST_PARTICIPLE') || !readings.some((r) => r.pos === 'NOUN')) return false;
  return lexicon.lookup(previous.key).some((r) => r.pos === 'NOUN' || r.pos === 'AUX');
}

/** Termes de D8 présents dans une phrase : le plus long d'abord, sans chevauchement, de gauche à droite. */
export function findTerms(corpus: Corpus, tokens: readonly Token[], lexicon?: Lexicon): TermMatch[] {
  const found: TermMatch[] = [];
  for (let i = 0; i < tokens.length;) {
    let match: TermMatch | null = null;
    const participle = participleHere(tokens, i, lexicon);
    for (let n = Math.min(corpus.maxTermWords, tokens.length - i); n >= 1 && !match; n--) {
      const span = tokens.slice(i, i + n);
      if (!span.every(isWordLike)) continue;
      if (n === 1 && participle) continue;
      const entry = corpus.terms.get(keyOf(span));
      if (entry) match = { entry, start: i, end: i + n, by: 'FORM' };
    }
    const token = tokens[i] as Token;
    const readings = lexicon && token.kind === 'word' ? lexicon.lookup(token.key) : [];
    // Un auxiliaire (« a », « est ») n'est jamais rapproché d'un terme (« Avoir »).
    if (!match && readings.length > 0 && !readings.some((r) => r.pos === 'AUX')) {
      const read = participle ? readings.filter((r) => r.pos !== 'NOUN') : readings;
      const lemmas = [...new Set(read.map((r) => r.lemma.toLocaleLowerCase('fr')))];
      const entry = lemmas.map((l) => corpus.terms.get(l)).find((e) => e !== undefined);
      if (entry) match = { entry, start: i, end: i + 1, by: 'LEMMA' };
    }
    if (match) {
      found.push(match);
      i = match.end;
    } else i++;
  }
  return found;
}
