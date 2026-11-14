/**
 * Traits des verbes conjugués (moteur, PR 2) : lemme, mode, temps, et moment exprimé
 * (présent, passé, futur) avec son aspect.
 *
 * Le moment tient compte des constructions à auxiliaire, que D7 rend par des marques différentes :
 * - temps composés : « a envoyé », « s'est connecté », « est arrivé » → passé accompli ;
 * - passif : « est envoyé » (présent), « a été envoyé » (passé) ;
 * - futur proche : « va payer » → futur ;
 * - passé récent : « vient de payer » → passé accompli.
 *
 * Le choix entre les degrés de passé de D7 (récent, intermédiaire, lointain) ne se déduit pas du
 * français : il revient au module de grammaire éton (MOT4).
 *
 * Module pur, sans dépendance à Node.
 */
import { ETRE_VERBS, NEGATION_AFTER_NE, OBJECT_CLITICS, REFLEXIVE_CLITICS } from './french';
import { isFinite, isVerbal, type Lexicon, type Mood, type Reading, type Tense } from './lexicon';
import type { Token } from './normalize';

export type Time = 'PRESENT' | 'PAST' | 'FUTURE';
export type Aspect = 'PERFECTIVE' | 'IMPERFECTIVE';
export type Construction = 'COMPOUND' | 'NEAR_FUTURE' | 'RECENT_PAST';

export interface VerbFeatures {
  /** Lemme du verbe conjugué (l'auxiliaire dans « a envoyé »). */
  lemma: string;
  mood: Mood;
  tense: Tense | null;
  time: Time;
  aspect: Aspect | null;
  construction: Construction | null;
  passive: boolean;
  /** Participe ou infinitif qui porte le sens dans une construction à auxiliaire (« envoyé » dans « a envoyé »). */
  main: { index: number; lemma: string } | null;
  /** Vrai si plusieurs lemmes ou temps restaient possibles : la première lecture de Lefff a été gardée. */
  ambiguous: boolean;
}

type Subject = readonly [1 | 2 | 3, 'SINGULAR' | 'PLURAL'];
const SUBJECTS: Readonly<Record<string, Subject>> = {
  je: [1, 'SINGULAR'], "j'": [1, 'SINGULAR'], tu: [2, 'SINGULAR'], il: [3, 'SINGULAR'], elle: [3, 'SINGULAR'],
  on: [3, 'SINGULAR'], ils: [3, 'PLURAL'], elles: [3, 'PLURAL'], nous: [1, 'PLURAL'], vous: [2, 'PLURAL'],
};
const NE: ReadonlySet<string> = new Set(['ne', "n'"]);
const MOOD_ORDER: readonly Mood[] = ['INDICATIVE', 'CONDITIONAL', 'SUBJUNCTIVE', 'IMPERATIVE'];

/** Pronom sujet du verbe i : avant lui (après « ne » et les pronoms compléments) ou inversé après lui. */
function subjectOf(tokens: readonly Token[], i: number): Subject | null {
  const after = tokens[i + 1];
  if (after?.enclitic && SUBJECTS[after.key] && after.key !== 'nous' && after.key !== 'vous') return SUBJECTS[after.key] ?? null;
  let candidate: Subject | null = null;
  for (let j = i - 1; j >= 0; j--) {
    const t = tokens[j] as Token;
    if (t.kind !== 'word' || t.enclitic) break;
    if (NE.has(t.key)) continue;
    if (t.key === 'nous' || t.key === 'vous') {
      candidate = SUBJECTS[t.key] ?? null; // sujet s'il n'y a pas d'autre pronom sujet avant (« vous envoyez »)
      continue;
    }
    if (OBJECT_CLITICS.has(t.key)) continue;
    return SUBJECTS[t.key] ?? candidate;
  }
  return candidate;
}

function chooseReading(readings: readonly Reading[], imperative: boolean, subject: Subject | null): { reading: Reading; ambiguous: boolean } | null {
  let c = readings.filter(isFinite);
  const keep = (f: (r: Reading) => boolean): void => {
    const kept = c.filter(f);
    if (kept.length > 0) c = kept;
  };
  if (c.length === 0) return null;
  keep((r) => (r.mood === 'IMPERATIVE') === imperative);
  if (subject) keep((r) => r.persons.includes(subject[0]) && (r.number === null || r.number === subject[1]));
  const mood = MOOD_ORDER.find((m) => c.some((r) => r.mood === m));
  keep((r) => r.mood === mood);
  keep((r) => r.pos === 'AUX');
  return { reading: c[0] as Reading, ambiguous: new Set(c.map((r) => `${r.lemma}|${r.tense}`)).size > 1 };
}

