/**
 * Analyse grammaticale d'un texte français (mission §3.3), avant son entrée dans D8.
 *
 * Pour chaque phrase : classe, type, mode, temps et moment, voix, dérivation verbale (passif,
 * causatif, pronominal), négation, sujet et accord du sujet, ordre des mots, possessifs, et le sens
 * (acte de langage, polarité, moment, possessions). Pour chaque mot : lemme, catégorie, genre et
 * nombre (Lefff). Ces métadonnées sont gardées dans l'entrée du corpus : la traduction doit
 * conserver le type de la phrase (une question reste une question), la négation et les possessifs.
 *
 * L'analyse s'appuie sur la classification du moteur (`classify`, `describeVerb`) : il n'y a qu'un
 * seul analyseur du français dans le projet. Elle décrit le texte français et ne choisit aucune forme
 * éton. Sans lexique, seuls les mots grammaticaux connus (pronoms, possessifs, négation) sont décrits.
 *
 * Les noms des champs sont en français : ce sont ceux des entrées enrichies de D8 (mission §3.4).
 * Module pur, sans dépendance à Node.
 */
import { classify, negationIndices, type SentenceAnalysis } from './classify';
import { DETERMINERS, OBJECT_CLITICS, REFLEXIVE_CLITICS } from './french';
import { isVerbal, type Lexicon, type Pos, type Reading } from './lexicon';
import type { Token } from './normalize';
import type { VerbFeatures } from './verbs';

/** Classe d'un texte de la page (mission §3.1) ; `paragraphe` : plusieurs phrases. */
export const CLASSES_TEXTE = ['mot', 'phrase_affirmation', 'phrase_interrogation', 'exclamation', 'imperatif', 'paragraphe'] as const;
export type ClasseTexte = (typeof CLASSES_TEXTE)[number];
export type ClassePhrase = Exclude<ClasseTexte, 'paragraphe'>;

export type Personne = 1 | 2 | 3;
export type Nombre = 'singulier' | 'pluriel';
export type Genre = 'masculin' | 'feminin';
export type Mode = 'indicatif' | 'imperatif' | 'subjonctif' | 'conditionnel';
export type Moment = 'present' | 'passe' | 'futur';
export type Acte = 'informer' | 'demander' | 'ordonner' | 's_exclamer' | 'nommer';
export type Categorie =
  | 'nom' | 'nom_propre' | 'verbe' | 'auxiliaire' | 'adjectif' | 'adverbe' | 'determinant' | 'pronom'
  | 'preposition' | 'conjonction' | 'autre' | 'valeur_protegee' | 'inconnu';

export interface AnalyseMot {
  forme: string;
  lemme: string | null;
  categorie: Categorie;
  /** null : inconnu ou ambigu (« frais » : singulier ou pluriel). */
  genre: Genre | null;
  nombre: Nombre | null;
}

export interface Possessif {
  mot: string;
  /** Qui possède : « votre » → 2e personne du pluriel (le lecteur, vouvoyé). */
  possesseur: { personne: Personne; nombre: Nombre; pronom: string };
  /** Ce qui est possédé : nombre donné par le possessif (« vos » : pluriel), genre par « ma, ta, sa » ou par le nom. */
  possede: { nom: string | null; nombre: Nombre; genre: Genre | null };
}

export interface Sujet {
  texte: string;
  nature: 'pronom' | 'nom' | 'implicite';
  personne: Personne | null;
  nombre: Nombre | null;
  genre: Genre | null;
  /** Le verbe s'accorde-t-il en personne et en nombre avec le sujet ? null : non vérifiable. */
  accord: boolean | null;
}

export interface AnalyseVerbe {
  forme: string;
  lemme: string;
  /** Verbe qui porte le sens dans une construction à auxiliaire (« envoyé » dans « a été envoyé »). */
  lemmePrincipal: string;
  mode: Mode | null;
  temps: string;
  moment: Moment;
  aspect: 'accompli' | 'inaccompli' | null;
  voix: 'active' | 'passive';
  derivation: 'causatif' | 'pronominal' | null;
  /** Vrai si Lefff laissait plusieurs lectures possibles. */
  ambigu: boolean;
}

