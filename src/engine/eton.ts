/**
 * Construction de la phrase éton (MOT4) à partir d'un texte français simplifié.
 *
 * Le moteur n'invente aucune forme ni règle (M2, M10) :
 * - chaque mot plein est cherché dans D7 (forme du texte, puis lemme de même catégorie) ;
 * - seules les règles de classe A de D7 sont appliquées : ordre sujet – verbe – compléments, articles
 *   ignorés (validé en BM3.6), « də̀ » en tête d'une question oui/non, mot interrogatif laissé en place,
 *   impératifs irréguliers kɛ̀ní / zùgá ;
 * - tout trait qui demande une règle de classe B (inactive par défaut, M10) ou C (non documentée) est
 *   rendu comme un manque, avec la règle et sa référence. Aucun manque → phrase complète.
 *
 * Les formes éton sont les formes de citation de D7 (tons et préfixes non modifiés).
 * Module pur, sans dépendance à Node.
 */
import { classify, negationIndices, questionParticleIndices, restrictionIndices, type SentenceAnalysis } from './classify';
import { chooseEntry, type D7Entry, type D7Index, isBoundForm, senseOf } from './d7';
import { DETERMINERS, OBJECT_CLITICS, PREPOSITIONS, SUBJECT_CLITICS } from './french';
import type { Lexicon, Pos } from './lexicon';
import type { Token } from './normalize';

export type RuleClass = 'A' | 'B' | 'C';

export interface EtonRule {
  id: string;
  ruleClass: RuleClass;
  ref: string;
  description: string;
}

const SKETCH = 'D7, esquisse grammaticale p. 18-71';
const rule = (id: string, ruleClass: RuleClass, section: string, description: string): EtonRule =>
  ({ id, ruleClass, ref: `${SKETCH}, ${section}`, description });

/**
 * Règles de D7 utilisées ou attendues par le moteur. Classe A : appliquée. Classe B : décrite par D7
 * mais incomplète (ton, choix entre formes, exemple seul) — inactive (M10). Classe C : non documentée.
 */
