/**
 * Extrait de Lefff réduit au vocabulaire du projet (MOT2, décision de l'utilisateur du 14/11/2026).
 *
 * On garde une ligne de Lefff si sa forme apparaît dans D7, D8 ou les listes de src/engine/french.ts,
 * ou si son lemme est celui d'une telle forme : toutes les formes conjuguées ou accordées d'un mot
 * connu sont donc conservées (« envoie » → toute la conjugaison d'« envoyer »).
 */
import { normalize } from '../../src/engine/normalize';

export const LEFFF_SOURCE = {
  version: '3.4',
  citation: 'Benoît Sagot (2010). The Lefff, a freely available and large-coverage morphological and syntactic lexicon for French. LREC 2010.',
  repository: 'https://github.com/ClaudeCoulombe/FrenchLefffLemmatizer',
  commit: 'bc0ebd0135a6cc78f48ddf184069b4c0b9c017d8',
  path: 'french_lefff_lemmatizer/data/lefff-3.4.mlex',
  sha256: 'f3da25e58aec161c5ae34d598038dd6304056c2649867ede7e220a74fd34fe12',
} as const;

export const LEFFF_URL = `https://raw.githubusercontent.com/ClaudeCoulombe/FrenchLefffLemmatizer/${LEFFF_SOURCE.commit}/${LEFFF_SOURCE.path}`;

/** Ponctuation et marques techniques de Lefff : inutiles au moteur. */
const EXCLUDED_CATEGORIES: ReadonlySet<string> = new Set(['poncts', 'ponctw', 'parento', 'parentf', 'epsilon', 'meta', 'sbound']);

/** Formes (en minuscules) des mots d'un texte, découpées comme par le moteur, plus les parties des mots composés. */
export function wordsOf(text: string, into: Set<string> = new Set()): Set<string> {
  for (const t of normalize(text).tokens) {
    if (t.kind !== 'word') continue;
    into.add(t.key);
    if (t.key.includes('-')) for (const part of t.key.split('-')) if (part) into.add(part);
  }
  return into;
}

export interface LefffSelection {
  kept: string[];
  lemmas: number;
  /** Mots cherchés qui n'apparaissent dans aucune ligne gardée. */
  missing: string[];
}

export function selectLefff(lines: readonly string[], words: ReadonlySet<string>): LefffSelection {
  const rows = lines
    .map((line) => line.replace(/\r$/u, ''))
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => ({ line, cells: line.split('\t') }))
    .filter(({ cells }) => cells.length >= 3 && !EXCLUDED_CATEGORIES.has(cells[1] as string));
  const form = (cells: string[]): string => (cells[0] as string).normalize('NFC').toLowerCase();
  const lemma = (cells: string[]): string => (cells[2] as string).normalize('NFC').toLowerCase();
  const lemmas = new Set(rows.filter(({ cells }) => words.has(form(cells))).map(({ cells }) => lemma(cells)));
  const kept = rows.filter(({ cells }) => words.has(form(cells)) || lemmas.has(lemma(cells)));
  const found = new Set(kept.map(({ cells }) => form(cells)));
  return {
    kept: kept.map(({ line }) => line),
    lemmas: lemmas.size,
    missing: [...words].filter((w) => !found.has(w)).sort(),
  };
}

/** En-tête exigé par la LGPL-LR §2 b) : le fichier est modifié, avec la date et la nature du changement. */
export function subsetHeader(meta: { date: string; d7Sha256: string; d8Entries: number; lines: number; total: number }): string {
  return [
    `# Extrait MODIFIÉ de Lefff ${LEFFF_SOURCE.version} — licence LGPL-LR (voir LICENSE-LGPL-LR.txt dans ce dossier).`,
    `# ${LEFFF_SOURCE.citation}`,
    `# Source : ${LEFFF_SOURCE.repository} @ ${LEFFF_SOURCE.commit}, ${LEFFF_SOURCE.path} (SHA-256 ${LEFFF_SOURCE.sha256}).`,
    `# Modifié le ${meta.date} par le projet FinEthnic : ${meta.lines} lignes gardées sur ${meta.total}, aucune ligne changée.`,
    '#   Gardées : les lignes dont la forme apparaît dans D7, D8 ou src/engine/french.ts, et toutes celles du même lemme.',
    '#   Retirées : les autres lignes, et la ponctuation (catégories poncts, ponctw, parento, parentf, epsilon, meta, sbound).',
    `#   Vocabulaire : D7 (SHA-256 ${meta.d7Sha256.slice(0, 12)}), ${meta.d8Entries} entrées D8.`,
    '# Régénérer : npm run build-lefff',
    '',
  ].join('\n');
}
