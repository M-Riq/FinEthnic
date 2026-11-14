/**
 * Mots grammaticaux du français (classes fermées) utilisés par la classification.
 *
 * Ce sont des faits de grammaire FRANÇAISE, pas des données éton : aucune forme éton ici.
 * Les listes sont volontairement courtes. Les verbes lexicaux (« dépasse », « envoie »…)
 * sont reconnus grâce au lexique de Lefff (lexicon.ts, verbs.ts), pas par ces listes.
 */

const set = (words: string): ReadonlySet<string> => new Set(words.trim().split(/\s+/u));

/** Pronoms sujets non ambigus (« nous » et « vous » sont traités à part : ils peuvent être compléments). */
export const SUBJECT_CLITICS = set("je j' tu il elle on ils elles");

/** Pronoms compléments placés entre le sujet (ou « ne ») et le verbe. */
export const OBJECT_CLITICS = set("me m' te t' se s' le la les l' lui leur y en nous vous");

/** Pronoms rattachés au verbe par un trait d'union. */
export const ENCLITIC_SUBJECTS = set('je tu il elle on ils elles nous vous ce');
export const ENCLITIC_OBJECTS = set('moi toi le la les lui leur nous vous en y');

/** Mots composés figés dont la fin ressemble à un pronom (« rendez-vous » n'est pas un impératif). */
export const LEXICALIZED_HYPHENATED = set("rendez-vous chez-moi chez-soi chez-vous peut-être c'est-à-dire");

/** Élisions détachées du mot suivant (« l'opération » → « l' » + « opération »). */
export const ELIDED = set("l' d' j' m' t' s' n' c' qu' jusqu' lorsqu' puisqu' quoiqu' presqu'");

/** Formes conjuguées des auxiliaires et des verbes modaux les plus courants. */
export const FINITE_AUXILIARIES = set(`
  suis es est êtes sont étais était étions étiez étaient serai seras sera serons serez seront
  serais serait serions seriez seraient sois soit soyons soyez soient
  ai as a avons avez ont avais avait avions aviez avaient aurai auras aura aurons aurez auront
  aurais aurait aurions auriez auraient aie ait ayons ayez aient
  vais vas va allons allez vont ira iront irait
  peux peut pouvons pouvez peuvent pourra pourrez pourront pourrait pourriez puisse
  dois doit devons devez doivent devra devrez devront devrait devriez
  veux veut voulons voulez veulent voudrais voudrait voudriez
  faut faudra faudrait fallait
`);

/** Formes à finale irrégulière qui s'accordent avec « nous » / « vous ». */
export const NOUS_IRREGULAR = set('sommes');
export const VOUS_IRREGULAR = set('êtes faites dites');

/** Mots en « -ez » qui ne sont pas des verbes. */
export const NOT_VERBS_EZ = set('chez assez nez rez');

export const DETERMINERS = set(`
  le la les l' un une des du de d' au aux ce cet cette ces mon ma mes ton ta tes son sa ses
  notre nos votre vos leur leurs quelque quelques chaque tout toute tous toutes
`);

/** Mots après lesquels une nouvelle proposition peut commencer. */
export const CLAUSE_LINKERS = set(`
  et mais ou donc car puis ensuite alors si s' quand lorsque lorsqu' puisque puisqu' que qu'
  comme quoique quoiqu' sinon
`);
export const CLAUSE_PUNCTUATION = set(', ; : ( — –');

/** Mots de négation qui complètent « ne ». */
export const NEGATION_AFTER_NE = set('pas plus jamais rien personne aucun aucune nul nulle guère point ni nullement');
/** Mots qui marquent une négation même sans « ne » (« Pas de frais », « sans frais », « Accès non autorisé »). */
export const NEGATION_STANDALONE = set('pas jamais aucun aucune rien non sans ni nul nulle nullement');

export const QUESTION_WORDS = set(`
  qui que qu' quoi quel quelle quels quelles lequel laquelle lesquels lesquelles où quand comment pourquoi combien
`);
/** Mots interrogatifs reconnus même en fin de phrase (« Vous payez combien ? »). */
export const QUESTION_WORDS_IN_SITU = set(`
  quoi quel quelle quels quelles lequel laquelle lesquels lesquelles où quand comment pourquoi combien
`);
/** Prépositions qui peuvent précéder le mot interrogatif (« À qui… ? »). */
export const PREPOSITIONS = set('à de d\' pour avec par en chez depuis dans sur sous vers contre');

/**
 * Verbes dont les temps composés se forment avec « être » (« il est arrivé » = passé). Avec les
 * autres verbes, « être » + participe passé est un passif (« le paiement est envoyé » = présent).
 */
export const ETRE_VERBS = set(`
  aller arriver venir revenir devenir parvenir intervenir survenir partir repartir entrer rentrer
  sortir monter remonter descendre redescendre naître mourir décéder rester tomber retomber retourner passer
`);

/** Pronoms réfléchis devant l'auxiliaire : avec eux, « être » forme un temps composé (« il s'est connecté »). */
export const REFLEXIVE_CLITICS = set("me m' te t' se s'");

/** Mots qui introduisent une proposition subordonnée. */
export const SUBORDINATORS = set("que qu' qui dont lorsque lorsqu' quand puisque puisqu' parce quoique quoiqu' où");
