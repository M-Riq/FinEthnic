/**
 * Construction de la phrase éton (MOT4) à partir d'un texte français simplifié.
 *
 * Le moteur n'invente aucune forme ni règle (M2, M10) :
 * - chaque mot plein est cherché dans D7 (forme du texte, puis lemme de même catégorie) ;
 * - seules les règles de classe A de D7 sont appliquées : ordre sujet – verbe – compléments, articles
 *   ignorés (validé en BM3.6), « də̀ » en tête d'une question oui/non, mot interrogatif laissé en place,
 *   impératifs irréguliers kɛ̀ní / zùgá ; présent avec « je », « tu » ou « nous » sujet (M19) ; « de » entre
 *   deux noms, accordé à la classe du premier nom (M26) ; nom adjectival de classe 7 en tête, suivi du
 *   connectif í et du nom (M33) ;
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
import { normalize, type Token } from './normalize';

export type RuleClass = 'A' | 'B' | 'C';

export interface EtonRule {
  id: string;
  ruleClass: RuleClass;
  ref: string;
  description: string;
}

const SKETCH = 'D7, esquisse grammaticale p. 18-71';
/** Texte complet de l'esquisse grammaticale (HAL halshs-03847045), reçu en M28. */
const ESQUISSE = 'Esquisse grammaticale complète (HAL halshs-03847045)';
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
  PRESENT_PRONOUN: rule('D7-PRESENT-PRONOM', 'A', '§2 Marques du sujet, §3 Temps (« mə̀tə́ ꜜdí » je mange)',
    'Présent avec « je », « tu » ou « nous » juste avant le verbe : mə̀tə́, ùtə́, ɛ̀tə́ + infinitif ; ꜜ devant un verbe à ton haut initial (171 exemples de D7 sur 178, aucun devant un autre ton sur 257). Validé par le responsable (M19).'),
  PRESENT_SUBJECT: {
    id: 'D7-PRESENT-SUJET',
    ruleClass: 'A',
    ref: `${ESQUISSE}, §8.4.1 ex. (19) et (23), tableau 4 ; §8.7.4`,
    description: 'Présent avec « il », « elle », « ils », « elles » ou un nom sujet en tête de phrase : marque du sujet de la classe du nom + tə́ (1 àtə́, 2 bə́ꜜtə́, 3 úꜜtə́, 4 míꜜtə́, 5 ɛ́ꜜtə́, 6 mə́ꜜtə́, 7 íꜜtə́, 8 bíꜜtə́, 9 ìtə́, 10 íꜜtə́) + infinitif ; pronom ou nom sans classe (s.g, terme gardé) : accord par défaut àtə́ / bə́ꜜtə́. Validé par le responsable (M28).',
  },
  NEGATION_PRESENT: {
    id: 'D7-NEGATION-PRESENT',
    ruleClass: 'A',
    ref: `${ESQUISSE}, §8.7.9 (« àáꜜtə́ ꜜsá ») ; exemples de D7`,
    description: '« ne … pas » au présent : àá après la marque du sujet. Formes attestées seulement : màáꜜtə́ (je), wàátə́ (tu), àáꜜtə́ (il, elle, classe 1, s.g), bàáꜜtə́ (ils, elles, classe 2), byàáꜜtə́ (classe 8). Pas dans une relative (« que tu ne connais pas ») : forme non décrite. Validé par le responsable (M28).',
  },
  COPULA: {
    id: 'D7-ETRE-PRESENT',
    ruleClass: 'A',
    ref: `D7 nə̀ « être » (p. 200), sə́ « ne pas être » (p. 243) ; ${ESQUISSE}, §8.7.9 (171)`,
    description: '« être » au présent suivi d’un complément : marque du sujet + nə̀, en une forme (mə̀nə̀ je, ùnə̀ tu, ɛ̀nə̀ nous, ànə̀ il, elle, classe 1, s.g, bə́nə̂ ils, elles, classe 2, únə̂ cl. 3, mínə̂ cl. 4, ɛ́nə̂ cl. 5, mə́nə̂ cl. 6, ínə̂ cl. 7 et 10, bínə̂ cl. 8, ìnə̀ cl. 9) ; « ne … pas » : sə́ (mə̀sə́ je, àsə́ il, elle, classe 1, úꜜsə́ cl. 3, mə́sə́ cl. 6). Formes des exemples de D7 seulement. Hors règle : « vous », « c’est », relative (nə̌, esquisse (188)), être + participe, « être en train de », « être sur le point de », complément rendu par un verbe de D7. Validé par le responsable (M29).',
  },
  RELATIVE_SUBJECT: {
    id: 'D7-RELATIVE-SUJET',
    ruleClass: 'A',
    ref: `${ESQUISSE}, §8.4.2 (24), §8.8 (187) ; D7 p. 229 (« í mód àtə́ kwàm »), p. 190 (« ḿmú úꜜtə́ zù »)`,
    description: '« NOM qui VERBE » au présent : augment sur le nom + marque de la classe du nom + tə́ + infinitif, comme hors relative ; « qui » n’est pas traduit. Augment : préfixe voyelle ou nasale syllabique à ton bas → ton haut (ì-lə́ → í-lə́) ; m-òd → í mód (D7). Hors règle : autre préfixe (pont tonal non décrit), nom sans classe sûre ou au pluriel, nom gardé en français, « celui qui », « ce qui », « à qui », nom précédé d’un autre nom, négation, « qui est ». Validé par le responsable (M30).',
  },
  PURPOSE: {
    id: 'D7-POUR-SUBJONCTIF',
    ruleClass: 'A',
    ref: `D7 p. 77 (lexique n° 105, « àtə́ swàlbɔ̀ ású ádî » Il se cache pour manger) ; ${ESQUISSE}, §8.7.8 (166), (167)`,
    description: '« pour » + infinitif d’un verbe d’une syllabe : ású + subjonctif, avec « tu » sous-entendu : marque du sujet à ton haut ú, thème à ton descendant quel que soit son ton (dí → ádî, g͡bè → ág͡bê, tál → átâl, jə̀m → újə̂m ; « pour garder » → ású únây). Hors règle : verbe de plusieurs syllabes ou à voyelle longue (un seul exemple), à voyelle initiale, sans ton noté, « être », « avoir », « nom à + verbe ». Validé par le responsable (M32).',
  },
  PRESENT: rule('D7-PRESENT', 'B', '§3 Temps', 'MS-tə́ + infinitif : marque du sujet inconnue pour « vous » (aucun exemple), un nom sans classe sûre dans D7 ou un sujet non repéré en tête de phrase ; négation d’une classe sans forme attestée, avoir, quasi-auxiliaires et verbe suivi d’un infinitif non couverts ; « être » hors D7-ETRE-PRESENT (« vous », « c’est », relative, forme négative non attestée) ; « qui » hors D7-RELATIVE-SUJET (M19, M28, M29, M30).'),
  SUBJECT_MARKER: rule('D7-MARQUE-SUJET', 'B', '§2 Marques du sujet', '« nous » : ɛ̀ ou bì (seul ɛ̀tə́ est employé au présent) ; classes doubles du lexique (« 9/10, s.g ») non reliées à une marque.'),
  PAST_RECENT_PERFECTIVE: rule('D7-PASSE-RECENT-PERFECTIF', 'C', '§3 Temps', 'MS-H-thème(-H) : tons non documentés.'),
  PAST_RECENT_IMPERFECTIVE: rule('D7-PASSE-RECENT-IMPERFECTIF', 'C', '§3 Temps', 'MS-bə́ + infinitif de la forme G : forme G non documentée.'),
  FUTURE: rule('D7-FUTUR', 'C', '§3 Temps', 'MS-èèy + infinitif : fusion avec la marque du sujet non documentée.'),
  CONDITIONAL: rule('D7-CONDITIONNEL', 'C', '§3 Temps', 'Aucune règle du conditionnel dans D7.'),
  SUBJUNCTIVE: rule('D7-SUBJONCTIF', 'C', '§4 Subjonctif', 'Ton haut sur la marque du sujet : non documenté pour chaque marque.'),
  IMPERATIVE: rule('D7-IMPERATIF', 'C', '§4 Impératif', 'Ton haut flottant après la 1re syllabe du thème : non documenté pour chaque verbe.'),
  IMPERATIVE_PLURAL: rule('D7-IMPERATIF-PLURIEL', 'C', '§4 Impératif pluriel', 'Suffixe -(ə́)ŋgán(à) : forme exacte non documentée.'),
  NEGATION: rule('D7-NEGATION', 'C', '§4 Négation', 'àá après la marque du sujet : fusion non attestée pour « nous », « vous » et les classes 3 à 7, 9 et 10 ; « jamais », « plus », « rien »… et les autres temps non couverts.'),
  NEGATION_IMPERATIVE: rule('D7-NEGATION-IMPERATIF', 'B', '§4 Négation', 'Auxiliaire bə́ ꜜ + verbe : ton du verbe non documenté.'),
  RESTRICTION: rule('D7-RESTRICTION', 'C', '§4', 'Aucune règle de « ne … que » dans D7.'),
  PASSIVE: rule('D7-PASSIF', 'C', '§6 Dérivation', 'Suffixe -bàn : exemples seulement, pas une règle productive.'),
  POSTPOSITION: rule('D7-LOCATIF-APRES-NOM', 'B', '§7 (exemple « íꜜlə́ á sí » sous l’arbre)', 'Préposition française rendue par un adverbe de lieu de D7, placé après le nom : un exemple seulement.'),
  POSSESSIVE: rule('D7-POSSESSIF', 'C', '§8.6.2 de l’esquisse complète, tableaux 11 à 15', 'Possessif hors D7-POSSESSIF-CLASSE (M31) : « mes, tes, ses, nos, vos, leurs » (le moteur n’écrit pas le pluriel des noms), nom précédé ou suivi d’un adjectif, suivi d’un autre nom, de « de » ou d’un mot manquant, nom sans classe sûre ou sans ton final noté, antécédent de « qui », « mon » après un nom de classe 1 ou 9 à ton haut (aucun exemple).'),
  OBJECT_PRONOUN: rule('D7-PRONOM-OBJET', 'B', '§3 (exemple « mə̀tə́ wɔ̂ yɛ́n »)', 'Place et forme du pronom complément : un exemple seulement.'),
  AGREEMENT: rule('D7-ACCORD', 'C', 'lexique (radicaux liés « -… »)', 'Radical lié : préfixe d’accord non documenté.'),
  ADJECTIVE: rule('D7-NOM-ADJECTIF', 'B', '§7 (exemple « mə̀bwád mə́ bôd ») ; esquisse §8.6.3', 'Nom + adjectif hors D7-NOM-ADJECTIVAL-CLASSE (M33) : nom adjectival d’une classe sans forme sûre (3 : ton seul et nom adjectival modifié ; 1 : placé après le nom), écarté pour son sens, finissant par un ton descendant ou sans ton noté ; adjectif rendu par un adverbe ; nom à voyelle ou nasale initiale, au pluriel, sujet d’un verbe, antécédent de « qui », ou voisin d’un autre nom, adjectif, possessif ou « de » ; adverbe entre les deux.'),
  INFINITIVE: rule('D7-INFINITIF-PREPOSITION', 'C', 'lexique n° 105, n° 685 (exemple « ású ɲcígní ɲâg ») ; esquisse §8.7.8', 'Verbe après une préposition hors D7-POUR-SUBJONCTIF (M32) : « nom à + verbe » (« argent à envoyer », aucun exemple), verbe de plusieurs syllabes ou à voyelle longue (subjonctif : un seul exemple), « être », « avoir », autre préposition.'),
  NUMERAL: rule('D7-NOMBRE', 'C', '§1-7', 'Place et accord du nombre par rapport au nom : non documentés.'),
  CONNECTIVE: rule('D7-CONNECTIF', 'C', '§7', 'Connectif entre deux noms : premier nom gardé en français ou de classe sans forme sûre dans D7 (2, 3, 4, 3a, 6…), second nom à voyelle ou nasale initiale (fusion non documentée), ou noms juxtaposés sans « de » (M26).'),
  VERB_FORM: rule('D7-FORME-VERBALE', 'C', '§3 ; esquisse §8.5, §8.7.3, §8.7.6', 'Participe ou forme conjuguée : D7 ne donne que l’infinitif. Participe passé (« argent envoyé ») : source manquante, l’esquisse n’en décrit aucun (relative au passé avec un sujet que le français ne donne pas, tons du passé récent sur un seul exemple, passif -bàn sur trois exemples de sens différents) (M32).'),
} as const satisfies Record<string, EtonRule>;

