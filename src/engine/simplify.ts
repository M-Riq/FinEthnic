/**
 * Simplification par le corpus D8 (MOT3, décision M4).
 *
 * Le moteur ne génère aucun texte : il n'utilise que ce que D8 contient.
 * - EXACT : le texte (ou une de ses phrases) est une entrée de D8. Candidats : l'original, puis les
 *   synonymes de D8 un par un, puis chaque phrase de la définition (3 au plus, mission §3.5), variables
 *   remplies par les valeurs du texte reçu.
 * - PARTIAL : la phrase n'est pas dans D8 mais contient des termes de D8. Candidats : l'original, puis
 *   au plus 3 variantes où chaque terme est remplacé par un de ses synonymes. Une variante n'est gardée
 *   que si elle ne perd rien de la phrase (question, impératif, négation, restriction, temps).
 *   Les définitions des termes reconnus sont rendues en notes.
 * - NONE : aucun terme de D8. Seul l'original est candidat.
 * Toute unité qui n'est pas EXACT est « en attente » : à journaliser pour enrichir D8.
 *
 * Le français simplifié sert de pivot pour la traduction ; il n'est pas affiché tel quel.
 * Module pur, sans dépendance à Node.
 */
import { classify, type SentenceAnalysis } from './classify';
import { type Corpus, type CorpusEntry, findTerms, matchWhole, type TermMatch } from './corpus';
import {
  CLAUSE_LINKERS, DETERMINERS, ELIDED, NEGATION_STANDALONE, OBJECT_CLITICS, PREPOSITIONS, QUESTION_WORDS,
  SUBJECT_CLITICS, SUBORDINATORS,
} from './french';
import type { Lexicon } from './lexicon';
import { normalize, type Token } from './normalize';

export type MatchKind = 'EXACT' | 'PARTIAL' | 'NONE';
export type CandidateSource = 'ORIGINAL' | 'SYNONYM' | 'DEFINITION' | 'SUBSTITUTION';

/** Trait de la phrase qu'une simplification doit conserver. */
export type Feature = 'QUESTION' | 'QUESTION:YES_NO' | 'QUESTION:WH' | 'IMPERATIVE' | 'NEGATION' | 'RESTRICTION' | 'TIME:PAST' | 'TIME:FUTURE';

export interface Candidate {
  text: string;
  source: CandidateSource;
  /** Entrées de D8 utilisées (vide pour l'original). */
  entryIds: string[];
  /** Traits de l'original absents de ce candidat (un synonyme ou une définition de D8 peut en perdre). */
  lost: Feature[];
}

export interface TermNote {
  entryId: string;
  /** Texte de l'entrée de D8 (« Débiter »). */
  term: string;
  /** Mots du texte reçu (« débité »). */
  surface: string;
  by: TermMatch['by'];
  synonyms: readonly string[];
  definition: string | null;
}

export interface SimplifiedUnit {
  /** Texte de l'unité : tout le texte reçu (EXACT global) ou une phrase. */
  text: string;
  sentences: SentenceAnalysis[];
  match: MatchKind;
  /** Entrée de D8 correspondant à toute l'unité (EXACT). */
  entryId: string | null;
  /** Valeurs des variables de l'entrée (EXACT sur une entrée à variables). */
  values: Record<string, string>;
  /** Candidats, l'original d'abord. */
  candidates: Candidate[];
  /** Termes de D8 reconnus dans l'unité (PARTIAL). */
  terms: TermNote[];
  /** Variantes écartées parce qu'elles perdaient un trait. */
  rejected: Candidate[];
  /** Mots pleins qui ne sont couverts par aucun terme de D8 (PARTIAL, NONE). */
  uncovered: string[];
  /** Faux si l'unité ne contient aucun mot à traduire (valeurs protégées, ponctuation). */
  translatable: boolean;
}

export interface Simplification {
  units: SimplifiedUnit[];
  /** Unités traduisibles absentes de D8, à journaliser pour enrichir le corpus (M4). */
  pending: string[];
}

