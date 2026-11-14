/**
 * Classification des textes reçus (moteur, PR 1).
 *
 * Le texte est d'abord découpé en phrases. Chaque phrase reçoit ensuite :
 * - une forme : WORD, EXPRESSION, SIMPLE_SENTENCE ou COMPLEX_SENTENCE. Une phrase complexe compte
 *   au moins deux verbes conjugués, ou un seul verbe conjugué accompagné d'un mot subordonnant ;
 * - un type : QUESTION, IMPERATIVE ou STATEMENT. Le type vaut null pour un mot ou une expression sans
 *   verbe qui n'est pas une question ;
 * - les traits à conserver jusqu'à la traduction : négation, restriction (« ne … que »), type de
 *   question (oui/non ou partielle) et exclamation.
 *
 * Seuls des indices de grammaire française sont utilisés : mots grammaticaux, auxiliaires,
 * pronoms sujets, impératifs en « -ez » et pronoms liés par un trait d'union. Un verbe lexical sans
 * aucun de ces indices (« Le montant saisi dépasse votre solde. ») n'est pas encore reconnu : ce sera
 * le rôle du lemmatiseur (PR 2). Dans le doute, la négation est signalée, car l'oublier inverserait
 * le sens de la phrase.
 *
 * Module pur, sans dépendance à Node.
 */
import {
  CLAUSE_LINKERS, CLAUSE_PUNCTUATION, DETERMINERS, ENCLITIC_OBJECTS, FINITE_AUXILIARIES,
  NEGATION_AFTER_NE, NEGATION_STANDALONE, NOT_VERBS_EZ, NOUS_IRREGULAR, OBJECT_CLITICS, PREPOSITIONS,
  QUESTION_WORDS, QUESTION_WORDS_IN_SITU, SUBJECT_CLITICS, SUBORDINATORS, VOUS_IRREGULAR,
} from './french';
import { normalize, type NormalizeOptions, type NormalizedText, type Token } from './normalize';

export type TextForm = 'WORD' | 'EXPRESSION' | 'SIMPLE_SENTENCE' | 'COMPLEX_SENTENCE';
export type SentenceType = 'QUESTION' | 'IMPERATIVE' | 'STATEMENT';
export type QuestionKind = 'YES_NO' | 'WH';

export interface FiniteVerb {
  /** Indice du jeton dans `SentenceAnalysis.tokens`. */
  index: number;
  key: string;
  imperative: boolean;
}

export interface SentenceAnalysis {
  /** Texte de la phrase (extrait du texte normalisé). */
  text: string;
  tokens: Token[];
  /** null : aucun mot à traduire (valeurs protégées ou ponctuation seulement). */
  form: TextForm | null;
  type: SentenceType | null;
  /** Présent seulement pour une question. `markers` : mots interrogatifs trouvés. */
  question: { kind: QuestionKind; markers: string[] } | null;
  /** Marqueurs de négation, dans l'ordre du texte ([] si la phrase n'est pas négative). */
  negation: string[];
  /** « ne … que » : ce n'est pas une négation (« seulement »), mais ce sens ne doit pas être perdu. */
  restriction: boolean;
  exclamative: boolean;
  finiteVerbs: FiniteVerb[];
  subordinators: string[];
}

export interface TextAnalysis {
  normalized: NormalizedText;
  sentences: SentenceAnalysis[];
  /** Faux si aucune phrase ne contient de mot à traduire. */
  translatable: boolean;
}

export type ClassifyOptions = NormalizeOptions;

const isWord = (t: Token | undefined, keys?: ReadonlySet<string>): boolean =>
  t !== undefined && t.kind === 'word' && (keys === undefined || keys.has(t.key));
const NE: ReadonlySet<string> = new Set(['ne', "n'"]);
const isNe = (t: Token | undefined): boolean => isWord(t, NE);
const SENTENCE_END = /^(?:[.!?…]+|\.{3})$/u;

/** Découpe les jetons en phrases : après . ! ? … suivis d'un autre jeton, et à chaque saut de ligne. */
function splitSentences(n: NormalizedText): Token[][] {
  const sentences: Token[][] = [];
  let current: Token[] = [];
  n.tokens.forEach((t, i) => {
    const prev = n.tokens[i - 1];
    if (prev && current.length > 0 && n.text.slice(prev.end, t.start).includes('\n')) {
      sentences.push(current);
      current = [];
    }
    current.push(t);
    const next = n.tokens[i + 1];
    if (t.kind === 'punct' && SENTENCE_END.test(t.text) && next && !(next.kind === 'punct' && SENTENCE_END.test(next.text))) {
      sentences.push(current);
      current = [];
    }
  });
  if (current.length > 0) sentences.push(current);
  return sentences;
}