function simpleTime(r: Reading): [Time, Aspect | null] {
  if (r.tense === 'FUTURE') return ['FUTURE', null];
  if (r.tense === 'IMPERFECT') return ['PAST', r.mood === 'INDICATIVE' ? 'IMPERFECTIVE' : null];
  if (r.tense === 'SIMPLE_PAST') return ['PAST', 'PERFECTIVE'];
  return ['PRESENT', null];
}

/** Prochain mot après i, en sautant la négation, les adverbes et un sujet inversé (« a-t-il déjà payé »). */
function nextContentWord(tokens: readonly Token[], i: number, lexicon: Lexicon, skipObjects: boolean): number {
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j] as Token;
    if (t.kind !== 'word') return -1;
    if (t.enclitic && SUBJECTS[t.key]) continue;
    if (NE.has(t.key) || NEGATION_AFTER_NE.has(t.key)) continue;
    if (skipObjects && OBJECT_CLITICS.has(t.key)) continue;
    const readings = lexicon.lookup(t.key);
    if (readings.some((r) => r.pos === 'ADV') && !readings.some(isVerbal)) continue;
    return j;
  }
  return -1;
}

const withMood = (tokens: readonly Token[], j: number, lexicon: Lexicon, mood: Mood): Reading | null =>
  j < 0 ? null : lexicon.lookup((tokens[j] as Token).key).find((r) => isVerbal(r) && r.mood === mood) ?? null;

/** Pronom réfléchi juste avant l'auxiliaire (« il s'est connecté », « nous nous sommes connectés »). */
function reflexiveBefore(tokens: readonly Token[], i: number): boolean {
  let j = i - 1;
  while (NE.has(tokens[j]?.key ?? '')) j--;
  const t = tokens[j];
  if (t === undefined || t.kind !== 'word') return false;
  if (REFLEXIVE_CLITICS.has(t.key)) return true;
  return (t.key === 'nous' || t.key === 'vous') && tokens[j - 1]?.key === t.key;
}

/**
 * Traits du verbe conjugué tokens[i]. null si le lexique ne connaît aucune forme conjuguée pour ce
 * mot. `imperative` vient de la classification (position en tête de proposition, sans sujet).
 */
export function describeVerb(tokens: readonly Token[], i: number, lexicon: Lexicon, imperative: boolean): VerbFeatures | null {
  const token = tokens[i];
  if (token === undefined) return null;
  const choice = chooseReading(lexicon.lookup(token.key), imperative, subjectOf(tokens, i));
  if (!choice) return null;
  const r = choice.reading;
  let [time, aspect] = simpleTime(r);
  let construction: Construction | null = null;
  let passive = false;
  let main: VerbFeatures['main'] = null;

  if (r.lemma === 'avoir' || r.lemma === 'être') {
    const k = nextContentWord(tokens, i, lexicon, false);
    const participle = withMood(tokens, k, lexicon, 'PAST_PARTICIPLE');
    if (participle) {
      main = { index: k, lemma: participle.lemma };
      if (r.lemma === 'avoir' || ETRE_VERBS.has(participle.lemma) || reflexiveBefore(tokens, i)) {
        construction = 'COMPOUND';
        [time, aspect] = [r.tense === 'FUTURE' ? 'FUTURE' : 'PAST', 'PERFECTIVE'];
        if (participle.lemma === 'être') { // « a été envoyé » : passif au passé
          const k2 = nextContentWord(tokens, k, lexicon, false);
          const second = withMood(tokens, k2, lexicon, 'PAST_PARTICIPLE');
          if (second) {
            passive = true;
            main = { index: k2, lemma: second.lemma };
          }
        }
      } else passive = true;
    }
  } else if (r.lemma === 'aller' && r.mood === 'INDICATIVE' && r.tense === 'PRESENT') {
    const k = nextContentWord(tokens, i, lexicon, true);
    const infinitive = withMood(tokens, k, lexicon, 'INFINITIVE');
    if (infinitive) {
      [time, aspect, construction] = ['FUTURE', null, 'NEAR_FUTURE'];
      main = { index: k, lemma: infinitive.lemma };
    }
  } else if (r.lemma === 'venir' && r.mood === 'INDICATIVE' && r.tense === 'PRESENT') {
    const de = tokens[i + 1];
    const k = de?.key === 'de' || de?.key === "d'" ? nextContentWord(tokens, i + 1, lexicon, true) : -1;
    const infinitive = withMood(tokens, k, lexicon, 'INFINITIVE');
    if (infinitive) {
      [time, aspect, construction] = ['PAST', 'PERFECTIVE', 'RECENT_PAST'];
      main = { index: k, lemma: infinitive.lemma };
    }
  }
  return {
    lemma: r.lemma,
    mood: r.mood as Mood,
    tense: r.tense,
    time,
    aspect,
    construction,
    passive,
    main,
    ambiguous: choice.ambiguous,
  };
}