export interface AnalysePhrase {
  texte: string;
  classe: ClassePhrase;
  forme: 'mot' | 'expression' | 'phrase_simple' | 'phrase_complexe';
  type: 'affirmation' | 'interrogation' | 'imperatif' | 'exclamation' | null;
  /** Question totale (oui/non) ou partielle (mot interrogatif). */
  question: { nature: 'totale' | 'partielle'; marqueurs: string[] } | null;
  /** Mode, temps et moment du premier verbe conjugué (null : pas de verbe conjugué). */
  mode: Mode | null;
  temps: string | null;
  moment: Moment | null;
  verbes: AnalyseVerbe[];
  sujet: Sujet | null;
  /** Ordre des constituants autour du premier verbe : « S V O », « V S » (inversion), « V O » (impératif)… */
  ordreMots: string | null;
  negation: { presente: boolean; marqueurs: string[]; restriction: boolean };
  derivations: ('passif' | 'causatif' | 'pronominal')[];
  possessifs: Possessif[];
  subordonnants: string[];
  mots: AnalyseMot[];
  sens: Sens;
}

/** Information que la phrase transmet au lecteur ; à conserver à la traduction. */
export interface Sens {
  acte: Acte;
  polarite: 'affirmative' | 'negative';
  moment: Moment | null;
  /** Le texte s'adresse-t-il au lecteur (2e personne, impératif ou possessif « votre ») ? */
  adresseAuLecteur: boolean;
  /** « votre solde » → { possesseur: 'vous', objet: 'solde' }. */
  possessions: { possesseur: string; objet: string | null }[];
  /** Résumé lisible des points ci-dessus. */
  resume: string;
}

export interface AnalyseGrammaticale {
  texte: string;
  classe: ClasseTexte;
  phrases: AnalysePhrase[];
  /** Vrai si une phrase porte une négation. */
  negation: boolean;
  /** Description du mot ou du groupe de mots (classe `mot`) : catégorie, genre et nombre du mot principal. */
  mot: AnalyseMot | null;
}

export interface AnalysisOptions {
  lexicon?: Lexicon;
  guards?: readonly string[];
}

const POSSESSIVES: Readonly<Record<string, readonly [Personne, Nombre, Nombre, Genre | null]>> = {
  mon: [1, 'singulier', 'singulier', null], ma: [1, 'singulier', 'singulier', 'feminin'], mes: [1, 'singulier', 'pluriel', null],
  ton: [2, 'singulier', 'singulier', null], ta: [2, 'singulier', 'singulier', 'feminin'], tes: [2, 'singulier', 'pluriel', null],
  son: [3, 'singulier', 'singulier', null], sa: [3, 'singulier', 'singulier', 'feminin'], ses: [3, 'singulier', 'pluriel', null],
  notre: [1, 'pluriel', 'singulier', null], nos: [1, 'pluriel', 'pluriel', null],
  votre: [2, 'pluriel', 'singulier', null], vos: [2, 'pluriel', 'pluriel', null],
  leur: [3, 'pluriel', 'singulier', null], leurs: [3, 'pluriel', 'pluriel', null],
};
const PRONOUNS: Readonly<Record<string, readonly [Personne, Nombre, Genre | null]>> = {
  je: [1, 'singulier', null], "j'": [1, 'singulier', null], tu: [2, 'singulier', null], il: [3, 'singulier', 'masculin'],
  elle: [3, 'singulier', 'feminin'], on: [3, 'singulier', null], nous: [1, 'pluriel', null], vous: [2, 'pluriel', null],
  ils: [3, 'pluriel', 'masculin'], elles: [3, 'pluriel', 'feminin'],
};
const PERSON_LABEL: Readonly<Record<string, string>> = {
  '1singulier': 'je', '2singulier': 'tu', '3singulier': 'il/elle', '1pluriel': 'nous', '2pluriel': 'vous', '3pluriel': 'ils/elles',
};
const CATEGORY: Readonly<Record<Pos, Categorie>> = {
  VERB: 'verbe', AUX: 'auxiliaire', NOUN: 'nom', PROPN: 'nom_propre', ADJ: 'adjectif', ADV: 'adverbe', DET: 'determinant',
  PRON: 'pronom', PREP: 'preposition', CONJ: 'conjonction', OTHER: 'autre',
};
const MOOD: Readonly<Record<string, Mode>> = { INDICATIVE: 'indicatif', IMPERATIVE: 'imperatif', SUBJUNCTIVE: 'subjonctif', CONDITIONAL: 'conditionnel' };
const MOMENT: Readonly<Record<string, Moment>> = { PRESENT: 'present', PAST: 'passe', FUTURE: 'futur' };
const NUMBER = (n: Reading['number']): Nombre | null => (n === 'SINGULAR' ? 'singulier' : n === 'PLURAL' ? 'pluriel' : null);
const GENDER = (g: Reading['gender']): Genre | null => (g === 'MASCULINE' ? 'masculin' : g === 'FEMININE' ? 'feminin' : null);
const NE: ReadonlySet<string> = new Set(['ne', "n'"]);

