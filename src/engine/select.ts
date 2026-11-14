/**
 * Sélection de la meilleure traduction et statut (MOT5, décisions M2, M4, M7, M15, M18).
 *
 * Pour chaque unité simplifiée par D8 (MOT3), chaque candidat est construit en éton (MOT4), puis le
 * meilleur est retenu. Les candidats qui perdent un trait de l'original (question, négation, temps…)
 * sont écartés : l'original, toujours présent, ne perd rien.
 *
 * Ordre des candidats :
 * 1. complet (aucun manque) avant incomplet ;
 * 2. sans négation non rendue (sinon le sens s'inverse) ;
 * 3. complet : sans mot de sens non confirmé d'abord (M18), puis sans mot ambigu (M15) ;
 * 4. part des mots pleins trouvés dans D7, puis nombre de manques ;
 * 5. moins de mots ambigus ; puis original, synonyme, définition, substitution ; puis ordre de D8.
 *
 * Statut d'une unité :
 * - SUCCESS : le candidat retenu est complet (M2) ; aussi pour une unité sans rien de D8 que D7 rend
 *   entièrement (M16 : « Viens ici ! » → zùgá mű !), toujours journalisée ;
 * - PARTIAL : brouillon avec la liste exacte des manques, affiché avec le marqueur (M7) ;
 * - FALLBACK : négation non rendue, ou entrée critique non rendue → français seul (M7) ;
 * - PENDING : unité sans rien de D8 que D7 ne rend pas entièrement → français seul, à journaliser (M4) ;
 * - PASSTHROUGH : rien à traduire (valeurs protégées, ponctuation) → texte reçu tel quel.
 * Un mot ambigu est signalé sans dégrader le statut (M15).
 *
 * Contrôle du sens (M18). Un synonyme de D8 peut mener dans D7 à un mot d'un autre sens : « Rejeter »
 * → « mettre de côté » → lìŋ, qui veut d'abord dire « épargner ». Un mot de D7 a un sens confirmé si la
 * clé ouvre sa glose (sens premier), ou si sa glose partage un mot plein avec l'entrée de D8 (terme,
 * synonymes, définition). Sinon il est signalé (SENSE_UNCONFIRMED) et un candidat confirmé est préféré :
 * autre synonyme, puis définition. Le signal seul ne bloque pas : la plupart de ces mots sont justes
 * (nwàmɔ̀ « nombre, numéro »). Les sens reconnus faux sont listés avec leur raison (`wrongSenses`) :
 * leurs candidats sont écartés ; si aucun ne reste, l'unité reste en français (FALLBACK, WRONG_SENSE).
 *
 * Module pur, sans dépendance à Node.
 */
import type { D7Index } from './d7';
import { buildEton, ETON_RULES, type EtonOptions, type EtonPiece, type EtonText } from './eton';
import type { Lexicon } from './lexicon';
import { normalize } from './normalize';
import type { Candidate, CandidateSource, MatchKind, Simplification, SimplifiedUnit } from './simplify';

export type EngineStatus = 'SUCCESS' | 'PARTIAL' | 'FALLBACK' | 'PENDING' | 'PASSTHROUGH';

/**
 * Raisons d'un statut autre que SUCCESS, ou signaux sans effet sur le statut (AMBIGUOUS,
 * SENSE_UNCONFIRMED ; NOT_IN_D8 avec SUCCESS).
 */
export type Reason =
  | 'GAPS'
  | 'NEGATION_NOT_RENDERED'
  | 'CRITICAL_NOT_RENDERED'
  | 'NOT_IN_D8'
  | 'NOTHING_TO_TRANSLATE'
  | 'AMBIGUOUS'
  | 'SENSE_UNCONFIRMED'
  | 'WRONG_SENSE';

/** Marqueur affiché devant un brouillon (M7). */
export const INCOMPLETE_MARKER = 'traduction incomplète';

export interface CandidateResult {
  text: string;
  source: CandidateSource;
  entryIds: string[];
  eton: EtonText;
  /** Mots français rendus par un mot de D7 de sens non confirmé (M18). */
  unconfirmed: string[];
}

/** Sens faux relevé : dans l'entrée de D8 `entryId`, la forme `eto` trahit le sens (M18). */
export interface WrongSense {
  entryId: string;
  /** Mots français de D8 qui mènent à la forme (« mettre de côté »). */
  fr: string;
  eto: string;
  /** Référence de la forme dans D7. */
  ref: string;
  reason: string;
}

export interface UnitResult {
  /** Texte français de l'unité. */
  text: string;
  status: EngineStatus;
  reasons: Reason[];
  match: MatchKind;
  entryId: string | null;
  /** SUCCESS : phrase éton ; PARTIAL : brouillon (manques entre crochets) ; PASSTHROUGH : texte reçu. */
  output: string | null;
  /** Candidat retenu (aussi pour PENDING et FALLBACK, à titre de diagnostic ; jamais affiché). */
  chosen: CandidateResult | null;
  /** Autres candidats évalués, du meilleur au moins bon. */
  alternatives: CandidateResult[];
  /** Candidats écartés parce qu'ils perdaient un trait de l'original. */
  discarded: Candidate[];
  /** Candidats écartés pour un sens faux relevé (M18). */
  excluded: CandidateResult[];
  /** Entrées critiques de D8 présentes dans l'unité. */
  critical: string[];
  /** Unité absente de D8 telle quelle : à journaliser pour enrichir le corpus (M4). */
  logged: boolean;
}