export const ETON_RULES = {
  ORDER: rule('D7-ORDRE-SVO', 'A', '§1 Ordre des mots', 'Sujet – verbe – compléments : l’ordre du français est gardé.'),
  YES_NO: rule('D7-QUESTION-OUI-NON', 'A', '§4 Questions', '« də̀ » en début de phrase.'),
  WH: rule('D7-QUESTION-PARTIELLE', 'A', '§4 Questions', 'Le mot interrogatif reste à sa place.'),
  IMPERATIVE_IRREGULAR: rule('D7-IMPERATIF-IRREGULIER', 'A', '§4 Impératif irrégulier', '« Va ! » kɛ̀ní, « Viens ! » zùgá.'),
  PRESENT: rule('D7-PRESENT', 'B', '§3 Temps', 'MS-tə́ + infinitif précédé d’un ton bas flottant : notation du ton déduite des exemples seulement.'),
  SUBJECT_MARKER: rule('D7-MARQUE-SUJET', 'B', '§2 Marques du sujet', 'Marque de sujet d’un nom : classes du lexique non reliées au tableau des classes 1–10 ; « nous » : ɛ̀ ou bì.'),
  PAST_RECENT_PERFECTIVE: rule('D7-PASSE-RECENT-PERFECTIF', 'C', '§3 Temps', 'MS-H-thème(-H) : tons non documentés.'),
  PAST_RECENT_IMPERFECTIVE: rule('D7-PASSE-RECENT-IMPERFECTIF', 'C', '§3 Temps', 'MS-bə́ + infinitif de la forme G : forme G non documentée.'),
  FUTURE: rule('D7-FUTUR', 'C', '§3 Temps', 'MS-èèy + infinitif : fusion avec la marque du sujet non documentée.'),
  CONDITIONAL: rule('D7-CONDITIONNEL', 'C', '§3 Temps', 'Aucune règle du conditionnel dans D7.'),
  SUBJUNCTIVE: rule('D7-SUBJONCTIF', 'C', '§4 Subjonctif', 'Ton haut sur la marque du sujet : non documenté pour chaque marque.'),
  IMPERATIVE: rule('D7-IMPERATIF', 'C', '§4 Impératif', 'Ton haut flottant après la 1re syllabe du thème : non documenté pour chaque verbe.'),
  IMPERATIVE_PLURAL: rule('D7-IMPERATIF-PLURIEL', 'C', '§4 Impératif pluriel', 'Suffixe -(ə́)ŋgán(à) : forme exacte non documentée.'),
  NEGATION: rule('D7-NEGATION', 'C', '§4 Négation', 'àá après la marque du sujet : fusion des voyelles non documentée.'),
  NEGATION_IMPERATIVE: rule('D7-NEGATION-IMPERATIF', 'B', '§4 Négation', 'Auxiliaire bə́ ꜜ + verbe : ton du verbe non documenté.'),
  RESTRICTION: rule('D7-RESTRICTION', 'C', '§4', 'Aucune règle de « ne … que » dans D7.'),
  PASSIVE: rule('D7-PASSIF', 'C', '§6 Dérivation', 'Suffixe -bàn : exemples seulement, pas une règle productive.'),
  POSTPOSITION: rule('D7-LOCATIF-APRES-NOM', 'B', '§7 (exemple « íꜜlə́ á sí » sous l’arbre)', 'Préposition française rendue par un adverbe de lieu de D7, placé après le nom : un exemple seulement.'),
  POSSESSIVE: rule('D7-POSSESSIF', 'C', 'lexique (radicaux -a̋mà, -ɔ̀, -ě, -èèní, -àbní)', 'Préfixe d’accord et tons non documentés.'),
  OBJECT_PRONOUN: rule('D7-PRONOM-OBJET', 'B', '§3 (exemple « mə̀tə́ wɔ̂ yɛ́n »)', 'Place et forme du pronom complément : un exemple seulement.'),
  AGREEMENT: rule('D7-ACCORD', 'C', 'lexique (radicaux liés « -… »)', 'Radical lié : préfixe d’accord non documenté.'),
  ADJECTIVE: rule('D7-NOM-ADJECTIF', 'B', '§7 (exemple « mə̀bwád mə́ bôd »)', 'Ordre et connectif accordé : un exemple seulement.'),
  INFINITIVE: rule('D7-INFINITIF-PREPOSITION', 'C', 'lexique n° 685 (exemple « ású ɲcígní ɲâg »)', 'Forme du verbe après une préposition (« pour couper ») : préfixe non documenté.'),
  NUMERAL: rule('D7-NOMBRE', 'C', '§1-7', 'Place et accord du nombre par rapport au nom : non documentés.'),
  CONNECTIVE: rule('D7-CONNECTIF', 'C', '§7', 'Connectif entre deux noms : accord non documenté.'),
  VERB_FORM: rule('D7-FORME-VERBALE', 'C', '§3', 'Participe ou forme conjuguée : D7 ne donne que l’infinitif.'),
} as const satisfies Record<string, EtonRule>;

/** Mots ignorés par une règle validée (grammar-rules.json, `ignoredWords`). */
export interface IgnoredWords {
  id: string;
  words: readonly string[];
  ref: string;
}

export interface EtonOptions {
  guards?: readonly string[];
  lexicon?: Lexicon;
  /** Articles ignorés (règle validée en BM3.6). Sans cette option, les articles sont cherchés dans D7. */
  ignored?: readonly IgnoredWords[];
}

export type Gap =
  /** `rejected` : entrées de D7 de même forme écartées car d'une autre catégorie (autre sens probable). */
  | { kind: 'WORD'; fr: string; rejected: { eto: string; category: string; ref: string }[] }
  | { kind: 'RULE'; fr: string; rule: EtonRule };