/** Mots ignorés par une règle validée (grammar-rules.json, `ignoredWords`). */
export interface IgnoredWords {
  id: string;
  words: readonly string[];
  ref: string;
}

/**
 * Partitif supprimé (grammar-rules.json, `partitives`, M21) : « du », « de l' », « de la » juste après
 * un verbe et devant un nom de la liste fermée `nouns`. Ailleurs, « de » reste un manque.
 */
export interface Partitive {
  id: string;
  nouns: readonly string[];
  ref: string;
}

/**
 * Connectif (grammar-rules.json, `connectives`, M26) : « de », « du », « d' » entre deux noms rendu par la
 * forme de la classe du premier nom (D7). Ailleurs (classe absente de `forms`, premier nom gardé en
 * français), « de » reste un manque.
 */
export interface Connective {
  id: string;
  words: readonly string[];
  /** Classe nominale du premier nom au singulier (« 9 » pour « 9/10 », « s.g ») → forme éton. */
  forms: Readonly<Record<string, string>>;
  ref: string;
}

/**
 * Nom adjectival (grammar-rules.json, `adjectives`, M33) : nom + adjectif rendu par un nom adjectival de D7
 * placé en tête, suivi du connectif de sa classe, puis du nom (ì-túg í ndá « une maison délabrée »).
 */
export interface AdjectiveRule {
  id: string;
  /** Classe du nom adjectival au singulier (« 7 » pour « 7/8 ») → connectif. */
  forms: Readonly<Record<string, string>>;
  /** Formes de D7 écartées pour leur sens. */
  excluded: readonly string[];
  ref: string;
}

/**
 * Possessif (grammar-rules.json, `possessives`, M31) : « ton », « votre »… devant un nom au singulier, rendu
 * après le nom par la forme de la classe du nom (s.g et terme gardé : classe 1), selon le dernier ton du nom.
 */
export interface Possessive {
  id: string;
  persons: readonly {
    words: readonly string[];
    /** Nom finissant par un ton bas ou descendant, ou terme gardé en français : classe → forme. */
    afterLow: Readonly<Record<string, string>>;
    /** Nom finissant par un ton haut ou montant : classe → forme. */
    afterHigh: Readonly<Record<string, string>>;
  }[];
  ref: string;
}