/** Indice du prochain mot après i, en sautant « ne » et les pronoms compléments. */
function nextVerbSlot(tokens: Token[], i: number): number {
  let j = i + 1;
  while (isNe(tokens[j]) || (isWord(tokens[j], OBJECT_CLITICS) && !tokens[j]?.enclitic)) j++;
  return isWord(tokens[j]) && !tokens[j]?.enclitic ? j : -1;
}

/** Vrai si le jeton i commence une proposition (« ne » initial ignoré). */
function atClauseStart(tokens: Token[], i: number): boolean {
  let j = i - 1;
  while (isNe(tokens[j])) j--;
  const prev = tokens[j];
  if (prev === undefined) return true;
  if (prev.kind === 'punct') return CLAUSE_PUNCTUATION.has(prev.key);
  return isWord(prev, CLAUSE_LINKERS);
}

function findFiniteVerbs(tokens: Token[]): FiniteVerb[] {
  const found = new Map<number, boolean>();
  const add = (index: number, imperative: boolean): void => {
    if (index >= 0) found.set(index, (found.get(index) ?? false) || imperative);
  };
  tokens.forEach((t, i) => {
    if (t.kind !== 'word' || t.enclitic) return;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    // Auxiliaire ou modal conjugué, sauf après un déterminant (« l'est », « les sommes »).
    if (FINITE_AUXILIARIES.has(t.key) && !isWord(prev, DETERMINERS)) add(i, false);
    // Pronom sujet : le verbe suit, après « ne » et les pronoms compléments.
    if (SUBJECT_CLITICS.has(t.key)) add(nextVerbSlot(tokens, i), false);
    // « nous » / « vous » sujets seulement si le verbe s'accorde (-ons / -ez).
    if (t.key === 'nous' || t.key === 'vous') {
      const j = nextVerbSlot(tokens, i);
      const v = tokens[j]?.key ?? '';
      const agrees = t.key === 'nous' ? v.endsWith('ons') || NOUS_IRREGULAR.has(v) : v.endsWith('ez') || VOUS_IRREGULAR.has(v);
      if (j >= 0 && agrees) add(j, false);
    }
    // Relatif « qui » (pas en tête de phrase) : le verbe suit.
    if (t.key === 'qui' && i > 0) {
      const j = nextVerbSlot(tokens, i);
      if (j >= 0 && !isWord(tokens[j], DETERMINERS) && !isWord(tokens[j], PREPOSITIONS)) add(j, false);
    }
    // Verbe suivi d'un pronom lié (« Connectez-vous », « Voulez-vous », « est-ce », « a-t-il »).
    if (next?.enclitic) add(i, ENCLITIC_OBJECTS.has(next.key) && atClauseStart(tokens, i));
    // Impératif en « -ez » en tête de proposition (« Vérifiez… », « …, contactez-nous »).
    if (t.key.endsWith('ez') && !NOT_VERBS_EZ.has(t.key) && atClauseStart(tokens, i)) add(i, true);
  });
  return [...found.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, imperative]) => ({ index, key: (tokens[index] as Token).key, imperative }));
}

function findNegation(tokens: Token[]): { negation: string[]; restriction: boolean; restrictiveQue: Set<number> } {
  const marked = new Set<number>();
  const restrictiveQue = new Set<number>();
  tokens.forEach((t, i) => {
    if (!isNe(t)) return;
    for (let j = i + 1; j < tokens.length; j++) {
      const u = tokens[j] as Token;
      if (isWord(u, NEGATION_AFTER_NE)) {
        marked.add(i).add(j);
        return;
      }
      if (u.key === 'que' || u.key === "qu'") {
        restrictiveQue.add(j);
        return;
      }
    }
    marked.add(i); // « ne » seul (registre soutenu) : traité comme une négation, par prudence.
  });
  tokens.forEach((t, i) => {
    if (isWord(t, NEGATION_STANDALONE)) marked.add(i);
  });
  return {
    negation: [...marked].sort((a, b) => a - b).map((i) => (tokens[i] as Token).key),
    restriction: restrictiveQue.size > 0,
    restrictiveQue,
  };
}