export interface EtonPiece {
  /** Mots français rendus (vide pour « də̀ »). */
  fr: string;
  /** Forme éton, ou null si elle manque ou ne peut pas être écrite seule. */
  eto: string | null;
  source: 'D7' | 'RULE' | 'PROTECTED' | 'PUNCT' | 'GRAMMAR' | 'MISSING';
  ref: string | null;
  /** D7 : trouvé par la forme du texte ou par le lemme. */
  by?: 'FORM' | 'LEMMA';
  category?: string;
  /** Glose complète de l'entrée de D7. */
  gloss?: string;
  /** Sens de l'entrée : plusieurs sens ou une précision → mot signalé comme ambigu. */
  senses?: number;
  qualifier?: string | null;
  /** Mot français de plusieurs natures que le contexte ne départage pas → signalé comme ambigu. */
  homograph?: boolean;
  alternatives?: { eto: string; ref: string }[];
}

export interface EtonSentence {
  fr: string;
  pieces: EtonPiece[];
  /** Phrase éton, seulement si rien ne manque. */
  eto: string | null;
  /** Brouillon lisible : formes trouvées, mots manquants entre crochets. */
  draft: string;
  applied: EtonRule[];
  gaps: Gap[];
  /** Mots dont le sens est à confirmer : entrée de D7 à plusieurs sens ou à sens précisé, homographe. */
  ambiguous: string[];
  /** Mots pleins trouvés dans D7 et écrits / mots pleins. */
  found: number;
  total: number;
}

export interface EtonText {
  fr: string;
  sentences: EtonSentence[];
  eto: string | null;
  draft: string;
  complete: boolean;
  gaps: Gap[];
  ambiguous: string[];
  found: number;
  total: number;
}

/* ------------------------------------------------------------------ catégories */

const D7_CATEGORIES: Readonly<Record<Pos, readonly string[]>> = {
  VERB: ['VERBE', 'AUX'], AUX: ['VERBE', 'AUX'], NOUN: ['NOM'], PROPN: ['NOM'], ADJ: ['ADJ'], ADV: ['ADV', 'INTERJ'],
  // D7 range parmi les adverbes des mots que le français classe en prépositions (« sous », « derrière »).
  PREP: ['PREP', 'ADV'], PRON: ['PRON'], CONJ: ['SUB', 'PREP', 'ADV'], DET: ['NUM', 'ADJ'], OTHER: [],
};
const POSSESSIVES = new Set('mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs'.split(' '));
const NE: ReadonlySet<string> = new Set(['ne', "n'"]);
const NOMINAL: ReadonlySet<Pos> = new Set(['NOUN', 'ADJ', 'PROPN']);
/** Catégories dont une forme fléchie peut être ramenée à son lemme. */
const INFLECTED: ReadonlySet<Pos> = new Set(['NOUN', 'ADJ', 'VERB', 'ADV']);
const IRREGULAR_IMPERATIVES: Readonly<Record<string, string>> = { aller: 'kɛ̀ní', venir: 'zùgá' };

type Role =
  | { kind: 'LEX' }
  | { kind: 'VERB'; lemma: string | null; finite: number | null }
  | { kind: 'PUNCT' | 'PROTECTED' | 'DROP' | 'PARTICLE' | 'NEG' | 'RESTRICT' | 'SUBJECT' | 'AUXILIARY' | 'POSSESSIVE' | 'OBJECT' };

function wordAt(tokens: readonly Token[], i: number): Token | undefined {
  const t = tokens[i];
  return t?.kind === 'word' ? t : undefined;
}