/** Classe d'une phrase (mission §3.1). Un groupe de mots sans verbe terminé par un point est une affirmation. */
export function sentenceClass(s: SentenceAnalysis): ClassePhrase {
  if (s.type === 'QUESTION' || /\?\s*$/u.test(s.text)) return 'phrase_interrogation';
  if (s.type === 'IMPERATIVE') return 'imperatif';
  if (s.exclamative) return 'exclamation';
  if (s.type === 'STATEMENT') return 'phrase_affirmation';
  const words = s.tokens.filter((t) => t.kind !== 'punct').length;
  return s.form === 'EXPRESSION' && words > 1 && /\.\s*$/u.test(s.text) ? 'phrase_affirmation' : 'mot';
}

/** Valeur unique d'un trait parmi des lectures, ou null si absente ou ambiguë. */
function unique<T>(values: readonly (T | null)[]): T | null {
  const set = new Set(values.filter((v): v is T => v !== null));
  return set.size === 1 ? ([...set][0] as T) : null;
}

/** Description d'un mot : lectures du lexique, en préférant la catégorie attendue à cette place. */
function describeWord(tokens: readonly Token[], i: number, lexicon: Lexicon | undefined, verbIndices: ReadonlySet<number>, negation: ReadonlySet<number>): AnalyseMot {
  const t = tokens[i] as Token;
  if (t.kind !== 'word') return { forme: t.text, lemme: null, categorie: 'valeur_protegee', genre: null, nombre: null };
  if (negation.has(i)) return { forme: t.text, lemme: t.key, categorie: 'adverbe', genre: null, nombre: null };
  if (t.key === 'de' || t.key === "d'") return { forme: t.text, lemme: 'de', categorie: 'preposition', genre: null, nombre: null };
  if (POSSESSIVES[t.key] && !(t.key === 'leur' && verbIndices.has(i + 1))) {
    const [, , n, g] = POSSESSIVES[t.key] as readonly [Personne, Nombre, Nombre, Genre | null];
    return { forme: t.text, lemme: t.key, categorie: 'determinant', genre: g, nombre: n };
  }
  const readings = lexicon?.lookup(t.key) ?? [];
  if (readings.length === 0) {
    const pronoun = PRONOUNS[t.key];
    if (pronoun) return { forme: t.text, lemme: t.key, categorie: 'pronom', genre: pronoun[2], nombre: pronoun[1] };
    return { forme: t.text, lemme: null, categorie: DETERMINERS.has(t.key) ? 'determinant' : 'inconnu', genre: null, nombre: null };
  }
  const afterDeterminer = i > 0 && DETERMINERS.has((tokens[i - 1] as Token).key);
  const beforeVerb = verbIndices.has(i + 1) || OBJECT_CLITICS.has(tokens[i + 1]?.key ?? '');
  const order: Pos[] = verbIndices.has(i) ? ['AUX', 'VERB']
    : DETERMINERS.has(t.key) ? (beforeVerb ? ['PRON', 'DET'] : ['DET', 'PRON'])
    : afterDeterminer ? ['NOUN', 'ADJ'] : ['NOUN', 'ADJ', 'VERB', 'AUX', 'PROPN'];
  const pos = order.find((p) => readings.some((r) => r.pos === p)) ?? (readings[0] as Reading).pos;
  const chosen = readings.filter((r) => r.pos === pos);
  return {
    forme: t.text,
    // « frais » : le lemme égal à la forme (« frais ») passe avant un autre lemme possible (« frai »).
    lemme: unique(chosen.map((r) => r.lemma)) ?? chosen.find((r) => r.lemma === t.key)?.lemma ?? (chosen[0] as Reading).lemma,
    categorie: CATEGORY[pos],
    genre: unique(chosen.map((r) => GENDER(r.gender))),
    nombre: unique(chosen.map((r) => NUMBER(r.number))),
  };
}