export interface SimplifyOptions {
  guards?: readonly string[];
  lexicon?: Lexicon;
  /** Nombre maximal de variantes par substitution (3 par défaut). */
  maxVariants?: number;
}

/** Traits d'une analyse qu'une simplification doit conserver. */
export function featuresOf(sentences: readonly SentenceAnalysis[]): Set<Feature> {
  const out = new Set<Feature>();
  for (const s of sentences) {
    if (s.question) {
      out.add('QUESTION');
      out.add(`QUESTION:${s.question.kind}`);
    }
    if (s.type === 'IMPERATIVE') out.add('IMPERATIVE');
    if (s.negation.length > 0) out.add('NEGATION');
    if (s.restriction) out.add('RESTRICTION');
    for (const v of s.finiteVerbs) {
      if (v.features?.time === 'PAST') out.add('TIME:PAST');
      if (v.features?.time === 'FUTURE') out.add('TIME:FUTURE');
    }
  }
  return out;
}

const lostBetween = (original: Set<Feature>, candidate: Set<Feature>): Feature[] => [...original].filter((f) => !candidate.has(f));

/** Remplace les variables `{nom}` par leurs valeurs ; une variable vide disparaît avec son espace. */
export function fillVariables(text: string, values: ReadonlyMap<string, string>): string {
  return text
    .replace(/\{[^{}\n]*\}/gu, (v) => values.get(v) ?? v)
    .replace(/ {2,}/gu, ' ')
    .replace(/ ([,.;:!?])/gu, (m, p: string) => ([';', ':', '!', '?'].includes(p) ? m : p))
    .trim();
}

const FUNCTION_WORDS = new Set([
  ...SUBJECT_CLITICS, ...OBJECT_CLITICS, ...DETERMINERS, ...PREPOSITIONS, ...SUBORDINATORS, ...CLAUSE_LINKERS,
  ...NEGATION_STANDALONE, ...QUESTION_WORDS, ...ELIDED, 'ne', 'n\'', 'et', 'ou', 'mais', 'puis', 'donc', 'ni', 'car', 'ce', 'ça', 'cela',
]);

function isContentWord(token: Token, previous: Token | undefined, lexicon?: Lexicon): boolean {
  if (token.kind !== 'word' || FUNCTION_WORDS.has(token.key)) return false;
  if (!lexicon) return true;
  const readings = lexicon.lookup(token.key);
  if (readings.length === 0) return true;
  // « a », « est » : auxiliaires, sauf après un déterminant (« votre avoir »).
  const afterDeterminer = previous?.kind === 'word' && DETERMINERS.has(previous.key);
  if (readings.some((r) => r.pos === 'AUX') && !afterDeterminer) return false;
  return readings.some((r) => ['NOUN', 'PROPN', 'ADJ', 'VERB', 'ADV'].includes(r.pos));
}

/* ------------------------------------------------------------------ substitution */

const SKIPPED_BEFORE_VERB = new Set(['ne', 'pas', 'se', 's\'', 'n\'']);

/** Catégories possibles d'un terme ou d'un synonyme : infinitif (INF) et/ou autre (NOM). */
function categories(text: string, guards: readonly string[], lexicon: Lexicon): Set<'INF' | 'NOM'> {
  const words = normalize(text, { guards }).tokens.filter((t) => t.kind === 'word' && !SKIPPED_BEFORE_VERB.has(t.key));
  const first = words[0];
  const out = new Set<'INF' | 'NOM'>();
  if (!first) return out.add('NOM');
  const readings = lexicon.lookup(first.key);
  if (readings.some((r) => r.mood === 'INFINITIVE')) out.add('INF');
  if (readings.length === 0 || readings.some((r) => r.mood !== 'INFINITIVE')) out.add('NOM');
  return out;
}

function startsWithDeterminer(text: string, guards: readonly string[]): boolean {
  const first = normalize(text, { guards }).tokens[0];
  return first !== undefined && first.kind === 'word' && DETERMINERS.has(first.key);
}