export interface TextResult {
  text: string;
  status: EngineStatus;
  /** Phrase éton complète (SUCCESS) ou texte reçu (PASSTHROUGH) ; null sinon. */
  output: string | null;
  /** PARTIAL : brouillon de tout le texte, unités non traduites en français entre crochets. */
  draft: string | null;
  /** PARTIAL : marqueur à afficher avec le brouillon et le français (M7). */
  marker: string | null;
  units: UnitResult[];
  /** Unités à journaliser (M4). */
  pending: string[];
}

export interface SelectOptions extends EtonOptions {
  /** Identifiants des entrées critiques de D8 (montant, frais, confirmation…) : non rendues → FALLBACK. */
  critical?: ReadonlySet<string>;
  /** Texte de chaque entrée de D8 (terme, synonymes, définition), par identifiant : référence du sens (M18). */
  references?: ReadonlyMap<string, string>;
  /** Sens faux relevés (M18). */
  wrongSenses?: readonly WrongSense[];
}

const SOURCE_RANK: Readonly<Record<CandidateSource, number>> = { ORIGINAL: 0, SYNONYM: 1, DEFINITION: 2, SUBSTITUTION: 3 };
const NEGATION_RULES: ReadonlySet<string> = new Set([ETON_RULES.NEGATION.id, ETON_RULES.NEGATION_IMPERATIVE.id]);

const hasNegationGap = (e: EtonText): boolean => e.gaps.some((g) => g.kind === 'RULE' && NEGATION_RULES.has(g.rule.id));
const coverage = (e: EtonText): number => (e.total === 0 ? 1 : e.found / e.total);

const d7Pieces = (e: EtonText): EtonPiece[] => e.sentences.flatMap((s) => s.pieces).filter((p) => p.source === 'D7');

/** Mots trop généraux pour confirmer un sens. */
const GENERIC = new Set(['être', 'avoir', 'faire', 'pouvoir', 'aller', 'mettre', 'donner', 'chose', 'quelque', 'plus', 'pas', 'bien', 'très', 'personne']);
const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);

/** Mots pleins d'un texte, ramenés au lemme quand Lefff le connaît. Les numéros et précisions de D7 sont ignorés. */
function contentWords(text: string, lexicon: Lexicon | undefined): Set<string> {
  const words = new Set<string>();
  const clean = text.replace(/[’‘]/gu, "'").replace(/\d+\)/gu, ' ').replace(/\([^)]*\)/gu, ' ');
  for (const t of normalize(clean).tokens) {
    if (t.kind !== 'word') continue;
    const lemmas = (lexicon?.lookup(t.key) ?? []).filter((r) => CONTENT_POS.has(r.pos)).map((r) => r.lemma.toLocaleLowerCase('fr'));
    if (lemmas.length > 0) for (const l of lemmas) words.add(l);
    else if ([...t.key].length > 3) words.add(t.key);
  }
  for (const w of GENERIC) words.delete(w);
  return words;
}

const keysOf = (text: string): string[] => normalize(text).tokens.filter((t) => t.kind === 'word').map((t) => t.key);

/**
 * Mots apportés par D8 (absents du texte reçu) rendus par un mot de D7 dont le sens n'est confirmé ni
 * par la glose (sens premier) ni par l'entrée de D8.
 */
function unconfirmedPieces(eton: EtonText, original: ReadonlySet<string>, reference: ReadonlySet<string>, lexicon: Lexicon | undefined): string[] {
  return d7Pieces(eton)
    .filter((p) => p.primary === false && p.gloss !== undefined && keysOf(p.fr).some((k) => !original.has(k)))
    .filter((p) => {
      const own = contentWords(p.fr, lexicon);
      return ![...contentWords(p.gloss as string, lexicon)].some((w) => !own.has(w) && reference.has(w));
    })
    .map((p) => p.fr);
}

const entryIdsOf = (c: { entryIds: readonly string[] }, entryId: string | null): string[] =>
  [...new Set([...(entryId === null ? [] : [entryId]), ...c.entryIds])];