/** Rôle de chaque jeton : mot à chercher dans D7, mot grammatical rendu par une règle, valeur protégée… */
function roles(s: SentenceAnalysis, lexicon: Lexicon | undefined, ignored: ReadonlySet<string>): Role[] {
  const { tokens } = s;
  const out: Role[] = tokens.map((t) => (t.kind === 'punct' ? { kind: 'PUNCT' } : t.kind === 'word' ? { kind: 'LEX' } : { kind: 'PROTECTED' }));
  const set = (i: number, role: Role): void => {
    if (out[i]?.kind === 'LEX') out[i] = role;
  };
  const verbs = new Set(s.finiteVerbs.map((v) => v.index));
  const verbal = (i: number): boolean => {
    const t = wordAt(tokens, i);
    if (!t) return false;
    if (verbs.has(i)) return true;
    const readings = lexicon?.lookup(t.key) ?? [];
    return readings.length > 0 && readings.every((r) => r.pos === 'VERB' || r.pos === 'AUX');
  };
  for (const i of questionParticleIndices(tokens)) set(i, { kind: 'PARTICLE' });
  for (const i of negationIndices(tokens)) set(i, { kind: 'NEG' });
  for (const i of restrictionIndices(tokens)) set(i, { kind: 'RESTRICT' });
  for (const v of s.finiteVerbs) {
    const main = v.features?.main ?? null;
    if (main && main.index !== v.index) {
      for (let j = v.index; j < main.index; j++) {
        const t = wordAt(tokens, j);
        if (t && (j === v.index || t.key === 'été' || t.key === 'de' || t.key === "d'" || (lexicon?.lookup(t.key) ?? []).some((r) => r.pos === 'AUX'))) {
          set(j, { kind: 'AUXILIARY' });
        }
      }
      set(main.index, { kind: 'VERB', lemma: main.lemma, finite: v.index });
    } else set(v.index, { kind: 'VERB', lemma: v.features?.lemma ?? null, finite: v.index });
  }
  tokens.forEach((t, i) => {
    if (t.kind !== 'word') return;
    if (SUBJECT_CLITICS.has(t.key) || t.key === "c'" || (t.enclitic && t.key !== 'nous' && t.key !== 'vous' && !OBJECT_CLITICS.has(t.key))) {
      set(i, { kind: 'SUBJECT' });
    } else if ((t.key === 'nous' || t.key === 'vous') && !t.enclitic) {
      let j = i + 1;
      while (wordAt(tokens, j) && (OBJECT_CLITICS.has((tokens[j] as Token).key) || out[j]?.kind === 'NEG')) j++;
      if (verbs.has(j)) set(i, { kind: 'SUBJECT' });
      else if (verbal(j)) set(i, { kind: 'OBJECT' });
    } else if (t.enclitic || (OBJECT_CLITICS.has(t.key) && verbal(i + 1))) {
      set(i, { kind: 'OBJECT' });
    } else if (POSSESSIVES.has(t.key)) set(i, { kind: 'POSSESSIVE' });
    else if (ignored.has(t.key)) set(i, { kind: 'DROP' });
  });
  return out;
}

/** Catégories françaises possibles du mot i dans la phrase. */
function contextPos(tokens: readonly Token[], i: number, lexicon: Lexicon | undefined, role: Role): Set<Pos> {
  if (role.kind === 'VERB') return new Set(['VERB']);
  const t = tokens[i] as Token;
  const pos = new Set((lexicon?.lookup(t.key) ?? []).map((r) => r.pos));
  const prev = wordAt(tokens, i - 1);
  if (prev && (DETERMINERS.has(prev.key) || POSSESSIVES.has(prev.key))) {
    const nominal = [...pos].filter((p) => NOMINAL.has(p));
    if (nominal.length > 0) return new Set(nominal);
  }
  return pos;
}

interface Lookup {
  choice: { entry: D7Entry; alternatives: D7Entry[] };
  by: 'FORM' | 'LEMMA';
  end: number;
  /** Clé de D7 trouvée (forme, expression ou lemme). */
  key: string;
  /** Mot français de plusieurs natures que le contexte ne départage pas (« sous » : préposition ou nom). */
  homograph: boolean;
}

const POS_GROUP: Readonly<Partial<Record<Pos, string>>> = {
  NOUN: 'N', ADJ: 'N', PROPN: 'N', VERB: 'V', AUX: 'V', ADV: 'P', PREP: 'P', CONJ: 'P',
};

