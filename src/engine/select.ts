/**
 * Sélection de la meilleure traduction et statut (MOT5, décisions M2, M4, M7, M15).
 *
 * Pour chaque unité simplifiée par D8 (MOT3), chaque candidat est construit en éton (MOT4), puis le
 * meilleur est retenu. Les candidats qui perdent un trait de l'original (question, négation, temps…)
 * sont écartés : l'original, toujours présent, ne perd rien.
 *
 * Ordre des candidats :
 * 1. complet (aucun manque) avant incomplet ;
 * 2. sans négation non rendue (sinon le sens s'inverse) ;
 * 3. complet : sans mot ambigu d'abord (M15) ;
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
 * Module pur, sans dépendance à Node.
 */
import type { D7Index } from './d7';
import { buildEton, ETON_RULES, type EtonOptions, type EtonText } from './eton';
import type { Candidate, CandidateSource, MatchKind, Simplification, SimplifiedUnit } from './simplify';

export type EngineStatus = 'SUCCESS' | 'PARTIAL' | 'FALLBACK' | 'PENDING' | 'PASSTHROUGH';

/** Raisons d'un statut autre que SUCCESS, ou signaux sans effet sur le statut (AMBIGUOUS ; NOT_IN_D8 avec SUCCESS). */
export type Reason =
  | 'GAPS'
  | 'NEGATION_NOT_RENDERED'
  | 'CRITICAL_NOT_RENDERED'
  | 'NOT_IN_D8'
  | 'NOTHING_TO_TRANSLATE'
  | 'AMBIGUOUS';

/** Marqueur affiché devant un brouillon (M7). */
export const INCOMPLETE_MARKER = 'traduction incomplète';

export interface CandidateResult {
  text: string;
  source: CandidateSource;
  entryIds: string[];
  eton: EtonText;
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
}

const SOURCE_RANK: Readonly<Record<CandidateSource, number>> = { ORIGINAL: 0, SYNONYM: 1, DEFINITION: 2, SUBSTITUTION: 3 };
const NEGATION_RULES: ReadonlySet<string> = new Set([ETON_RULES.NEGATION.id, ETON_RULES.NEGATION_IMPERATIVE.id]);

const hasNegationGap = (e: EtonText): boolean => e.gaps.some((g) => g.kind === 'RULE' && NEGATION_RULES.has(g.rule.id));
const coverage = (e: EtonText): number => (e.total === 0 ? 1 : e.found / e.total);

/** Clé de tri : plus petit = meilleur. */
function rankKey(c: CandidateResult, index: number): number[] {
  const { eton } = c;
  const complete = eton.complete;
  return [
    complete ? 0 : 1,
    hasNegationGap(eton) ? 1 : 0,
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

/** Évalue et classe les candidats d'une unité, du meilleur au moins bon. */
export function rankCandidates(candidates: readonly Candidate[], d7: D7Index, options: EtonOptions = {}): CandidateResult[] {
  const results = candidates.map((c) => ({ text: c.text, source: c.source, entryIds: c.entryIds, eton: buildEton(c.text, d7, options) }));
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
    return { ...base, status: 'PASSTHROUGH', reasons: ['NOTHING_TO_TRANSLATE'], output: unit.text, chosen: null, alternatives: [], discarded: [] };
  }

  const kept = unit.candidates.filter((c) => c.lost.length === 0);
  const discarded = [...unit.candidates.filter((c) => c.lost.length > 0), ...unit.rejected];
  const [chosen, ...alternatives] = rankCandidates(kept, d7, options) as [CandidateResult, ...CandidateResult[]];
  const { eton } = chosen;
  const reasons: Reason[] = [];
  let status: EngineStatus;

  if (unit.match === 'NONE') reasons.push('NOT_IN_D8');
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

  const output = status === 'SUCCESS' ? eton.eto : status === 'PARTIAL' ? eton.draft : null;
  return { ...base, status, reasons, output, chosen, alternatives, discarded };
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
