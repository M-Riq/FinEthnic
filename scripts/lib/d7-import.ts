/**
 * Import du dictionnaire éton–français D7 (BM3.3) → dictionnaire de la cascade (dictionary.schema.json).
 *
 * Source : le lexique Markdown extrait du PDF (feuille « Éton → Français » : une ligne par entrée,
 * avec la page du livre). Fonctions pures ; l'écriture est faite par scripts/import-dictionary.ts,
 * qui garde la source et le résultat dans data/language-resources/raw/ (hors Git, Q17).
 *
 * Aucune forme n'est inventée ni corrigée. Seul le numéro d'homonyme final (« …1 », « …2 ») est retiré :
 * il numérote les entrées du livre et n'appartient pas au mot. Une forme hors de la liste blanche
 * éton est écartée et signalée, jamais modifiée.
 */
import { tokenize, type Dictionary, type DictionaryEntry } from './cascade';
import { ImportError, parseMarkdownTables } from './d8-import';
import { checkEtonCharacters, checkTextEncoding } from './eton-charset';

export const D7_SECTION = 'Éton → Français';
export const D7_HEADER = ['N°', 'Mot éton', 'Variante(s)', 'Catégorie', 'Classe nominale', 'Pluriel',
  'Traduction française', 'English (partiel)', 'Page du livre', 'Entrée complète (avec exemples)'];

/** Catégories de D7 → codes des motifs de grammar-rules.json. PROVISOIRE (Q23). */
export const CATEGORY_CODES: Readonly<Record<string, string>> = {
  'nom': 'NOM',
  'nom adjectival': 'ADJ',
  'adjectif': 'ADJ',
  'verbe': 'VERBE',
  'verbe résultatif': 'VERBE',
  'quasi-auxiliaire': 'AUX',
  'adverbe': 'ADV',
  'préposition': 'PREP',
  'pronom': 'PRON',
  'numéral': 'NUM',
  'idéophone': 'IDEO',
  'interjection': 'INTERJ',
  'subordonnant': 'SUB',
  'particule': 'PART',
};