function lookup(tokens: readonly Token[], i: number, roleList: readonly Role[], d7: D7Index, lexicon: Lexicon | undefined): Lookup | null {
  const role = roleList[i] as Role;
  // Expression de plusieurs mots (« pour rien »), articles compris.
  if (role.kind === 'LEX') {
    for (let n = Math.min(d7.maxWords, tokens.length - i); n >= 2; n--) {
      const span = roleList.slice(i, i + n);
      // « pour rien » (á pûpùd) : un mot de négation sans « ne » peut finir une expression de D7.
      const inside = (r: Role, k: number): boolean => r.kind === 'LEX' || r.kind === 'DROP'
        || (r.kind === 'NEG' && !NE.has((tokens[i + k] as Token).key));
      if (!span.every(inside) || span[n - 1]?.kind === 'DROP') continue;
      const key = tokens.slice(i, i + n).map((t) => t.key).join(' ');
      const choice = chooseEntry(d7.get(key), new Set());
      if (choice) return { choice, by: 'FORM', end: i + n, key, homograph: false };
    }
  }
  const t = tokens[i] as Token;
  const pos = contextPos(tokens, i, lexicon, role);
  const preferred = new Set([...pos].flatMap((p) => D7_CATEGORIES[p]));
  const homograph = new Set([...pos].map((p) => POS_GROUP[p]).filter(Boolean)).size > 1;
  if (role.kind !== 'VERB' || t.key === role.lemma) {
    // Mot connu de Lefff : seulement une entrée de catégorie compatible (« Prêt » nom ≠ bə̀bə̀ adverbe
    // « proche, prêt ») ; une autre catégorie signale presque toujours un autre sens.
    const all = d7.get(t.key);
    const choice = chooseEntry(pos.size > 0 ? all.filter((e) => preferred.has(e.category)) : all, preferred);
    if (choice) return { choice, by: 'FORM', end: i + 1, key: t.key, homograph };
  }
  // Par le lemme : seulement pour un mot plein, et une entrée de D7 de la catégorie attendue
  // (« compte » nom ≠ « compter » ; « de » partitif, lemme « un », ne devient pas le nombre 1).
  const lemmas = role.kind === 'VERB' && role.lemma
    ? [role.lemma]
    : (lexicon?.lookup(t.key) ?? []).filter((r) => pos.has(r.pos) && INFLECTED.has(r.pos)).map((r) => r.lemma);
  for (const lemma of new Set(lemmas.map((l) => l.toLocaleLowerCase('fr')))) {
    if (lemma === t.key) continue;
    const entries = d7.get(lemma).filter((e) => preferred.has(e.category));
    const choice = chooseEntry(entries, preferred);
    if (choice) return { choice, by: 'LEMMA', end: i + 1, key: lemma, homograph };
  }
  return null;
}

/* ------------------------------------------------------------------ phrase */

function verbRules(s: SentenceAnalysis, finite: number, lexicon: Lexicon | undefined): { rules: EtonRule[]; irregular: string | null } {
  const v = s.finiteVerbs.find((x) => x.index === finite);
  const f = v?.features ?? null;
  if (!v || !f) return { rules: [ETON_RULES.VERB_FORM], irregular: null };
  const rules: EtonRule[] = [];
  if (v.imperative) {
    const key = (s.tokens[finite] as Token).key;
    const plural = key.endsWith('ez') || key.endsWith('ons');
    const irregular = plural ? undefined : IRREGULAR_IMPERATIVES[f.lemma];
    const singular = (lexicon?.lookup(key) ?? []).some((r) => r.mood === 'IMPERATIVE' && r.number === 'SINGULAR');
    if (irregular && singular && !f.main) return { rules: [], irregular };
    rules.push(plural ? ETON_RULES.IMPERATIVE_PLURAL : ETON_RULES.IMPERATIVE);
  } else if (f.mood === 'CONDITIONAL') rules.push(ETON_RULES.CONDITIONAL);
  else if (f.mood === 'SUBJUNCTIVE') rules.push(ETON_RULES.SUBJUNCTIVE);
  else if (f.time === 'PAST') rules.push(f.aspect === 'IMPERFECTIVE' ? ETON_RULES.PAST_RECENT_IMPERFECTIVE : ETON_RULES.PAST_RECENT_PERFECTIVE);
  else if (f.time === 'FUTURE') rules.push(ETON_RULES.FUTURE);
  else rules.push(ETON_RULES.PRESENT);
  if (f.passive) rules.push(ETON_RULES.PASSIVE);
  return { rules, irregular: null };
}

const ATTACHED = new Set(['.', ',', '…', ')', '...']);