export interface EtonOptions {
  guards?: readonly string[];
  lexicon?: Lexicon;
  /** Articles ignorés (règle validée en BM3.6). Sans cette option, les articles sont cherchés dans D7. */
  ignored?: readonly IgnoredWords[];
  /** Termes français gardés tels quels quand D7 ne les a pas (M20), employés comme noms. */
  kept?: readonly string[];
  /** Partitifs supprimés après un verbe (M21). */
  partitives?: readonly Partitive[];
  /** Connectifs entre deux noms (M26). */
  connectives?: readonly Connective[];
  /** Possessifs après le nom (M31). */
  possessives?: readonly Possessive[];
  /** Noms adjectivaux en tête (M33). */
  adjectives?: readonly AdjectiveRule[];
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
  /** FRENCH : terme français gardé (M20), `eto` est le texte français. */
  source: 'D7' | 'RULE' | 'PROTECTED' | 'PUNCT' | 'GRAMMAR' | 'MISSING' | 'FRENCH';
  ref: string | null;
  /** D7 : trouvé par la forme du texte ou par le lemme. */
  by?: 'FORM' | 'LEMMA';
  category?: string;
  /** Glose complète de l'entrée de D7. */
  gloss?: string;
  /** Sens de l'entrée : plusieurs sens ou une précision → mot signalé comme ambigu. */
  senses?: number;
  qualifier?: string | null;
  /** La clé est le sens premier de l'entrée (voir senseOf). */
  primary?: boolean;
  /** Mot français de plusieurs natures que le contexte ne départage pas → signalé comme ambigu. */
  homograph?: boolean;
  /** Ton bas flottant noté ꜜ devant la forme (présent, M19) ; `eto` reste la forme de D7. */
  downstep?: boolean;
  /** Forme écrite quand une règle change le mot (subjonctif, M32) ; `eto` reste la forme de D7. */
  form?: string;
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
  /** Termes français gardés dans la phrase (M20). */
  kept: string[];
  /**
   * Phrase incomplète seulement parce qu'aucun mot n'est rendu par D7 et que les termes gardés y sont seuls
   * (« Compte ») : elle serait complète si on acceptait du français seul. Signal pour le bilan (M25).
   */
  keptOnly: boolean;
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
  kept: string[];
  /** Incomplet, et chaque phrase incomplète l'est seulement faute de mot de D7 à côté des termes gardés (M25). */
  keptOnly: boolean;
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
  | { kind: 'DROP'; rule?: EtonRule }
  | { kind: 'PUNCT' | 'PROTECTED' | 'PARTICLE' | 'NEG' | 'RESTRICT' | 'SUBJECT' | 'AUXILIARY' | 'POSSESSIVE' | 'OBJECT' };

function wordAt(tokens: readonly Token[], i: number): Token | undefined {
  const t = tokens[i];
  return t?.kind === 'word' ? t : undefined;
}

/** Rôle de chaque jeton : mot à chercher dans D7, mot grammatical rendu par une règle, valeur protégée… */
function roles(s: SentenceAnalysis, lexicon: Lexicon | undefined, ignored: ReadonlySet<string>, partitives: readonly Partitive[] = []): Role[] {
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
  for (const p of partitives) {
    const rule: EtonRule = { id: p.id, ruleClass: 'A', ref: p.ref, description: 'Partitif après un verbe (« du », « de l’ », « de la ») : absent en éton.' };
    tokens.forEach((t, i) => {
      if (t.kind !== 'word' || out[i]?.kind !== 'LEX') return;
      const article = t.key === 'de' ? wordAt(tokens, i + 1) : undefined;
      const span = t.key === 'du' ? 1 : article && (article.key === "l'" || article.key === 'la') ? 2 : 0;
      const noun = wordAt(tokens, i + span);
      const before = out[i - 1]?.kind === 'VERB' || verbal(i - 1);
      if (span === 0 || !noun || !p.nouns.includes(noun.key) || !before) return;
      for (let k = i; k < i + span; k++) set(k, { kind: 'DROP', rule });
    });
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

/* ------------------------------------------------------------------ termes gardés (M20) */

const PARTICIPLES: ReadonlySet<string> = new Set(['PAST_PARTICIPLE', 'PRESENT_PARTICIPLE']);
const keptCache = new WeakMap<readonly string[], string[][]>();

/** Termes gardés découpés en mots, du plus long au plus court. */
function keptTerms(kept: readonly string[]): string[][] {
  let terms = keptCache.get(kept);
  if (!terms) {
    terms = kept.map((k) => normalize(k).tokens.filter((t) => t.kind === 'word').map((t) => t.key))
      .filter((w) => w.length > 0).sort((a, b) => b.length - a.length);
    keptCache.set(kept, terms);
  }
  return terms;
}

const nounLemmas = (key: string, lexicon: Lexicon | undefined): string[] =>
  (lexicon?.lookup(key) ?? []).filter((r) => r.pos === 'NOUN').map((r) => r.lemma.toLocaleLowerCase('fr'));

/** Le mot du texte est-il le mot du terme gardé (même forme ou même lemme de nom : « comptes » → « compte ») ? */
function sameNoun(key: string, word: string, lexicon: Lexicon | undefined): boolean {
  if (key === word) return true;
  const lemmas = new Set(nounLemmas(key, lexicon));
  return lemmas.has(word) || nounLemmas(word, lexicon).some((l) => lemmas.has(l));
}

/**
 * Terme gardé qui commence au mot i : seulement un mot plein employé comme nom (pas un participe :
 * « l'argent reçu » ≠ « le reçu »). Renvoie la fin du terme.
 */
function keptMatch(tokens: readonly Token[], i: number, roleList: readonly Role[], lexicon: Lexicon | undefined, terms: readonly string[][]): number | null {
  const role = roleList[i] as Role;
  if (role.kind !== 'LEX' || terms.length === 0) return null;
  const pos = contextPos(tokens, i, lexicon, role);
  if (pos.size > 0 && !pos.has('NOUN')) return null;
  const key = (tokens[i] as Token).key;
  if (pos.has('VERB') && (lexicon?.lookup(key) ?? []).some((r) => r.pos === 'VERB' && PARTICIPLES.has(r.mood ?? ''))) return null;
  for (const words of terms) {
    const ok = words.every((w, k) => {
      const t = wordAt(tokens, i + k);
      return t !== undefined && roleList[i + k]?.kind === 'LEX' && sameNoun(t.key, w, lexicon);
    });
    if (ok) return i + words.length;
  }
  return null;
}

/* ------------------------------------------------------------------ phrase */

/**
 * Marques du sujet + tə́ des pronoms. « je », « tu », « nous » : D7 (§2, §3, M19) ; « nous » : ɛ̀tə́ (4 exemples),
 * bìtə́ seulement avec yì « vouloir ». « il », « elle », « ils », « elles » : accord par défaut (esquisse ex. 23, M28).
 */
const PRESENT_SUBJECTS: Readonly<Record<string, string>> = {
  je: 'mə̀tə́', "j'": 'mə̀tə́', tu: 'ùtə́', nous: 'ɛ̀tə́', il: 'àtə́', elle: 'àtə́', ils: 'bə́ꜜtə́', elles: 'bə́ꜜtə́',
};
/** « ne … pas » au présent (esquisse §8.7.9) : formes des exemples de D7 seulement (M28). */
const NEGATIVE_SUBJECTS: Readonly<Record<string, string>> = {
  je: 'màáꜜtə́', "j'": 'màáꜜtə́', tu: 'wàátə́', il: 'àáꜜtə́', elle: 'àáꜜtə́', ils: 'bàáꜜtə́', elles: 'bàáꜜtə́',
};
const PRONOUN_PRESENT: ReadonlySet<string> = new Set(['je', "j'", 'tu', 'nous']);
/** Marque du sujet + tə́ de chaque classe (esquisse §8.4.1 ex. 19, tableau 4) et négation attestée (M28). */
const CLASS_PRESENT: Readonly<Record<string, string>> = {
  1: 'àtə́', 2: 'bə́ꜜtə́', 3: 'úꜜtə́', 4: 'míꜜtə́', 5: 'ɛ́ꜜtə́', 6: 'mə́ꜜtə́', 7: 'íꜜtə́', 8: 'bíꜜtə́', 9: 'ìtə́', 10: 'íꜜtə́',
};
const CLASS_NEGATIVE: Readonly<Record<string, string>> = { 1: 'àáꜜtə́', 2: 'bàáꜜtə́', 8: 'byàáꜜtə́' };
/** « être » au présent : marque du sujet + nə̀, et négatif sə́ (D7 nə̀, sə́ ; esquisse (171)), formes des exemples de D7 (M29). */
const COPULA_SUBJECTS: Readonly<Record<string, string>> = {
  je: 'mə̀nə̀', tu: 'ùnə̀', nous: 'ɛ̀nə̀', il: 'ànə̀', elle: 'ànə̀', ils: 'bə́nə̂', elles: 'bə́nə̂',
};
const COPULA_NEGATIVE_SUBJECTS: Readonly<Record<string, string>> = { je: 'mə̀sə́', il: 'àsə́', elle: 'àsə́' };
const CLASS_COPULA: Readonly<Record<string, string>> = {
  1: 'ànə̀', 2: 'bə́nə̂', 3: 'únə̂', 4: 'mínə̂', 5: 'ɛ́nə̂', 6: 'mə́nə̂', 7: 'ínə̂', 8: 'bínə̂', 9: 'ìnə̀', 10: 'ínə̂',
};
const CLASS_COPULA_NEGATIVE: Readonly<Record<string, string>> = { 1: 'àsə́', 3: 'úꜜsə́', 6: 'mə́sə́' };
const SINGULAR_CLASSES: ReadonlySet<string> = new Set(['1', '3', '5', '7', '9']);
const CONNECTIVE_WORDS: ReadonlySet<string> = new Set(['de', 'du', "d'", 'des']);
/** Mots qui peuvent ouvrir une relative : la négation en àá ne vaut que hors relative (esquisse §8.7.9). */
const RELATIVE_WORDS: ReadonlySet<string> = new Set(['que', "qu'", 'qui', 'où', 'dont', 'lequel', 'laquelle', 'lesquels', 'lesquelles',
  'auquel', 'auxquels', 'auxquelles', 'duquel', 'desquels', 'desquelles']);
/** Être, avoir et verbes à valeur de quasi-auxiliaire (D7 §5 : « ànə̀ kɔ̀m », « bìtə́ yì nâ ») : construction propre. */
const PRESENT_EXCLUDED: ReadonlySet<string> = new Set(['être', 'avoir', 'pouvoir', 'vouloir', 'devoir', 'falloir', 'aller', 'savoir']);
/** Augment attesté dans D7 pour un nom dont le préfixe n'est ni voyelle ni nasale (pont tonal, M30). */
const AUGMENT_ATTESTED: Readonly<Record<string, string>> = { 'm-òd': 'í mód' };

/**
 * Nom avec l'augment d'une relative (esquisse §8.4.2) : ton haut flottant sur un préfixe voyelle ou nasale
 * syllabique à ton bas (ì-lə́ → í-lə́, m̀-mú → ḿ-mú), ou forme attestée dans D7. null ailleurs (M30).
 */
export function augmented(eto: string): string | null {
  const attested = AUGMENT_ATTESTED[eto];
  if (attested !== undefined) return attested;
  const d = eto.normalize('NFD');
  const m = /^([aeiouɛəɔmnŋɲ])\u0300-/u.exec(d);
  return m ? `${m[1] as string}\u0301-${d.slice(m[0].length)}`.normalize('NFC') : null;
}

/**
 * Classe d'accord d'un nom sujet d'après sa classe dans D7 : « 7/8 » → 7, « 3a/6 » → 3, nom sans genre (s.g) →
 * accord par défaut 1 (esquisse ex. 23). Au pluriel, seulement si la forme de D7 est déjà celle du pluriel
 * (9/10 : même forme ; nom d'une seule classe de pluriel, « 6 » mə̀-ndím) : le moteur n'écrit pas encore le
 * pluriel des noms (bə̀-, bɔ̀…). null si la classe n'est pas sûre (« 9/10, s.g »).
 */
export function subjectClass(nounClass: string, plural: boolean): string | null {
  const parts = nounClass.split('/').map((x) => x.trim().replace(/^(\d+)[au]$/u, '$1').replace(/^s\.g\.?$/u, 's.g'));
  if (parts.length > 2 || parts.some((x) => x !== 's.g' && !(x in CLASS_PRESENT))) return null;
  const [singular, pluralClass] = parts as [string, string | undefined];
  if (!plural) return singular === 's.g' ? '1' : singular;
  if (pluralClass === undefined) return singular === 's.g' || SINGULAR_CLASSES.has(singular) ? null : singular;
  return singular === '9' && pluralClass === '10' ? '10' : null;
}

/**
 * Dernier ton d'une forme de D7 (M31) : haut pour á, ǎ ; bas pour à, â (le ton descendant finit bas).
 * null si la dernière voyelle n'a pas de ton noté.
 */
export function finalTone(eto: string): 'HIGH' | 'LOW' | null {
  const m = /([aeiouɛəɔ])(\p{Mn}*)[^aeiouɛəɔ]*$/iu.exec(eto.normalize('NFD'));
  const marks = m?.[2] ?? '';
  if (marks === '\u0301' || marks === '\u030C') return 'HIGH';
  if (marks === '\u0300' || marks === '\u0302') return 'LOW';
  return null;
}

/**
 * Subjonctif avec « tu » d'un verbe d'une syllabe (M32) : ú + thème à ton descendant (dí → údî).
 * null pour un verbe de plusieurs syllabes, à voyelle longue ou initiale, ou sans ton noté.
 */
export function subjunctiveTu(eto: string): string | null {
  const d = eto.normalize('NFD');
  const vowels = [...d.matchAll(/[aeiouɛəɔ]/giu)];
  const v = vowels[0];
  if (/\s/u.test(d) || vowels.length !== 1 || v === undefined || !consonantInitial(eto)) return null;
  const at = v.index + v[0].length;
  const marks = /^\p{Mn}*/u.exec(d.slice(at))?.[0] ?? '';
  if (!['\u0301', '\u0300', '\u0302', '\u030C'].includes(marks)) return null;
  return `ú${d.slice(0, at)}\u0302${d.slice(at + marks.length)}`.normalize('NFC');
}

/** Verbe au présent rendu par MS-tə́ + infinitif. */
interface PresentPlan {
  /** Indice du pronom sujet, ou null : nom sujet en tête de phrase, dont la classe est lue à la construction. */
  subject: number | null;
  plural: boolean;
  /** Indices de « ne » et « pas » rendus par la négation, ou null. */
  negation: readonly [number, number] | null;
  /** « être » : une seule forme sujet + nə̀ (ou sə́), sans infinitif (M29). */
  copula: boolean;
  /** Indice de « qui » sujet d'une relative, dont l'antécédent est lu à la construction (M30), ou null. */
  relative: number | null;
}

/** Nombre d'un verbe au présent de la 3e personne (Lefff) ; null s'il est inconnu ou ambigu. */
function verbPlural(key: string, lexicon: Lexicon | undefined): boolean | null {
  const numbers = new Set((lexicon?.lookup(key) ?? [])
    .filter((r) => (r.pos === 'VERB' || r.pos === 'AUX') && r.mood === 'INDICATIVE' && r.tense === 'PRESENT' && r.persons.includes(3))
    .map((r) => r.number));
  const [n] = numbers;
  return numbers.size === 1 && n ? n === 'PLURAL' : null;
}

const VOWELS = new Set('aeiouɛɔəAEIOUƐƆƏ');
const NASALS = new Set('mnŋMNŊ');

/** Premier porteur de ton de la forme éton : ton haut seul (accent aigu) ? */
export function highInitial(eto: string): boolean {
  const chars = [...eto.normalize('NFD')];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] as string;
    let j = i + 1;
    const marks: string[] = [];
    while (j < chars.length && /\p{M}/u.test(chars[j] as string)) marks.push(chars[j++] as string);
    const toned = marks.some((m) => '\u0300\u0301\u0302\u030C'.includes(m));
    if (VOWELS.has(c) || (NASALS.has(c) && toned)) return marks.includes('\u0301') && !marks.some((m) => '\u0300\u0302\u030C'.includes(m));
  }
  return false;
}

/**
 * Verbes au présent rendus par MS-tə́ + infinitif : sujet pronom juste avant le verbe (« je », « il »…), ou nom
 * sujet en tête de phrase quand la phrase n'a pas de pronom sujet. « ne … pas » autour du verbe, seule négation
 * de la phrase et hors relative (« que tu ne connais pas »), est rendu avec la marque négative (M28).
 */
function presentVerbs(s: SentenceAnalysis, roleList: readonly Role[], lexicon: Lexicon | undefined): Map<number, PresentPlan> {
  const out = new Map<number, PresentPlan>();
  const { tokens } = s;
  if (s.restriction) return out;
  const negation = negationIndices(tokens);
  const subjectPronoun = roleList.some((r) => r.kind === 'SUBJECT');
  for (const v of s.finiteVerbs) {
    const role = roleList[v.index];
    const copula = v.features?.lemma === 'être';
    if (role?.kind !== 'VERB' || role.finite !== v.index || (PRESENT_EXCLUDED.has(v.features?.lemma ?? '') && !copula)) continue;
    const { rules, irregular } = verbRules(s, v.index, lexicon);
    if (irregular || rules.length !== 1 || rules[0] !== ETON_RULES.PRESENT) continue;
    const ne = wordAt(tokens, v.index - 1);
    const negative = ne !== undefined && NE.has(ne.key) && wordAt(tokens, v.index + 1)?.key === 'pas'
      && negation.size === 2 && negation.has(v.index - 1) && negation.has(v.index + 1);
    if (negation.size > 0 && !negative) continue;
    // « Je viens payer », « tu viens le faire » : verbe suivi d'un infinitif, construction non décrite.
    let j = v.index + 1;
    while (roleList[j]?.kind === 'OBJECT' || (wordAt(tokens, j) && (lexicon?.lookup((tokens[j] as Token).key) ?? []).some((r) => r.pos === 'ADV'))) j++;
    const next = wordAt(tokens, j);
    if (next && (lexicon?.lookup(next.key) ?? []).some((r) => r.pos === 'VERB' && r.mood === 'INFINITIVE')) continue;
    // « être en train de », « être sur le point de » : périphrases d'aspect, pas « être » + complément.
    const after = [1, 2, 3].map((k) => wordAt(tokens, v.index + (negation.has(v.index + 1) ? 1 : 0) + k)?.key).join(' ');
    if (copula && (after.startsWith('en train') || after === 'sur le point')) continue;
    const before = v.index - (negative ? 2 : 1);
    const subject = wordAt(tokens, before);
    const neg = negative ? [v.index - 1, v.index + 1] as const : null;
    const forms = copula ? COPULA_SUBJECTS : PRESENT_SUBJECTS;
    const negatives = copula ? COPULA_NEGATIVE_SUBJECTS : NEGATIVE_SUBJECTS;
    if (subject && !subject.enclitic && roleList[before]?.kind === 'SUBJECT' && subject.key in forms) {
      // « être » dans une relative a une forme propre (nə̌, esquisse (188)) : pas de forme non relative.
      const relative = RELATIVE_WORDS.has(wordAt(tokens, before - 1)?.key ?? '') && roleList[before - 1]?.kind !== 'PARTICLE';
      if ((!negative || (subject.key in negatives && !relative)) && !(copula && relative)) {
        out.set(v.index, { subject: before, plural: subject.key === 'ils' || subject.key === 'elles', negation: neg, copula, relative: null });
      }
    } else if (subject?.key === 'qui' && roleList[before]?.kind === 'LEX') {
      // « La personne qui envoie » (M30) : sans négation ni « être » (formes relatives non attestées dans D7).
      const plural = verbPlural(v.key, lexicon);
      if (plural === false && !negative && !copula) out.set(v.index, { subject: null, plural, negation: null, copula, relative: before });
    } else if (subject && !subjectPronoun && roleList[before]?.kind === 'LEX' && !RELATIVE_WORDS.has(subject.key)) {
      const plural = verbPlural(v.key, lexicon);
      if (plural !== null) out.set(v.index, { subject: null, plural, negation: neg, copula, relative: null });
    }
  }
  return out;
}

/**
 * Classe d'accord du nom sujet en tête de phrase (M28) : premier nom (après adjectifs et possessifs),
 * suivi seulement de noms, d'adjectifs, de « de » ou d'un possessif. Terme gardé : sans genre (s.g).
 */
function nounSubjectClass(pieces: readonly EtonPiece[], grammar: ReadonlyMap<EtonPiece, Role['kind']>,
  nounClasses: ReadonlyMap<EtonPiece, string>, plural: boolean): string | null {
  const np = pieces.filter((p) => !(p.source === 'RULE' && p.fr === '') && grammar.get(p) !== 'NEG');
  const lexical = (p: EtonPiece): boolean => p.source === 'D7' || p.source === 'FRENCH';
  let k = 0;
  while (np[k] && ((lexical(np[k] as EtonPiece) && np[k]?.category === 'ADJ') || grammar.get(np[k] as EtonPiece) === 'POSSESSIVE')) k++;
  const head = np[k];
  if (!head || !lexical(head) || head.category !== 'NOM') return null;
  const nounClass = head.source === 'FRENCH' ? 's.g' : nounClasses.get(head);
  const rest = np.slice(k + 1).every((p) => (lexical(p) && (p.category === 'NOM' || p.category === 'ADJ'))
    || (p.source === 'MISSING' && CONNECTIVE_WORDS.has(p.fr.toLocaleLowerCase('fr').replace(/’/gu, "'")))
    || grammar.get(p) === 'POSSESSIVE');
  return nounClass === undefined || !rest ? null : subjectClass(nounClass, plural);
}

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

/** Dernier ton descendant (â, ou voyelle longue á + à) : le nom adjectival change alors de forme en tête (M33). */
function fallingFinal(eto: string): boolean {
  const d = eto.normalize('NFD');
  return /\u0302[^aeiouɛəɔ]*$/iu.test(d) || /[aeiouɛəɔ]\u0301[aeiouɛəɔ]\u0300[^aeiouɛəɔ]*$/iu.test(d);
}

/** Nom et adjectif français au singulier d'après Lefff : un mot au pluriel seulement l'exclut (M33). */
function singular(words: readonly string[], lexicon: Lexicon | undefined): boolean {
  if (!lexicon) return false;
  let known = false;
  for (const w of words) {
    const numbers = new Set(lexicon.lookup(w.toLocaleLowerCase('fr')).filter((r) => r.pos === 'NOUN' || r.pos === 'ADJ').map((r) => r.number));
    if (numbers.has('PLURAL') && !numbers.has('SINGULAR')) return false;
    if (numbers.has('SINGULAR')) known = true;
  }
  return known;
}

/**
 * Second nom du connectif commençant par une consonne ordinaire (M26). Devant une voyelle ou une nasale
 * syllabique, D7 n'écrit pas le connectif à part : son ton se fond dans le nom (ìkǔm í mbâz « souche de
 * maïs », mais ìkùm ílə́ « souche d'arbre », n° 890 ; ǹtùdà ḿmûŋ, n° 2173), fusion non documentée.
 */
function consonantInitial(form: string): boolean {
  const d = form.normalize('NFD').toLocaleLowerCase('fr');
  const first = d[0] ?? '';
  if (/[aeiouɛəɔ]/u.test(first)) return false;
  return !(/[mnŋɲ]/u.test(first) && /\p{Mn}/u.test(d[1] ?? ''));
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

/**
 * Construit la phrase éton d'une phrase française analysée. `keptAlone` (interne) : accepter une phrase
 * sans mot de D7, pour savoir si les termes gardés seuls sont le seul manque (`keptOnly`).
 */
export function buildSentence(s: SentenceAnalysis, d7: D7Index, options: EtonOptions = {}, keptAlone = false): EtonSentence {
  const { tokens } = s;
  const { lexicon } = options;
  const ignoredWords = new Set((options.ignored ?? []).flatMap((g) => g.words));
  const roleList = roles(s, lexicon, ignoredWords, options.partitives);
  const present = presentVerbs(s, roleList, lexicon);
  const subjects = new Map<number, EtonPiece>();
  /** Rôle des mots grammaticaux, et « ne », « pas » rendus par la négation du présent (M28). */
  const grammar = new Map<EtonPiece, Role['kind']>();
  const negPieces = new Map<number, EtonPiece>();
  const renderedNegation = new Set<number>();
  /** « être » rendu par une forme sujet + nə̀ (M29), confirmé après la phrase s'il a un complément. */
  const copulas: { piece: EtonPiece; subject: EtonPiece | undefined; plan: PresentPlan }[] = [];
  /** « qui » sujet d'une relative (M30) : indice de « qui », puis antécédent et forme lus à la construction. */
  const relativeWords = new Set([...present.values()].flatMap((p) => (p.relative === null ? [] : [p.relative])));
  const relatives = new Map<number, { piece: EtonPiece; antecedent: EtonPiece; augment: string; form: string }>();
  /** Noms dont la classe porte un accord (sujet, antécédent de « qui ») : pas de nom adjectival en tête (M33). */
  const agreeing = new Set<EtonPiece>();
  /** Possessifs (M31), placés après leur nom une fois la phrase construite. */
  const possessivePieces = new Map<EtonPiece, string>();
  /** Nom de D7 rendu, par indice du jeton qui le suit. */
  const endAt = new Map<number, EtonPiece>();
  const pieces: EtonPiece[] = [];
  const gaps: Gap[] = [];
  const applied = new Set<EtonRule>();
  const terms = keptTerms(options.kept ?? []);
  let found = 0;
  let total = 0;
  /** Jetons rendus par une entrée de D7 (une expression peut contenir « rien »). */
  const consumed = new Set<number>();
  /** Classe nominale de D7 des noms rendus, et manque de chaque mot absent (connectif, M26). */
  const nounClasses = new Map<EtonPiece, string>();
  const wordGaps = new Map<EtonPiece, Gap>();
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
        if (role.rule) applied.add(role.rule);
        else if (g) applied.add({ id: g.id, ruleClass: 'A', ref: g.ref, description: 'Mot ignoré : l’éton n’a pas d’article.' });
        i++;
        continue;
      }
      case 'PARTICLE':
        i++;
        continue;
      case 'NEG':
      case 'RESTRICT':
      case 'SUBJECT':
      case 'AUXILIARY': {
        const piece: EtonPiece = { fr: t.text, eto: null, source: 'GRAMMAR', ref: null };
        if (role.kind === 'SUBJECT') subjects.set(i, piece);
        if (role.kind === 'NEG') negPieces.set(i, piece);
        grammar.set(piece, role.kind);
        pieces.push(piece);
        i++;
        continue;
      }
      case 'POSSESSIVE':
      case 'OBJECT': {
        const piece: EtonPiece = { fr: t.text, eto: null, source: 'GRAMMAR', ref: null };
        grammar.set(piece, role.kind);
        pieces.push(piece);
        if (role.kind === 'POSSESSIVE') possessivePieces.set(piece, t.key);
        else gap(t.text, ETON_RULES.OBJECT_PRONOUN);
        i++;
        continue;
      }
      default:
        break;
    }