export class D7ImportError extends Error {
  constructor(readonly problems: string[]) {
    super(`Import D7 refusé (${problems.length} problème(s)) :\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'D7ImportError';
  }
}

export interface D7Row {
  /** Numéro de ligne dans le lexique (colonne « N° »), pas dans le livre. */
  n: number;
  headword: string;
  /** Forme sans numéro d'homonyme. */
  form: string;
  homonym: number | null;
  category: string;
  /** Colonne « Classe nominale » (« 9/10 », « s.g »…), ou null si vide. */
  nounClass: string | null;
  french: string;
  page: number;
}

/** Lit la feuille « Éton → Français ». Toute incohérence de structure arrête l'import. */
export function readD7(markdown: string): D7Row[] {
  let tables;
  try {
    tables = parseMarkdownTables(markdown.normalize('NFC'));
  } catch (error) {
    if (error instanceof ImportError) throw new D7ImportError(error.problems);
    throw error;
  }
  const found = tables.filter((t) => t.h2 === D7_SECTION);
  if (found.length !== 1) throw new D7ImportError([`${found.length} tableau(x) « ${D7_SECTION} » au lieu de 1`]);
  const table = found[0] as (typeof tables)[number];
  if (table.header.join('|') !== D7_HEADER.join('|')) {
    throw new D7ImportError([`en-tête inattendu : ${table.header.join(' | ')}`]);
  }
  const problems: string[] = [];
  const rows = table.rows.map(({ line, cells }, i): D7Row => {
    const [n, headword, , category, nounClass, , french, , page] = cells as string[];
    if (n !== String(i + 1)) problems.push(`ligne ${line} : N° « ${n} » au lieu de ${i + 1}`);
    if (!/^[1-9]\d*$/u.test(page ?? '')) problems.push(`ligne ${line} : page « ${page} » invalide`);
    if (!headword) problems.push(`ligne ${line} : mot éton vide`);
    const homonym = /^(.*\D)(\d+)$/u.exec(headword ?? '');
    return {
      n: i + 1,
      headword: headword ?? '',
      form: homonym ? (homonym[1] as string) : headword ?? '',
      homonym: homonym ? Number(homonym[2]) : null,
      category: category ?? '',
      nounClass: nounClass ? nounClass : null,
      french: french ?? '',
      page: Number(page),
    };
  });
  if (rows.length === 0) problems.push(`tableau « ${D7_SECTION} » vide`);
  if (problems.length > 0) throw new D7ImportError(problems);
  return rows;
}

/** Lettres du français : une clé qui en contient d'autres (ex. de l'Éton mal découpé) est écartée. */
const FRENCH_KEY = /^[a-zàâäçéèêëîïôöùûüÿœæ’' -]+$/iu;

/**
 * Clés de recherche françaises d'une traduction de D7 : un sens par « 1) », « 2) »…, puis une clé par
 * élément séparé par une virgule. Les parenthèses, les guillemets et ce qui suit un point ou un
 * deux-points (nom scientifique, explication) sont retirés.
 */
export function frenchKeys(french: string): { keys: string[]; rejected: string[] } {
  const keys: string[] = [];
  const rejected: string[] = [];
  for (const sense of french.normalize('NFC').split(/(?:^|\s)\d+\)\s*/u)) {
    const main = sense.replace(/\([^()]*\)/gu, ' ').split(/\.\s|:/u)[0] as string;
    for (const part of main.split(',')) {
      const key = part.replace(/["“”«»]/gu, '').replace(/[\s.?]+$/u, '').replace(/\s+/gu, ' ').trim();
      if (key === '') continue;
      const words = FRENCH_KEY.test(key) && tokenize(key).every((t) => t.kind === 'word');
      if (!words) rejected.push(key);
      else if (!keys.includes(key)) keys.push(key);
    }
  }
  return { keys, rejected };
}

export interface D7ImportResult {
  dictionary: Dictionary;
  rows: number;
  /** Entrées sans aucune clé française utilisable. */
  noKey: D7Row[];
  rejectedKeys: { row: D7Row; key: string }[];
  /** Formes écartées (caractères hors liste blanche, encodage) : jamais corrigées. */
  excludedForms: { row: D7Row; issues: string[] }[];
  unknownCategories: D7Row[];
  categories: Map<string, number>;
}

export const d7Ref = (row: D7Row): string => `D7 p. ${row.page} (lexique n° ${row.n})`;

export function buildD7Dictionary(rows: readonly D7Row[], source: string): D7ImportResult {
  const entries: DictionaryEntry[] = [];
  const result: Omit<D7ImportResult, 'dictionary'> = {
    rows: rows.length, noKey: [], rejectedKeys: [], excludedForms: [], unknownCategories: [], categories: new Map(),
  };
  for (const row of rows) {
    result.categories.set(row.category, (result.categories.get(row.category) ?? 0) + 1);
    const code = CATEGORY_CODES[row.category];
    if (code === undefined) {
      result.unknownCategories.push(row);
      continue;
    }
    const issues = [...checkTextEncoding(row.form), ...checkEtonCharacters(row.form)];
    if (issues.length > 0) {
      result.excludedForms.push({ row, issues });
      continue;
    }
    const { keys, rejected } = frenchKeys(row.french);
    for (const key of rejected) result.rejectedKeys.push({ row, key });
    if (keys.length === 0) result.noKey.push(row);
    const nounClass = (code === 'NOM' || code === 'ADJ') && row.nounClass ? { nounClass: row.nounClass } : {};
    for (const fr of keys) entries.push({ fr, eto: row.form, category: code, gloss: row.french, ref: d7Ref(row), ...nounClass });
  }
  return { dictionary: { kind: 'd7', source, entries }, ...result };
}

/** Échantillon régulier (même résultat à chaque import) pour la vérification manuelle (BM3.4). */
export function sampleRows<T>(rows: readonly T[], size: number): T[] {
  if (rows.length <= size) return [...rows];
  return Array.from({ length: size }, (_, i) => rows[Math.floor(((i + 0.5) * rows.length) / size)] as T);
}

const cell = (text: string): string => text.replace(/\|/gu, '\\|');

/** Rapport d'import (contient des formes éton : reste dans raw/, hors Git). */
export function renderD7Report(result: D7ImportResult, meta: { source: string; sha256: string; rows: readonly D7Row[] }): string {
  const keys = new Set(result.dictionary.entries.map((e) => e.fr.toLocaleLowerCase('fr')));
  const indexed = new Set(result.dictionary.entries.map((e) => e.ref));
  const lines = [
    '# Rapport d’import du dictionnaire D7 (BM3.3)',
    '',
    '> Contient des formes éton tirées de D7 : **ne pas versionner** (reste dans `data/language-resources/raw/`, Q17).',
    '',
    `- Source : \`${meta.source}\``,
    `- SHA-256 : \`${meta.sha256}\``,
    `- Entrées lues (feuille « ${D7_SECTION} ») : **${result.rows}**`,
    `- Entrées indexées : **${indexed.size}** ; clés françaises distinctes : **${keys.size}** ; lignes du dictionnaire de la cascade : **${result.dictionary.entries.length}**`,
    `- Numéros d’homonyme retirés : ${meta.rows.filter((r) => r.homonym !== null).length}`,
    `- Formes avec un tiret (préfixe de classe séparé du thème) : ${meta.rows.filter((r) => r.form.includes('-')).length} — gardées telles quelles`,
    `- Formes **écartées** (hors liste blanche ou encodage) : **${result.excludedForms.length}**`,
    `- Entrées sans clé française utilisable : ${result.noKey.length} ; clés écartées : ${result.rejectedKeys.length}`,
    `- Catégories inconnues : ${result.unknownCategories.length}`,
    '',
    '## Catégories',
    '',
    '| Catégorie D7 | Code | Entrées |',
    '|---|---|---|',
    ...[...result.categories].sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${cell(c)} | ${CATEGORY_CODES[c] ?? '—'} | ${n} |`),
    '',
    '## Caractères hors de la liste blanche',
    '',
  ];
  const byIssue = new Map<string, { row: D7Row }[]>();
  for (const x of result.excludedForms) for (const issue of x.issues) byIssue.set(issue, [...(byIssue.get(issue) ?? []), x]);
  if (byIssue.size === 0) lines.push('Aucun.');
  else {
    lines.push('| Problème | Entrées | Exemples (n°, page, forme) |', '|---|---|---|');
    for (const [issue, xs] of [...byIssue].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`| ${cell(issue)} | ${xs.length} | ${xs.slice(0, 5).map(({ row }) => `${row.n}, p. ${row.page}, ${cell(row.headword)}`).join(' ; ')} |`);
    }
  }
  lines.push('', `## Échantillon pour la vérification manuelle (BM3.4, ${Math.min(30, meta.rows.length)} entrées)`, '',
    'Comparer chaque forme (tons compris) avec le PDF à la page indiquée.', '',
    '| N° | Page | Mot éton | Catégorie | Traduction française | Conforme ? |', '|---|---|---|---|---|---|');
  for (const row of sampleRows(meta.rows, 30)) {
    lines.push(`| ${row.n} | ${row.page} | ${cell(row.headword)} | ${cell(row.category)} | ${cell(row.french)} | |`);
  }
  lines.push('', '## Entrées sans clé française utilisable', '');
  if (result.noKey.length === 0) lines.push('Aucune.');
  else {
    lines.push('| N° | Page | Mot éton | Traduction française |', '|---|---|---|---|');
    for (const row of result.noKey) lines.push(`| ${row.n} | ${row.page} | ${cell(row.headword)} | ${cell(row.french)} |`);
  }
  lines.push('');
  return lines.join('\n');
}