function join(parts: readonly { text: string; punct: boolean }[]): string {
  let out = '';
  for (const p of parts) {
    if (out === '') out = p.text;
    else if (p.punct && ATTACHED.has(p.text)) out += p.text;
    else out += ` ${p.text}`;
  }
  return out;
}

/** Construit la phrase éton d'une phrase française analysée. */
export function buildSentence(s: SentenceAnalysis, d7: D7Index, options: EtonOptions = {}): EtonSentence {
  const { tokens } = s;
  const { lexicon } = options;
  const ignoredWords = new Set((options.ignored ?? []).flatMap((g) => g.words));
  const roleList = roles(s, lexicon, ignoredWords);
  const pieces: EtonPiece[] = [];
  const gaps: Gap[] = [];
  const applied = new Set<EtonRule>();
  let found = 0;
  let total = 0;
  /** Jetons rendus par une entrée de D7 (une expression peut contenir « rien »). */
  const consumed = new Set<number>();
  const gap = (fr: string, r: EtonRule): void => {
    if (!gaps.some((g) => g.kind === 'RULE' && g.rule === r && g.fr === fr)) gaps.push({ kind: 'RULE', fr, rule: r });
  };

  if (s.question?.kind === 'YES_NO') {
    pieces.push({ fr: '', eto: 'də̀', source: 'RULE', ref: ETON_RULES.YES_NO.ref });
    applied.add(ETON_RULES.YES_NO);
  }
  if (s.question?.kind === 'WH') applied.add(ETON_RULES.WH);

  for (let i = 0; i < tokens.length;) {
    const t = tokens[i] as Token;
    const role = roleList[i] as Role;
    switch (role.kind) {
      case 'PUNCT':
        pieces.push({ fr: t.text, eto: t.text, source: 'PUNCT', ref: null });
        i++;
        continue;
      case 'PROTECTED':
        pieces.push({ fr: t.text, eto: t.text, source: 'PROTECTED', ref: null });
        i++;
        continue;
      case 'DROP': {
        const g = (options.ignored ?? []).find((x) => x.words.includes(t.key));
        if (g) applied.add({ id: g.id, ruleClass: 'A', ref: g.ref, description: 'Mot ignoré : l’éton n’a pas d’article.' });
        i++;
        continue;
      }
      case 'PARTICLE':
        i++;
        continue;
      case 'NEG':
      case 'RESTRICT':
      case 'SUBJECT':
      case 'AUXILIARY':
        pieces.push({ fr: t.text, eto: null, source: 'GRAMMAR', ref: null });
        i++;
        continue;
      case 'POSSESSIVE':
      case 'OBJECT':
        pieces.push({ fr: t.text, eto: null, source: 'GRAMMAR', ref: null });
        gap(t.text, role.kind === 'POSSESSIVE' ? ETON_RULES.POSSESSIVE : ETON_RULES.OBJECT_PRONOUN);
        i++;
        continue;
      default:
        break;
    }

    // Mot plein (ou verbe).
    total++;
    if (role.kind === 'VERB' && role.finite !== null) {
      const { rules, irregular } = verbRules(s, role.finite, lexicon);
      if (irregular) {
        pieces.push({ fr: t.text, eto: irregular, source: 'RULE', ref: ETON_RULES.IMPERATIVE_IRREGULAR.ref });
        applied.add(ETON_RULES.IMPERATIVE_IRREGULAR);
        found++;
        i++;
        continue;
      }
      for (const r of rules) gap(t.text, r);
    }
    const hit = lookup(tokens, i, roleList, d7, lexicon);
    const fr = tokens.slice(i, hit?.end ?? i + 1).map((x) => x.text).join(' ');
    if (!hit) {
      pieces.push({ fr, eto: null, source: 'MISSING', ref: null });
      const rejected = d7.get(t.key).map((x) => ({ eto: x.eto, category: x.category, ref: x.ref }));
      gaps.push({ kind: 'WORD', fr, rejected });
      i++;
      continue;
    }
    const { entry, alternatives } = hit.choice;
    const { senses, qualifier } = senseOf(entry, hit.key);
    const piece: EtonPiece = {
      fr,
      eto: entry.eto,
      source: 'D7',
      ref: entry.ref,
      by: hit.by,
      category: entry.category,
      gloss: entry.gloss,
      senses,
      qualifier,
      homograph: hit.homograph,
      alternatives: alternatives.map((a) => ({ eto: a.eto, ref: a.ref })),
    };
    for (let k = i; k < hit.end; k++) consumed.add(k);
    if (isBoundForm(entry.eto)) {
      piece.eto = null;
      gap(fr, ETON_RULES.AGREEMENT);
    } else if (hit.end === i + 1 && PREPOSITIONS.has(t.key) && entry.category === 'ADV') {
      gap(fr, ETON_RULES.POSTPOSITION);
    } else if (role.kind === 'LEX' && (entry.category === 'VERBE' || entry.category === 'AUX') && hit.end === i + 1
      && !(lexicon?.lookup(t.key) ?? []).some((r) => r.mood === 'INFINITIVE')) {
      // Participe (« écrit ») ou forme conjuguée non repérée : D7 ne donne que l'infinitif.
      gap(fr, ETON_RULES.VERB_FORM);
    } else found++;
    pieces.push(piece);
    i = hit.end;
  }

  // Traits de la phrase.
  const negation = [...negationIndices(tokens)].filter((k) => !consumed.has(k));
  if (negation.length > 0) gap(negation.map((k) => (tokens[k] as Token).key).join(' '), s.type === 'IMPERATIVE' ? ETON_RULES.NEGATION_IMPERATIVE : ETON_RULES.NEGATION);
  if (s.restriction) gap('ne … que', ETON_RULES.RESTRICTION);
  const lexical = pieces.filter((p) => p.source === 'D7' || p.source === 'MISSING');
  for (let k = 1; k < pieces.length; k++) {
    const a = pieces[k - 1] as EtonPiece;
    const b = pieces[k] as EtonPiece;
    if (a.source !== 'D7' || b.source !== 'D7') continue;
    const pair = [a.category, b.category];
    if (pair.includes('NOM') && pair.includes('ADJ')) gap(`${a.fr} ${b.fr}`, ETON_RULES.ADJECTIVE);
    else if (pair.includes('NOM') && pair.includes('NUM')) gap(`${a.fr} ${b.fr}`, ETON_RULES.NUMERAL);
    else if (PREPOSITIONS.has(a.fr.toLocaleLowerCase('fr')) && b.category === 'VERBE') gap(`${a.fr} ${b.fr}`, ETON_RULES.INFINITIVE);
    else if (pair[0] === 'NOM' && pair[1] === 'NOM') gap(`${a.fr} ${b.fr}`, ETON_RULES.CONNECTIVE);
  }
  if (lexical.length >= 2) applied.add(ETON_RULES.ORDER);

  const parts = pieces.map((p) => ({ text: p.eto ?? `[${p.fr}]`, punct: p.source === 'PUNCT' }));
  return {
    fr: s.text,
    pieces,
    eto: gaps.length === 0 ? join(parts) : null,
    draft: join(parts),
    applied: [...applied],
    gaps,
    ambiguous: pieces.filter((p) => p.source === 'D7' && ((p.senses ?? 1) > 1 || p.qualifier || p.homograph)).map((p) => p.fr),
    found,
    total,
  };
}

/** Construit l'éton d'un texte français (une ou plusieurs phrases). */
export function buildEton(text: string, d7: D7Index, options: EtonOptions = {}): EtonText {
  const sentences = classify(text, options).sentences.map((s) => buildSentence(s, d7, options));
  const complete = sentences.every((s) => s.eto !== null);
  return {
    fr: text,
    sentences,
    eto: complete ? sentences.map((s) => s.eto).join(' ') : null,
    draft: sentences.map((s) => s.draft).join(' '),
    complete,
    gaps: sentences.flatMap((s) => s.gaps),
    ambiguous: sentences.flatMap((s) => s.ambiguous),
    found: sentences.reduce((n, s) => n + s.found, 0),
    total: sentences.reduce((n, s) => n + s.total, 0),
  };
}