    // « qui » sujet (M30) : nom de D7 juste avant, tête de son groupe, de classe sûre au singulier, avec augment sûr.
    if (relativeWords.has(i)) {
      const a = endAt.get(i);
      const prev = a === undefined ? undefined : pieces[pieces.indexOf(a) - 1];
      const nounClass = a === undefined ? undefined : nounClasses.get(a);
      const c = nounClass === undefined || nounClass.includes('s.g') ? null : subjectClass(nounClass, false);
      const augment = a?.eto ? augmented(a.eto) : null;
      const form = c === null ? undefined : CLASS_PRESENT[c];
      // Augment et possessif ensemble (« ton arbre qui… ») : aucun exemple.
      const headed = !prev || !(prev.category === 'NOM' || grammar.get(prev) === 'POSSESSIVE' || (prev.source === 'MISSING' && CONNECTIVE_WORDS.has(prev.fr.toLocaleLowerCase('fr').replace(/’/gu, "'"))));
      if (a && a === pieces[pieces.length - 1] && augment && form && headed) {
        const piece: EtonPiece = { fr: t.text, eto: null, source: 'GRAMMAR', ref: null };
        relatives.set(i, { piece, antecedent: a, augment, form });
        agreeing.add(a);
        pieces.push(piece);
        i++;
        continue;
      }
    }