/** Clé de tri : plus petit = meilleur. */
function rankKey(c: CandidateResult, index: number): number[] {
  const { eton } = c;
  const complete = eton.complete;
  return [
    complete ? 0 : 1,
    hasNegationGap(eton) ? 1 : 0,
    complete ? c.unconfirmed.length : 0,
    complete ? eton.ambiguous.length : 0,
    -coverage(eton),
    eton.gaps.length,
    eton.ambiguous.length,
    SOURCE_RANK[c.source],
    index,
  ];
}

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) {
    const d = (a[k] as number) - (b[k] as number);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Évalue et classe les candidats d'une unité, du meilleur au moins bon. `unit` : texte reçu et entrée de
 * D8 de l'unité, pour le contrôle du sens des mots apportés par D8 (M18).
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  d7: D7Index,
  options: SelectOptions = {},
  unit: { text: string; entryId: string | null } | null = null,
): CandidateResult[] {
  const original = new Set(keysOf(unit?.text ?? ''));
  const results = candidates.map((c) => {
    const eton = buildEton(c.text, d7, options);
    const reference = contentWords(entryIdsOf(c, unit?.entryId ?? null).map((id) => options.references?.get(id) ?? '').join(' . '), options.lexicon);
    const unconfirmed = unit === null ? [] : unconfirmedPieces(eton, original, reference, options.lexicon);
    return { text: c.text, source: c.source, entryIds: c.entryIds, eton, unconfirmed };
  });
  const keys = new Map(results.map((r, i) => [r, rankKey(r, i)] as const));
  return [...results].sort((a, b) => compareKeys(keys.get(a) as number[], keys.get(b) as number[]));
}

/** Choisit la traduction d'une unité et lui donne son statut. */
export function selectUnit(unit: SimplifiedUnit, d7: D7Index, options: SelectOptions = {}): UnitResult {
  const ids = [unit.entryId, ...unit.terms.map((t) => t.entryId)].filter((id): id is string => id !== null);
  const critical = [...new Set(ids.filter((id) => options.critical?.has(id)))];
  const logged = unit.translatable && unit.match !== 'EXACT';
  const base = { text: unit.text, match: unit.match, entryId: unit.entryId, critical, logged };

  if (!unit.translatable) {
    return { ...base, status: 'PASSTHROUGH', reasons: ['NOTHING_TO_TRANSLATE'], output: unit.text, chosen: null, alternatives: [], discarded: [], excluded: [] };
  }

  const kept = unit.candidates.filter((c) => c.lost.length === 0);
  const discarded = [...unit.candidates.filter((c) => c.lost.length > 0), ...unit.rejected];
  const ranked = rankCandidates(kept, d7, options, unit);
  const isWrong = (c: CandidateResult): boolean => {
    const ids = entryIdsOf(c, unit.entryId);
    return d7Pieces(c.eton).some((p) => (options.wrongSenses ?? []).some((w) => w.eto === p.eto && ids.includes(w.entryId)));
  };
  const excluded = ranked.filter(isWrong);
  const [chosen, ...alternatives] = ranked.filter((c) => !isWrong(c));
  const reasons: Reason[] = [];
  if (unit.match === 'NONE') reasons.push('NOT_IN_D8');
  if (!chosen) {
    reasons.push('WRONG_SENSE');
    return { ...base, status: 'FALLBACK', reasons, output: null, chosen: null, alternatives: [], discarded, excluded };
  }
  const { eton } = chosen;
  let status: EngineStatus;

  if (eton.complete) {
    status = 'SUCCESS';
  } else if (unit.match === 'NONE') {
    status = 'PENDING';
  } else {
    const negation = hasNegationGap(eton);
    reasons.push('GAPS');
    if (negation) reasons.push('NEGATION_NOT_RENDERED');
    if (critical.length > 0) reasons.push('CRITICAL_NOT_RENDERED');
    status = negation || critical.length > 0 ? 'FALLBACK' : 'PARTIAL';
  }
  if (eton.ambiguous.length > 0) reasons.push('AMBIGUOUS');
  if (chosen.unconfirmed.length > 0) reasons.push('SENSE_UNCONFIRMED');

  const output = status === 'SUCCESS' ? eton.eto : status === 'PARTIAL' ? eton.draft : null;
  return { ...base, status, reasons, output, chosen, alternatives, discarded, excluded };
}

/**
 * Statut d'un texte à partir de ses unités :
 * une unité FALLBACK → FALLBACK ; tout traduit → SUCCESS ; rien de traduisible → PASSTHROUGH ;
 * tout en attente → PENDING ; sinon PARTIAL.
 */
export function textStatus(units: readonly UnitResult[]): EngineStatus {
  const translatable = units.filter((u) => u.status !== 'PASSTHROUGH');
  if (translatable.length === 0) return 'PASSTHROUGH';
  if (translatable.some((u) => u.status === 'FALLBACK')) return 'FALLBACK';
  if (translatable.every((u) => u.status === 'SUCCESS')) return 'SUCCESS';
  if (translatable.every((u) => u.status === 'PENDING')) return 'PENDING';
  return 'PARTIAL';
}

/** Choisit la traduction de chaque unité d'un texte simplifié et donne le statut du texte. */
export function selectText(text: string, simplification: Simplification, d7: D7Index, options: SelectOptions = {}): TextResult {
  const units = simplification.units.map((u) => selectUnit(u, d7, options));
  const status = textStatus(units);
  const joined = (part: (u: UnitResult) => string): string => units.map(part).join(' ');
  return {
    text,
    status,
    output: status === 'SUCCESS' || status === 'PASSTHROUGH' ? joined((u) => u.output as string) : null,
    draft: status === 'PARTIAL' ? joined((u) => u.output ?? `[${u.text}]`) : null,
    marker: status === 'PARTIAL' ? INCOMPLETE_MARKER : null,
    units,
    pending: simplification.pending,
  };
}