/** Synonymes d'un terme utilisables à cet endroit de la phrase. */
function eligibleSynonyms(match: TermMatch, tokens: readonly Token[], guards: readonly string[], lexicon: Lexicon): string[] {
  if (match.by !== 'FORM') return [];
  const termCats = categories(match.entry.text, guards, lexicon);
  const before = tokens[match.start - 1];
  const afterDeterminer = before !== undefined && before.kind === 'word' && DETERMINERS.has(before.key);
  return match.entry.synonyms.filter((s) => {
    if (/\{[^{}\n]*\}/u.test(s)) return false;
    if (afterDeterminer && startsWithDeterminer(s, guards)) return false;
    const cats = categories(s, guards, lexicon);
    return [...cats].some((c) => termCats.has(c));
  });
}

/** Adapte la casse du début d'un synonyme à sa place dans la phrase. */
function caseFor(synonym: string, atStart: boolean, original: string): string {
  const first = synonym.charAt(0);
  const upper = original.charAt(0) === original.charAt(0).toLocaleUpperCase('fr') && original.charAt(0) !== original.charAt(0).toLocaleLowerCase('fr');
  if (atStart && upper) return first.toLocaleUpperCase('fr') + synonym.slice(1);
  if (!atStart) return first.toLocaleLowerCase('fr') + synonym.slice(1);
  return synonym;
}

function substitute(sentence: SentenceAnalysis, choices: readonly { match: TermMatch; synonym: string }[]): string {
  const { tokens, text } = sentence;
  const offset = (tokens[0] as Token).start;
  let out = '';
  let cursor = 0;
  for (const { match, synonym } of choices) {
    const a = (tokens[match.start] as Token).start - offset;
    const b = (tokens[match.end - 1] as Token).end - offset;
    let before = text.slice(cursor, a);
    const replaced = caseFor(synonym, a === 0, text.slice(a, b));
    // Élision devant une voyelle : « le » + « argent » → « l'argent » (h exclu : muet ou aspiré, D8 ne le dit pas).
    if (/^[aeiouyàâéèêëîïôûù]/iu.test(replaced)) before = before.replace(/(^|[\s'’])(l)[ea] $|(^|[\s'’])(d)e $/iu, (_m, p1: string | undefined, l: string | undefined, p3: string | undefined, d: string | undefined) => `${p1 ?? p3 ?? ''}${l ?? d ?? ''}'`);
    out += before + replaced;
    cursor = b;
  }
  return out + text.slice(cursor);
}

/* ------------------------------------------------------------------ unités */

function note(match: TermMatch, sentence: SentenceAnalysis): TermNote {
  const offset = (sentence.tokens[0] as Token).start;
  const a = (sentence.tokens[match.start] as Token).start - offset;
  const b = (sentence.tokens[match.end - 1] as Token).end - offset;
  return {
    entryId: match.entry.id,
    term: match.entry.text,
    surface: sentence.text.slice(a, b),
    by: match.by,
    synonyms: match.entry.synonyms,
    definition: match.entry.definition,
  };
}

/** Phrases d'une définition de D8 (3 au plus) : chacune est un candidat de traduction à part. */
export function definitionSentences(definition: string, options: SimplifyOptions = {}): string[] {
  const sentences = classify(definition, options).sentences.filter((s) => s.form !== null).map((s) => s.text);
  return (sentences.length > 0 ? sentences : [definition]).slice(0, MAX_DEFINITION_SENTENCES);
}

const MAX_DEFINITION_SENTENCES = 3;