    // Mot plein (ou verbe).
    total++;
    let marker: { piece: EtonPiece; form: string; rule: EtonRule; insert: boolean; plan: PresentPlan; augment?: { piece: EtonPiece; form: string } } | undefined;
    if (role.kind === 'VERB' && role.finite !== null) {
      const plan = present.get(i);
      if (plan?.copula) {
        const key = plan.subject === null ? null : (tokens[plan.subject] as Token).key;
        const c = key === null ? nounSubjectClass(pieces, grammar, nounClasses, plan.plural) : null;
        if (c !== null) for (const p of pieces) agreeing.add(p);
        const form = key !== null ? (plan.negation ? COPULA_NEGATIVE_SUBJECTS : COPULA_SUBJECTS)[key]
          : c === null ? undefined : (plan.negation ? CLASS_COPULA_NEGATIVE : CLASS_COPULA)[c];
        if (form) {
          const piece: EtonPiece = { fr: t.text, eto: form, source: 'RULE', ref: ETON_RULES.COPULA.ref };
          copulas.push({ piece, subject: plan.subject === null ? undefined : subjects.get(plan.subject), plan });
          pieces.push(piece);
          found++;
          i++;
          continue;
        }
      }
      const rel = plan?.relative == null ? undefined : relatives.get(plan.relative);
      if (plan?.relative != null) {
        if (rel) marker = { piece: rel.piece, form: rel.form, rule: ETON_RULES.RELATIVE_SUBJECT, insert: false, plan, augment: { piece: rel.antecedent, form: rel.augment } };
      } else if (plan?.subject != null && !plan.copula) {
        const key = (tokens[plan.subject] as Token).key;
        const piece = subjects.get(plan.subject);
        const form = (plan.negation ? NEGATIVE_SUBJECTS : PRESENT_SUBJECTS)[key];
        const r = PRONOUN_PRESENT.has(key) ? ETON_RULES.PRESENT_PRONOUN : ETON_RULES.PRESENT_SUBJECT;
        if (piece && form) marker = { piece, form, rule: r, insert: false, plan };
      } else if (plan && !plan.copula) {
        const c = nounSubjectClass(pieces, grammar, nounClasses, plan.plural);
        if (c !== null) for (const p of pieces) agreeing.add(p);
        const form = c === null ? undefined : (plan.negation ? CLASS_NEGATIVE : CLASS_PRESENT)[c];
        if (form) marker = { piece: { fr: '', eto: null, source: 'RULE', ref: null }, form, rule: ETON_RULES.PRESENT_SUBJECT, insert: true, plan };
      }
      const { rules, irregular } = verbRules(s, role.finite, lexicon);
      if (irregular) {
        pieces.push({ fr: t.text, eto: irregular, source: 'RULE', ref: ETON_RULES.IMPERATIVE_IRREGULAR.ref });
        applied.add(ETON_RULES.IMPERATIVE_IRREGULAR);
        found++;
        i++;
        continue;
      }
      for (const r of rules) if (!(marker && r === ETON_RULES.PRESENT)) gap(t.text, r);
    }
    const hit = lookup(tokens, i, roleList, d7, lexicon);
    if (marker && !(hit && hit.end === i + 1 && hit.choice.entry.category === 'VERBE' && !isBoundForm(hit.choice.entry.eto))) {
      gap(t.text, ETON_RULES.PRESENT);
      marker = undefined;
    }
    // Terme gardé en français (M20) : D7 passe avant, sauf expression plus courte ou verbe pour un nom.
    const keep = keptMatch(tokens, i, roleList, lexicon, terms);
    if (keep !== null && (!hit || keep > hit.end || (keep === hit.end && ['VERBE', 'AUX'].includes(hit.choice.entry.category)))) {
      const text = tokens.slice(i, keep).map((x) => x.text).join(' ');
      pieces.push({ fr: text, eto: text, source: 'FRENCH', ref: null, category: 'NOM' });
      i = keep;
      continue;
    }
    const fr = tokens.slice(i, hit?.end ?? i + 1).map((x) => x.text).join(' ');
    if (!hit) {
      const missing: EtonPiece = { fr, eto: null, source: 'MISSING', ref: null };
      const rejected = d7.get(t.key).map((x) => ({ eto: x.eto, category: x.category, ref: x.ref }));
      const wordGap: Gap = { kind: 'WORD', fr, rejected };
      pieces.push(missing);
      gaps.push(wordGap);
      wordGaps.set(missing, wordGap);
      i++;
      continue;
    }
    const { entry, alternatives } = hit.choice;
    const { senses, qualifier, primary } = senseOf(entry, hit.key);
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
      primary,
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
    if (marker) {
      marker.piece.eto = marker.form;
      marker.piece.source = 'RULE';
      marker.piece.ref = (marker.plan.negation ? ETON_RULES.NEGATION_PRESENT : marker.rule).ref;
      if (highInitial(entry.eto)) piece.downstep = true;
      applied.add(marker.rule);
      if (marker.plan.negation) {
        for (const k of marker.plan.negation) renderedNegation.add(k);
        applied.add(ETON_RULES.NEGATION_PRESENT);
      }
      if (marker.augment) marker.augment.piece.eto = marker.augment.form;
      if (marker.insert) pieces.push(marker.piece);
    }
    if ((entry.category === 'NOM' || entry.category === 'ADJ') && entry.nounClass) nounClasses.set(piece, entry.nounClass);
    if (entry.category === 'NOM') endAt.set(hit.end, piece);
    pieces.push(piece);
    i = hit.end;
  }

  // « être » (M29) : il faut un complément qui ne soit pas un verbe de D7 (« être rapide » : vóló), sinon manque.
  for (const { piece, subject, plan } of copulas) {
    const next = pieces.slice(pieces.indexOf(piece) + 1).find((p) => grammar.get(p) !== 'NEG');
    if (next && next.source !== 'PUNCT' && !(next.source === 'D7' && (next.category === 'VERBE' || next.category === 'AUX'))) {
      if (subject) pieces.splice(pieces.indexOf(subject), 1);
      applied.add(ETON_RULES.COPULA);
      if (plan.negation) for (const k of plan.negation) renderedNegation.add(k);
    } else {
      piece.eto = null;
      piece.source = 'GRAMMAR';
      piece.ref = null;
      found--;
      gap(piece.fr, ETON_RULES.PRESENT);
    }
  }

  // « ne » et « pas » rendus par la marque négative du présent : plus de mot à part.
  for (const k of renderedNegation) {
    const p = negPieces.get(k);
    if (p) pieces.splice(pieces.indexOf(p), 1);
  }

  // Phrase sans aucun mot rendu par D7 (« Code PIN ») : les termes gardés redeviennent des manques,
  // pour ne pas présenter du français comme une traduction.
  const keptWithoutD7 = found === 0 && pieces.some((p) => p.source === 'FRENCH');
  if (keptWithoutD7 && !keptAlone) {
    for (const p of pieces) {
      if (p.source !== 'FRENCH') continue;
      p.source = 'MISSING';
      p.eto = null;
      delete p.category;
      gaps.push({ kind: 'WORD', fr: p.fr, rejected: [] });
    }
  }

  // Possessif (M31) : après un nom au singulier rendu (D7 ou terme gardé), forme de la classe et du dernier ton du nom.
  const possessiveRules = new Map<Possessive, EtonRule>();
  for (const [p, key] of possessivePieces) {
    const k = pieces.indexOf(p);
    const noun = pieces[k + 1];
    const after = pieces[k + 2];
    const def = (options.possessives ?? []).find((x) => x.persons.some((y) => y.words.includes(key)));
    const person = def?.persons.find((y) => y.words.includes(key));
    const isNoun = noun !== undefined && noun.category === 'NOM' && noun.eto !== null && (noun.source === 'D7' || noun.source === 'FRENCH');
    // Après le nom : seulement une fin de phrase, un verbe ou un mot qui n'est ni nom, ni adjectif, ni nombre, ni « de ».
    const free = after === undefined || after.source === 'PUNCT' || after.source === 'RULE' || after.source === 'GRAMMAR'
      || (after.source === 'D7' && !['NOM', 'ADJ', 'NUM'].includes(after.category ?? '')
        && !(lexicon?.lookup(after.fr.toLocaleLowerCase('fr')) ?? []).some((r) => r.pos === 'ADJ' || r.pos === 'NOUN'));
    const nounClass = !isNoun ? null : noun.source === 'FRENCH' ? '1' : ((c) => (c === undefined ? null : subjectClass(c, false)))(nounClasses.get(noun));
    const tone = !isNoun ? null : noun.source === 'FRENCH' ? 'LOW' : finalTone(noun.eto as string);
    const form = nounClass === null || tone === null || !person || !free || CONNECTIVE_WORDS.has(after?.fr.toLocaleLowerCase('fr').replace(/’/gu, "'") ?? '')
      ? undefined : (tone === 'HIGH' ? person.afterHigh : person.afterLow)[nounClass];
    if (!def || form === undefined) {
      gap(p.fr, ETON_RULES.POSSESSIVE);
      continue;
    }
    p.eto = form;
    p.source = 'RULE';
    p.ref = def.ref;
    pieces.splice(k, 1);
    pieces.splice(k + 1, 0, p);
    let r = possessiveRules.get(def);
    if (!r) {
      r = { id: def.id, ruleClass: 'A', ref: def.ref, description: 'Possessif après le nom : forme de la classe du nom et de son dernier ton.' };
      possessiveRules.set(def, r);
    }
    applied.add(r);
  }

  // « de » entre deux noms (M26) : forme de la classe du premier nom, rendu par D7 avec sa classe.
  const connectiveRules = new Map<Connective, EtonRule>();
  for (let k = 1; k + 1 < pieces.length; k++) {
    const p = pieces[k] as EtonPiece;
    const a = pieces[k - 1] as EtonPiece;
    const b = pieces[k + 1] as EtonPiece;
    if (p.source !== 'MISSING' || a.source !== 'D7' || a.eto === null || a.category !== 'NOM') continue;
    if (!(b.source === 'D7' || b.source === 'FRENCH') || b.eto === null || b.category !== 'NOM' || !consonantInitial(b.eto)) continue;
    // Second nom avec un possessif (« le prix de ton argent ») : aucun exemple.
    const n = pieces[k + 2];
    if (n !== undefined && grammar.get(n) === 'POSSESSIVE') continue;
    const key = p.fr.toLocaleLowerCase('fr').replace(/’/gu, "'");
    const nounClass = nounClasses.get(a)?.split('/')[0];
    const c = nounClass === undefined ? undefined : (options.connectives ?? []).find((x) => x.words.includes(key) && x.forms[nounClass] !== undefined);
    if (c === undefined || nounClass === undefined) continue;
    p.eto = c.forms[nounClass] as string;
    p.source = 'RULE';
    p.ref = c.ref;
    const g = wordGaps.get(p);
    if (g) gaps.splice(gaps.indexOf(g), 1);
    let r = connectiveRules.get(c);
    if (!r) {
      r = { id: c.id, ruleClass: 'A', ref: c.ref, description: 'Connectif « de » entre deux noms : forme de la classe du premier nom.' };
      connectiveRules.set(c, r);
    }
    applied.add(r);
    found++;
  }

  // Traits de la phrase.
  const negation = [...negationIndices(tokens)].filter((k) => !consumed.has(k) && !renderedNegation.has(k));
  if (negation.length > 0) gap(negation.map((k) => (tokens[k] as Token).key).join(' '), s.type === 'IMPERATIVE' ? ETON_RULES.NEGATION_IMPERATIVE : ETON_RULES.NEGATION);
  if (s.restriction) gap('ne … que', ETON_RULES.RESTRICTION);
  const lexical = pieces.filter((p) => p.source === 'D7' || p.source === 'MISSING' || p.source === 'FRENCH');
  // Un terme gardé est un nom : « frais » + adjectif de D7 demande aussi la règle d'accord.
  const rendered = (p: EtonPiece | undefined): p is EtonPiece => p !== undefined && (p.source === 'D7' || p.source === 'FRENCH');
  // Adjectif français rendu par un adverbe de D7 (« petit » → cə̀càd « petit, peu ») : même règle qu'un adjectif.
  const adjectival = (p: EtonPiece): boolean => p.category === 'ADJ' || (p.category === 'ADV' && !p.fr.includes(' ')
    && (lexicon?.lookup(p.fr.toLocaleLowerCase('fr')) ?? []).some((r) => r.pos === 'ADJ'));
  // Nom adjectival en tête (M33) : « ì-túg í ndá » (maison délabrée) ; ailleurs, l'adjectif reste un manque.
  const headed = new Set<EtonPiece>();
  const adjectiveRules = new Map<AdjectiveRule, EtonRule>();
  for (const p of [...pieces]) {
    if (p.source !== 'D7' || p.category !== 'ADJ' || p.eto === null || /\s/u.test(p.eto) || fallingFinal(p.eto) || finalTone(p.eto) === null) continue;
    const nounClass = nounClasses.get(p)?.split('/')[0];
    const eto = p.eto;
    const def = nounClass === undefined ? undefined
      : (options.adjectives ?? []).find((x) => x.forms[nounClass] !== undefined && !x.excluded.includes(eto.normalize('NFC')));
    if (def === undefined || nounClass === undefined) continue;
    const k = pieces.indexOf(p);
    const sides = [-1, 1].filter((d) => rendered(pieces[k + d]) && pieces[k + d]?.category === 'NOM');
    if (sides.length !== 1) continue;
    const dir = sides[0] as number;
    const n = pieces[k + dir] as EtonPiece;
    // Voisins : rien qui demande une autre règle (nom, adjectif, possessif, « de », adverbe).
    const busy = (q: EtonPiece | undefined): boolean => q !== undefined && (grammar.get(q) === 'POSSESSIVE'
      || ((q.source === 'D7' || q.source === 'FRENCH') && ['NOM', 'ADJ', 'ADV', 'NUM'].includes(q.category ?? ''))
      || ((q.source === 'RULE' || q.source === 'MISSING') && CONNECTIVE_WORDS.has(q.fr.toLocaleLowerCase('fr').replace(/’/gu, "'"))));
    if (busy(pieces[k + 2 * dir]) || busy(pieces[k - dir])) continue;
    if (n.eto === null || !consonantInitial(n.eto) || agreeing.has(n) || agreeing.has(p) || !singular([p.fr, n.fr], lexicon)) continue;
    pieces.splice(k, 1);
    const at = pieces.indexOf(n);
    pieces.splice(at, 0, p, { fr: '', eto: def.forms[nounClass] as string, source: 'RULE', ref: def.ref });
    headed.add(p);
    let r = adjectiveRules.get(def);
    if (!r) {
      r = { id: def.id, ruleClass: 'A', ref: def.ref, description: 'Nom adjectival en tête, suivi du connectif de sa classe, puis du nom.' };
      adjectiveRules.set(def, r);
    }
    applied.add(r);
  }
  for (let k = 0; k < pieces.length; k++) {
    const p = pieces[k] as EtonPiece;
    if (!rendered(p) || !adjectival(p) || headed.has(p)) continue;
    for (const dir of [-1, 1]) {
      // « nombre plus facile » : un adverbe entre le nom et l'adjectif ne dispense pas de la règle.
      let j = k + dir;
      while (rendered(pieces[j]) && pieces[j]?.category === 'ADV' && !adjectival(pieces[j] as EtonPiece)) j += dir;
      const n = pieces[j];
      if (rendered(n) && n.category === 'NOM') gap(dir < 0 ? `${n.fr} ${p.fr}` : `${p.fr} ${n.fr}`, ETON_RULES.ADJECTIVE);
    }
  }
  for (let k = 1; k < pieces.length; k++) {
    const a = pieces[k - 1] as EtonPiece;
    const b = pieces[k] as EtonPiece;
    if (!rendered(a) || !rendered(b)) continue;
    const pair = [a.category, b.category];
    if (pair.includes('NOM') && (adjectival(a) || adjectival(b))) continue;
    if (pair.includes('NOM') && pair.includes('NUM')) gap(`${a.fr} ${b.fr}`, ETON_RULES.NUMERAL);
    else if (PREPOSITIONS.has(a.fr.toLocaleLowerCase('fr')) && b.category === 'VERBE') {
      // « pour » + infinitif (M32) : ású + subjonctif avec « tu ».
      const key = b.fr.toLocaleLowerCase('fr');
      const form = a.fr.toLocaleLowerCase('fr') === 'pour' && a.eto === 'ású' && b.source === 'D7' && b.eto !== null && !b.downstep
        && !['être', 'avoir'].includes(key) && (lexicon?.lookup(key) ?? []).some((r) => r.mood === 'INFINITIVE')
        ? subjunctiveTu(b.eto) : null;
      if (form === null) gap(`${a.fr} ${b.fr}`, ETON_RULES.INFINITIVE);
      else {
        b.form = form;
        applied.add(ETON_RULES.PURPOSE);
      }
    }
    else if (pair[0] === 'NOM' && pair[1] === 'NOM') gap(`${a.fr} ${b.fr}`, ETON_RULES.CONNECTIVE);
  }
  if (lexical.length >= 2) applied.add(ETON_RULES.ORDER);

  const parts = pieces.map((p) => ({ text: p.eto === null ? `[${p.fr}]` : `${p.downstep ? 'ꜜ' : ''}${p.form ?? p.eto}`, punct: p.source === 'PUNCT' }));
  return {
    fr: s.text,
    pieces,
    eto: gaps.length === 0 ? join(parts) : null,
    draft: join(parts),
    applied: [...applied],
    gaps,
    ambiguous: pieces.filter((p) => p.source === 'D7' && ((p.senses ?? 1) > 1 || p.qualifier || p.homograph)).map((p) => p.fr),
    kept: pieces.filter((p) => p.source === 'FRENCH').map((p) => p.fr),
    keptOnly: keptWithoutD7 && !keptAlone && buildSentence(s, d7, options, true).eto !== null,
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
    kept: sentences.flatMap((s) => s.kept),
    keptOnly: !complete && sentences.every((s) => s.eto !== null || s.keptOnly),
    found: sentences.reduce((n, s) => n + s.found, 0),
    total: sentences.reduce((n, s) => n + s.total, 0),
  };
}