function findQuestion(tokens: Token[]): SentenceAnalysis['question'] {
  const words = tokens.filter((t) => t.kind === 'word');
  const lastPunct = [...tokens].reverse().find((t) => t.kind === 'punct');
  const [w0, w1, w2] = words;
  const estCeQue = w0?.key === 'est' && w1?.key === 'ce' && w1.enclitic === true && (w2?.key === 'que' || w2?.key === "qu'");
  const quEstCe = (w0?.key === "qu'" || w0?.key === 'que') && w1?.key === 'est' && w2?.key === 'ce';
  // Inversion du sujet (« Peut-il… », « a-t-elle ») ; « -vous » / « -nous » peuvent aussi marquer un impératif.
  const inversion = words.some((t) => t.enclitic && t.key !== 'vous' && t.key !== 'nous' && t.key !== 'ce'
    && !ENCLITIC_OBJECTS.has(t.key));
  const isQuestion = (lastPunct?.text.includes('?') ?? false) || estCeQue || quEstCe || inversion;
  if (!isQuestion) return null;

  const markers: string[] = [];
  let i = 0;
  while (isWord(words[i], PREPOSITIONS)) i++;
  const first = words[i];
  if (first && QUESTION_WORDS.has(first.key) && !(estCeQue && i === 0)) markers.push(first.key);
  words.forEach((t, j) => {
    if (j !== i && QUESTION_WORDS_IN_SITU.has(t.key)) markers.push(t.key);
  });
  return { kind: markers.length > 0 ? 'WH' : 'YES_NO', markers };
}

/** Indices de « est » et de « que » dans chaque « est-ce que » / « est-ce qu' ». */
function estCeQue(tokens: Token[]): Set<number> {
  const found = new Set<number>();
  tokens.forEach((t, i) => {
    const ce = tokens[i + 1];
    const que = tokens[i + 2];
    if (t.key === 'est' && ce?.key === 'ce' && ce.enclitic && (que?.key === 'que' || que?.key === "qu'")) found.add(i).add(i + 2);
  });
  return found;
}

function findSubordinators(tokens: Token[], ignored: Set<number>): string[] {
  const words = tokens.map((t, i) => [t, i] as const).filter(([t]) => t.kind === 'word');
  const firstWord = words[0]?.[1];
  return words
    .filter(([t, i]) => {
      if (ignored.has(i)) return false;
      if (t.key === 'si' || t.key === "s'") return SUBJECT_CLITICS.has(tokens[i + 1]?.key ?? '') || tokens[i + 1]?.key === 'vous' || tokens[i + 1]?.key === 'nous';
      return SUBORDINATORS.has(t.key) && i !== firstWord;
    })
    .map(([t]) => t.key);
}

export function analyzeSentence(tokens: Token[], text: string): SentenceAnalysis {
  const words = tokens.filter((t) => t.kind === 'word');
  const question = findQuestion(tokens);
  const { negation, restriction, restrictiveQue } = findNegation(tokens);

  // « est-ce que » est une particule interrogative : ni verbe conjugué ni subordonnant.
  // Dans une question, les mots interrogatifs ne sont pas non plus des subordonnants.
  const particle = estCeQue(tokens);
  const ignored = new Set([...restrictiveQue, ...particle]);
  if (question) {
    tokens.forEach((t, i) => {
      if (t.kind === 'word' && question.markers.includes(t.key)) ignored.add(i);
    });
  }
  const subordinators = findSubordinators(tokens, ignored);
  const finiteVerbs = findFiniteVerbs(tokens)
    .filter((v) => !particle.has(v.index))
    .map((v) => (question ? { ...v, imperative: false } : v));

  let form: TextForm | null;
  if (words.length === 0) form = null;
  else if (finiteVerbs.length >= 2 || (finiteVerbs.length === 1 && subordinators.length > 0)) form = 'COMPLEX_SENTENCE';
  else if (finiteVerbs.length === 1) form = 'SIMPLE_SENTENCE';
  else form = tokens.filter((t) => t.kind !== 'punct').length === 1 ? 'WORD' : 'EXPRESSION';

  const type: SentenceType | null = question ? 'QUESTION'
    : finiteVerbs.some((v) => v.imperative) ? 'IMPERATIVE'
    : form === 'SIMPLE_SENTENCE' || form === 'COMPLEX_SENTENCE' ? 'STATEMENT'
    : null;

  const lastPunct = [...tokens].reverse().find((t) => t.kind === 'punct');
  return {
    text,
    tokens,
    form,
    type,
    question,
    negation,
    restriction,
    exclamative: lastPunct?.text.includes('!') ?? false,
    finiteVerbs,
    subordinators,
  };
}

/** Normalise, découpe en phrases et classe un texte. Pur et déterministe. */
export function classify(input: string, options: ClassifyOptions = {}): TextAnalysis {
  const normalized = normalize(input, options);
  const sentences = splitSentences(normalized).map((tokens) => {
    const first = tokens[0] as Token;
    const last = tokens[tokens.length - 1] as Token;
    return analyzeSentence(tokens, normalized.text.slice(first.start, last.end));
  });
  return { normalized, sentences, translatable: sentences.some((s) => s.form !== null) };
}