function tenseLabel(f: VerbFeatures): string {
  if (f.construction === 'NEAR_FUTURE') return 'futur_proche';
  if (f.construction === 'RECENT_PAST') return 'passe_recent';
  if (f.mood === 'SUBJUNCTIVE' || f.mood === 'CONDITIONAL' || f.mood === 'IMPERATIVE') return f.construction === 'COMPOUND' ? 'passe' : 'present';
  const compound: Readonly<Record<string, string>> = { PRESENT: 'passe_compose', IMPERFECT: 'plus_que_parfait', FUTURE: 'futur_anterieur', SIMPLE_PAST: 'passe_anterieur' };
  const simple: Readonly<Record<string, string>> = { PRESENT: 'present', IMPERFECT: 'imparfait', FUTURE: 'futur_simple', SIMPLE_PAST: 'passe_simple' };
  return (f.construction === 'COMPOUND' ? compound : simple)[f.tense ?? 'PRESENT'] ?? 'present';
}

function describeVerbFeatures(token: Token, f: VerbFeatures, imperative: boolean): AnalyseVerbe {
  return {
    forme: token.text,
    lemme: f.lemma,
    lemmePrincipal: f.main?.lemma ?? f.lemma,
    mode: imperative ? 'imperatif' : MOOD[f.mood] ?? null,
    temps: tenseLabel(f),
    moment: MOMENT[f.time] ?? 'present',
    aspect: f.aspect === 'PERFECTIVE' ? 'accompli' : f.aspect === 'IMPERFECTIVE' ? 'inaccompli' : null,
    voix: f.passive ? 'passive' : 'active',
    derivation: f.derivation === 'CAUSATIVE' ? 'causatif' : f.derivation === 'PRONOMINAL' ? 'pronominal' : null,
    ambigu: f.ambiguous,
  };
}

/** Le verbe tokens[i] peut-il avoir ce sujet (personne et nombre) ? null : lexique muet. */
function agrees(token: Token, lexicon: Lexicon | undefined, personne: Personne | null, nombre: Nombre | null): boolean | null {
  if (!lexicon || personne === null) return null;
  const finite = lexicon.lookup(token.key).filter((r) => isVerbal(r) && r.persons.length > 0);
  if (finite.length === 0) return null;
  return finite.some((r) => r.persons.includes(personne) && (nombre === null || r.number === null || NUMBER(r.number) === nombre));
}

