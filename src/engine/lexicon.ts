/**
 * Lexique morphologique du français (moteur, PR 2) : lecture du format de Lefff.
 *
 * Une ligne = forme, catégorie Lefff, lemme et traits, séparés par des tabulations
 * (« dépasse	v	dépasser	PS13s »). Les lignes vides et celles qui commencent par « # » sont
 * ignorées. Un code de traits peut décrire plusieurs analyses (« PS13s » = indicatif ou subjonctif
 * présent, 1re ou 3e personne du singulier) : chaque temps devient une lecture distincte.
 *
 * Les données viennent de l'extrait de Lefff versionné dans data/language-resources/lefff/
 * (licence LGPL-LR). Ce module ne fait que les lire : il ne contient aucune donnée.
 *
 * Module pur, sans dépendance à Node.
 */

export type Pos = 'VERB' | 'AUX' | 'NOUN' | 'PROPN' | 'ADJ' | 'ADV' | 'DET' | 'PRON' | 'PREP' | 'CONJ' | 'OTHER';
export type Mood =
  | 'INDICATIVE' | 'SUBJUNCTIVE' | 'CONDITIONAL' | 'IMPERATIVE'
  | 'INFINITIVE' | 'PRESENT_PARTICIPLE' | 'PAST_PARTICIPLE';
export type Tense = 'PRESENT' | 'IMPERFECT' | 'SIMPLE_PAST' | 'FUTURE';

export interface Reading {
  form: string;
  lemma: string;
  pos: Pos;
  /** Catégorie d'origine dans Lefff (v, auxAvoir, nc, cln…). */
  category: string;
  /** Seulement pour un verbe ou un auxiliaire. */
  mood: Mood | null;
  tense: Tense | null;
  /** Personnes possibles ([] si non pertinent ou non précisé). */
  persons: (1 | 2 | 3)[];
  number: 'SINGULAR' | 'PLURAL' | null;
  gender: 'MASCULINE' | 'FEMININE' | null;
}

export interface Lexicon {
  /** Nombre de formes distinctes. */
  readonly size: number;
  /** Lectures d'une forme (casse ignorée), dans l'ordre du fichier. [] si la forme est inconnue. */
  lookup(form: string): readonly Reading[];
}

const POS: Readonly<Record<string, Pos>> = {
  v: 'VERB', auxAvoir: 'AUX', auxEtre: 'AUX', nc: 'NOUN', np: 'PROPN', adj: 'ADJ', adjPref: 'ADJ',
  adv: 'ADV', advPref: 'ADV', advneg: 'ADV', clneg: 'ADV', det: 'DET', prep: 'PREP', coo: 'CONJ', csu: 'CONJ',
  que: 'CONJ', que_restr: 'CONJ', pro: 'PRON', prel: 'PRON', pri: 'PRON', cln: 'PRON', cla: 'PRON', cld: 'PRON',
  clr: 'PRON', cll: 'PRON', clg: 'PRON', cldr: 'PRON', clar: 'PRON', ilimp: 'PRON', ce: 'PRON',
};

/** Codes de temps et de mode de Lefff. */
const MOODS: Readonly<Record<string, readonly [Mood, Tense | null]>> = {
  P: ['INDICATIVE', 'PRESENT'],
  I: ['INDICATIVE', 'IMPERFECT'],
  J: ['INDICATIVE', 'SIMPLE_PAST'],
  F: ['INDICATIVE', 'FUTURE'],
  C: ['CONDITIONAL', 'PRESENT'],
  Y: ['IMPERATIVE', 'PRESENT'],
  S: ['SUBJUNCTIVE', 'PRESENT'],
  T: ['SUBJUNCTIVE', 'IMPERFECT'],
  K: ['PAST_PARTICIPLE', null],
  G: ['PRESENT_PARTICIPLE', null],
  W: ['INFINITIVE', null],
};

const VERB_FEATURES = /^([PIJFCYSTKGW]+)([123]*)([mf]?)([sp]?)$/u;
const OTHER_FEATURES = /^([123]*)([mfe]?)([sp]?)$/u;

type Agreement = Pick<Reading, 'persons' | 'number' | 'gender'>;

function agreement(persons: string, gender: string, number: string): Agreement {
  return {
    persons: [...persons].map((p) => Number(p) as 1 | 2 | 3),
    number: number === 's' ? 'SINGULAR' : number === 'p' ? 'PLURAL' : null,
    gender: gender === 'm' ? 'MASCULINE' : gender === 'f' ? 'FEMININE' : null,
  };
}

/** Lectures décrites par une ligne de Lefff. Un code de traits inconnu donne une lecture sans traits. */
export function parseLine(line: string): Reading[] {
  const [form, category, lemma, features = ''] = line.split('\t');
  if (!form || !category || !lemma) return [];
  const base = { form: form.normalize('NFC'), lemma: lemma.normalize('NFC'), pos: POS[category] ?? 'OTHER', category };
  const none: Agreement = { persons: [], number: null, gender: null };
  if (base.pos === 'VERB' || base.pos === 'AUX') {
    const m = VERB_FEATURES.exec(features);
    if (!m) return [{ ...base, mood: null, tense: null, ...none }];
    const agr = agreement(m[2] as string, m[3] as string, m[4] as string);
    return [...(m[1] as string)].map((code) => {
      const [mood, tense] = MOODS[code] as readonly [Mood, Tense | null];
      return { ...base, mood, tense, ...agr };
    });
  }
  const m = OTHER_FEATURES.exec(features);
  return [{ ...base, mood: null, tense: null, ...(m ? agreement(m[1] as string, m[2] as string, m[3] as string) : none) }];
}

const keyOf = (form: string): string => form.normalize('NFC').toLowerCase();

/** Construit un lexique à partir du texte d'un fichier au format de Lefff. */
export function parseLexicon(text: string): Lexicon {
  const index = new Map<string, Reading[]>();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/u, '');
    if (line === '' || line.startsWith('#')) continue;
    for (const reading of parseLine(line)) {
      const key = keyOf(reading.form);
      const list = index.get(key);
      if (list) list.push(reading);
      else index.set(key, [reading]);
    }
  }
  return { size: index.size, lookup: (form) => index.get(keyOf(form)) ?? [] };
}

const FINITE_MOODS: ReadonlySet<Mood | null> = new Set(['INDICATIVE', 'SUBJUNCTIVE', 'CONDITIONAL', 'IMPERATIVE']);

export const isVerbal = (r: Reading): boolean => r.pos === 'VERB' || r.pos === 'AUX';
export const isFinite = (r: Reading): boolean => isVerbal(r) && FINITE_MOODS.has(r.mood);