function exactUnit(text: string, sentences: SentenceAnalysis[], entry: CorpusEntry, values: ReadonlyMap<string, string>, options: SimplifyOptions): SimplifiedUnit {
  const original = featuresOf(sentences);
  const candidate = (t: string, source: CandidateSource): Candidate => ({
    text: t,
    source,
    entryIds: source === 'ORIGINAL' ? [] : [entry.id],
    lost: source === 'ORIGINAL' ? [] : lostBetween(original, featuresOf(classify(t, options).sentences)),
  });
  const seen = new Set<string>([text]);
  const candidates = [candidate(text, 'ORIGINAL')];
  for (const synonym of entry.synonyms) {
    const filled = fillVariables(synonym, values);
    if (seen.has(filled)) continue;
    seen.add(filled);
    candidates.push(candidate(filled, 'SYNONYM'));
  }
  if (entry.definition !== null) {
    // Mission §3.5 : la définition simple est essayée phrase par phrase (3 au plus), dans l'ordre de D8.
    for (const sentence of definitionSentences(fillVariables(entry.definition, values), options)) {
      if (seen.has(sentence)) continue;
      seen.add(sentence);
      candidates.push(candidate(sentence, 'DEFINITION'));
    }
  }
  return {
    text,
    sentences,
    match: 'EXACT',
    entryId: entry.id,
    values: Object.fromEntries(values),
    candidates,
    terms: [],
    rejected: [],
    uncovered: [],
    translatable: true,
  };
}

function sentenceUnit(sentence: SentenceAnalysis, corpus: Corpus, options: SimplifyOptions): SimplifiedUnit {
  const translatable = sentence.form !== null;
  const whole = translatable ? matchWhole(corpus, sentence.tokens, sentence.text) : null;
  if (whole) return exactUnit(sentence.text, [sentence], whole.entry, whole.values, options);

  const matches = translatable ? findTerms(corpus, sentence.tokens, options.lexicon) : [];
  const covered = new Set(matches.flatMap((m) => Array.from({ length: m.end - m.start }, (_, k) => m.start + k)));
  const uncovered = sentence.tokens.filter((t, i) => !covered.has(i) && isContentWord(t, sentence.tokens[i - 1], options.lexicon)).map((t) => t.text);
  const candidates: Candidate[] = [{ text: sentence.text, source: 'ORIGINAL', entryIds: [], lost: [] }];
  const rejected: Candidate[] = [];

  const { lexicon } = options;
  if (lexicon && matches.length > 0) {
    const guards = options.guards ?? [];
    const original = featuresOf([sentence]);
    const slots = matches.map((m) => ({ match: m, synonyms: eligibleSynonyms(m, sentence.tokens, guards, lexicon) }));
    const usable = slots.filter((o) => o.synonyms.length > 0);
    const count = Math.min(options.maxVariants ?? 3, Math.max(0, ...usable.map((o) => o.synonyms.length)));
    const seen = new Set<string>([sentence.text]);
    for (let k = 0; k < count; k++) {
      const choices = usable.map((o) => ({ match: o.match, synonym: o.synonyms[Math.min(k, o.synonyms.length - 1)] as string }));
      const text = substitute(sentence, choices);
      if (seen.has(text)) continue;
      seen.add(text);
      const lost = lostBetween(original, featuresOf(classify(text, options).sentences));
      const variant: Candidate = { text, source: 'SUBSTITUTION', entryIds: choices.map((c) => c.match.entry.id), lost };
      (lost.length === 0 ? candidates : rejected).push(variant);
    }
  }

  return {
    text: sentence.text,
    sentences: [sentence],
    match: matches.length > 0 ? 'PARTIAL' : 'NONE',
    entryId: null,
    values: {},
    candidates,
    terms: matches.map((m) => note(m, sentence)),
    rejected,
    uncovered,
    translatable,
  };
}

/**
 * Simplifie un texte reçu avec D8. Le texte entier est d'abord comparé à D8 ; sinon chaque phrase
 * l'est séparément. Pur et déterministe.
 */
export function simplify(input: string, corpus: Corpus, options: SimplifyOptions = {}): Simplification {
  const analysis = classify(input, options);
  const { text, tokens } = analysis.normalized;
  const whole = analysis.translatable ? matchWhole(corpus, tokens, text) : null;
  const units = whole
    ? [exactUnit(text, analysis.sentences, whole.entry, whole.values, options)]
    : analysis.sentences.map((s) => sentenceUnit(s, corpus, options));
  return { units, pending: units.filter((u) => u.translatable && u.match !== 'EXACT').map((u) => u.text) };
}