/** Sujet du verbe tokens[v] : pronom avant ou inversé, groupe nominal en tête, ou sujet implicite de l'impératif. */
function findSubject(tokens: readonly Token[], v: number, imperative: boolean, mots: readonly AnalyseMot[], lexicon: Lexicon | undefined): { sujet: Sujet | null; inverted: boolean } {
  const verb = tokens[v] as Token;
  if (imperative) {
    const readings = (lexicon?.lookup(verb.key) ?? []).filter((r) => r.mood === 'IMPERATIVE');
    const personne = unique(readings.flatMap((r) => r.persons)) ?? (/ons$/u.test(verb.key) ? 1 : 2);
    const nombre = unique(readings.map((r) => NUMBER(r.number))) ?? (/(?:ez|ons)$/u.test(verb.key) ? 'pluriel' : 'singulier');
    return { sujet: { texte: '', nature: 'implicite', personne, nombre, genre: null, accord: true }, inverted: false };
  }
  const after = tokens[v + 1];
  if (after?.enclitic && PRONOUNS[after.key]) {
    const [personne, nombre, genre] = PRONOUNS[after.key] as readonly [Personne, Nombre, Genre | null];
    return { sujet: { texte: after.text, nature: 'pronom', personne, nombre, genre, accord: agrees(verb, lexicon, personne, nombre) }, inverted: true };
  }
  let j = v - 1;
  let candidate: number | null = null;
  for (; j >= 0; j--) {
    const t = tokens[j] as Token;
    if (t.kind !== 'word') break;
    if (NE.has(t.key)) continue;
    if ((t.key === 'nous' || t.key === 'vous') && candidate === null) {
      candidate = j;
      continue;
    }
    if (OBJECT_CLITICS.has(t.key) || REFLEXIVE_CLITICS.has(t.key)) continue;
    if (PRONOUNS[t.key]) candidate = j;
    break;
  }
  if (candidate !== null) {
    const t = tokens[candidate] as Token;
    const [personne, nombre, genre] = PRONOUNS[t.key] as readonly [Personne, Nombre, Genre | null];
    return { sujet: { texte: t.text, nature: 'pronom', personne, nombre, genre, accord: agrees(verb, lexicon, personne, nombre) }, inverted: false };
  }
  // Groupe nominal en tête de phrase, jusqu'au verbe (sans la négation ni les pronoms compléments).
  let end = v;
  while (end > 0 && (NE.has((tokens[end - 1] as Token).key) || OBJECT_CLITICS.has((tokens[end - 1] as Token).key))) end--;
  const span = tokens.slice(0, end).filter((t) => t.kind !== 'punct');
  const head = mots.slice(0, end).find((m) => m.categorie === 'nom' || m.categorie === 'nom_propre' || m.categorie === 'valeur_protegee');
  if (span.length === 0 || !head) return { sujet: null, inverted: false };
  const determiner = mots.slice(0, end).find((m) => m.categorie === 'determinant');
  const nombre = head.nombre ?? determiner?.nombre ?? null;
  return {
    sujet: { texte: span.map((t) => t.text).join(' ').replace(/' /gu, "'"), nature: 'nom', personne: 3, nombre, genre: head.genre ?? determiner?.genre ?? null, accord: agrees(verb, lexicon, 3, nombre) },
    inverted: false,
  };
}

function possessivesOf(tokens: readonly Token[], mots: readonly AnalyseMot[], verbIndices: ReadonlySet<number>): Possessif[] {
  const out: Possessif[] = [];
  tokens.forEach((t, i) => {
    const p = POSSESSIVES[t.key];
    if (t.kind !== 'word' || !p || (t.key === 'leur' && verbIndices.has(i + 1))) return;
    let k = i + 1;
    while (mots[k]?.categorie === 'adjectif' && mots[k + 1]?.categorie === 'nom') k++;
    const noun = mots[k] && tokens[k]?.kind === 'word' ? (mots[k] as AnalyseMot) : null;
    out.push({
      mot: t.text,
      possesseur: { personne: p[0], nombre: p[1], pronom: PERSON_LABEL[`${p[0]}${p[1]}`] ?? '' },
      possede: { nom: noun?.forme ?? null, nombre: p[2], genre: p[3] ?? noun?.genre ?? null },
    });
  });
  return out;
}

function wordOrder(tokens: readonly Token[], v: number, sujet: Sujet | null, inverted: boolean, imperative: boolean): string {
  const after = tokens.slice(v + 1).some((t, k) => t.kind !== 'punct' && !(inverted && k === 0) && !NE.has(t.key) && t.key !== 'pas');
  const parts: string[] = [];
  if (sujet && !imperative && !inverted) parts.push('S');
  parts.push('V');
  if (inverted) parts.push('S');
  if (after) parts.push('O');
  return parts.join(' ');
}

const ACT: Readonly<Record<ClassePhrase, Acte>> = {
  phrase_interrogation: 'demander', imperatif: 'ordonner', exclamation: 's_exclamer', phrase_affirmation: 'informer', mot: 'nommer',
};
const ACT_LABEL: Readonly<Record<Acte, string>> = {
  demander: 'pose une question', ordonner: 'demande une action', s_exclamer: 's’exclame', informer: 'informe', nommer: 'nomme',
};

function meaning(classe: ClassePhrase, negative: boolean, moment: Moment | null, sujet: Sujet | null, possessifs: readonly Possessif[], s: SentenceAnalysis): Sens {
  const acte = ACT[classe];
  const possessions = possessifs.map((p) => ({ possesseur: p.possesseur.pronom, objet: p.possede.nom }));
  const adresseAuLecteur = acte === 'ordonner' || sujet?.personne === 2 || possessifs.some((p) => p.possesseur.personne === 2);
  const parts = [`Le texte ${ACT_LABEL[acte]}`];
  if (s.question) parts.push(s.question.kind === 'YES_NO' ? '(réponse oui ou non)' : `(sur « ${s.question.markers.join(' ')} »)`);
  if (negative) parts.push('à la forme négative');
  if (moment) parts.push(`au ${moment === 'present' ? 'présent' : moment === 'passe' ? 'passé' : 'futur'}`);
  if (adresseAuLecteur) parts.push('en s’adressant au lecteur');
  const owned = possessions.map((p) => `« ${p.objet ?? '…'} » appartient à « ${p.possesseur} »`);
  return {
    acte,
    polarite: negative ? 'negative' : 'affirmative',
    moment,
    adresseAuLecteur,
    possessions,
    resume: `${[parts.join(' '), ...owned].join(' ; ')}.`,
  };
}

const FORM: Readonly<Record<string, AnalysePhrase['forme']>> = {
  WORD: 'mot', EXPRESSION: 'expression', SIMPLE_SENTENCE: 'phrase_simple', COMPLEX_SENTENCE: 'phrase_complexe',
};
const TYPE: Readonly<Record<ClassePhrase, AnalysePhrase['type']>> = {
  phrase_interrogation: 'interrogation', imperatif: 'imperatif', exclamation: 'exclamation', phrase_affirmation: 'affirmation', mot: null,
};

function analyzeSentence(s: SentenceAnalysis, lexicon: Lexicon | undefined): AnalysePhrase {
  const { tokens } = s;
  const verbIndices = new Set(s.finiteVerbs.map((v) => v.index));
  // Mots verbaux d'une construction à auxiliaire (« a fait payer », « sont calculés ») : lus comme verbes.
  const verbal = new Set(verbIndices);
  for (const v of s.finiteVerbs) {
    const main = v.features?.main;
    if (!main) continue;
    for (let j = v.index + 1; j <= main.index; j++) {
      if ((lexicon?.lookup((tokens[j] as Token).key) ?? []).some(isVerbal)) verbal.add(j);
    }
  }
  const negation = negationIndices(tokens);
  const mots = tokens.map((_, i) => describeWord(tokens, i, lexicon, verbal, negation));
  const classe = sentenceClass(s);
  const verbes = s.finiteVerbs
    .filter((v) => v.features !== null)
    .map((v) => describeVerbFeatures(tokens[v.index] as Token, v.features as VerbFeatures, v.imperative));
  const first = s.finiteVerbs[0];
  const { sujet, inverted } = first ? findSubject(tokens, first.index, first.imperative, mots, lexicon) : { sujet: null, inverted: false };
  const possessifs = possessivesOf(tokens, mots, verbIndices);
  const main = verbes[0] ?? null;
  const negative = s.negation.length > 0;
  const derivations = new Set<'passif' | 'causatif' | 'pronominal'>();
  for (const v of verbes) {
    if (v.voix === 'passive') derivations.add('passif');
    if (v.derivation) derivations.add(v.derivation);
  }
  return {
    texte: s.text,
    classe,
    forme: s.form ? FORM[s.form] ?? 'expression' : 'mot',
    type: TYPE[classe],
    question: s.question ? { nature: s.question.kind === 'YES_NO' ? 'totale' : 'partielle', marqueurs: [...s.question.markers] } : null,
    mode: main?.mode ?? (first?.imperative ? 'imperatif' : null),
    temps: main?.temps ?? null,
    moment: main?.moment ?? null,
    verbes,
    sujet,
    ordreMots: first ? wordOrder(tokens, first.index, sujet, inverted, first.imperative) : null,
    negation: { presente: negative, marqueurs: [...s.negation], restriction: s.restriction },
    derivations: [...derivations],
    possessifs,
    subordonnants: [...s.subordinators],
    mots: mots.filter((_, i) => (tokens[i] as Token).kind !== 'punct'),
    sens: meaning(classe, negative, main?.moment ?? null, sujet, possessifs, s),
  };
}

/** Mot principal d'un mot ou d'un groupe de mots : le premier nom, sinon le premier mot plein. */
function headWord(mots: readonly AnalyseMot[]): AnalyseMot | null {
  return mots.find((m) => m.categorie === 'nom' || m.categorie === 'nom_propre')
    ?? mots.find((m) => !['determinant', 'preposition', 'conjonction', 'valeur_protegee'].includes(m.categorie))
    ?? mots[0] ?? null;
}

/** Analyse grammaticale complète d'un texte. Pure et déterministe. */
export function analyzeGrammar(text: string, options: AnalysisOptions = {}): AnalyseGrammaticale {
  const analysis = classify(text, { ...(options.lexicon ? { lexicon: options.lexicon } : {}), ...(options.guards ? { guards: options.guards } : {}) });
  const phrases = analysis.sentences.filter((s) => s.form !== null).map((s) => analyzeSentence(s, options.lexicon));
  const classe: ClasseTexte = phrases.length === 0 ? 'mot' : phrases.length === 1 ? (phrases[0] as AnalysePhrase).classe : 'paragraphe';
  const only = phrases.length === 1 ? (phrases[0] as AnalysePhrase) : null;
  return {
    texte: text,
    classe,
    phrases,
    negation: phrases.some((p) => p.negation.presente),
    mot: classe === 'mot' && only ? headWord(only.mots.filter((m) => m.categorie !== 'autre')) : null,
  };
}

/** Classification seule (extension, mission §3.1) : classe du texte, classe de chaque phrase, négation. */
export function classifyText(text: string, options: AnalysisOptions = {}): { classe: ClasseTexte; phrases: ClassePhrase[]; negation: boolean } {
  const analysis = classify(text, { ...(options.lexicon ? { lexicon: options.lexicon } : {}), ...(options.guards ? { guards: options.guards } : {}) });
  const sentences = analysis.sentences.filter((s) => s.form !== null);
  const phrases = sentences.map(sentenceClass);
  const negation = sentences.some((s) => s.negation.length > 0);
  if (phrases.length === 0) return { classe: 'mot', phrases: ['mot'], negation };
  return { classe: phrases.length === 1 ? (phrases[0] as ClassePhrase) : 'paragraphe', phrases, negation };
}
