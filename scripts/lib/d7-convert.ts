/**
 * Conversion complète de D7 (lexique Markdown) et de l'esquisse grammaticale (HAL) en JSON structuré.
 *
 * Fonctions pures ; l'écriture est faite par scripts/convert-d7.ts. Rien n'est inventé ni corrigé :
 * - chaque entrée garde son texte d'origine intact (`full`) ; les champs structurés n'en sont qu'un découpage ;
 * - un passage que le découpage ne sait pas classer reste dans `full` et est signalé dans `issues` ;
 * - la colonne « English (partiel) » et les colonnes « English (Claude) » ne viennent pas du livre
 *   (traductions ajoutées par Claude, cf. « Lisez-moi » de D7) : elles ne sont PAS reprises.
 *
 * Découpage des exemples : dans D7, chaque voyelle d'un mot éton porte une marque de ton (à, á, â, ǎ…),
 * alors qu'un mot français a presque toujours une voyelle sans accent. Une suite de mots entièrement
 * tonalisés est donc lue comme de l'éton, le texte qui suit comme sa traduction française.
 */
import { ImportError, parseMarkdownTables, type MarkdownTable } from './d8-import';
import { checkEtonCharacters } from './eton-charset';
import { D7_HEADER, D7_SECTION, D7ImportError, readD7, type D7Row } from './d7-import';

export const D7_JSON_VERSION = '1.0.0';
export const D7_INDEX_SECTION = 'Français → Éton';
export const D7_INDEX_HEADER = ['Mot français', 'Mot éton', 'Catégorie', 'Classe / pluriel', 'N° dans « Éton → Français »'];
export const D7_GRAMMAR_SECTION = 'Grammaire & phrases';

export const BIBLIOGRAPHY = {
  title: 'Dictionnaire éton–français',
  authors: ['Mark Van de Velde', 'Kisito Essele Essele'],
  publisher: 'Éditions CLÉ, Yaoundé',
  year: 2022,
  hal: 'https://shs.hal.science/halshs-03847045',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr',
} as const;

/* ------------------------------------------------------------------ */
/* Types du JSON produit                                               */
/* ------------------------------------------------------------------ */

export interface D7Example {
  eto: string;
  fr: string;
}

export interface D7Relation {
  type: 'synonyme' | 'antonyme' | 'voir';
  eto: string;
  fr?: string;
  /** Numéro du sens (« 1) », « 2) »…) auquel le renvoi est attaché, si l'entrée en a plusieurs. */
  sense?: number;
}

export interface D7Note {
  type: 'litteral' | 'usage' | 'emprunt' | 'singulatif';
  text: string;
  sense?: number;
}

export interface D7Sense {
  /** Numéro du sens dans le livre, ou null si l'entrée n'a qu'un sens non numéroté. */
  n: number | null;
  definition: string;
  examples: D7Example[];
}

export interface D7LexEntry {
  /** Numéro de ligne dans le lexique (colonne « N° »). */
  n: number;
  headword: string;
  /** Forme sans numéro d'homonyme. */
  form: string;
  homonym: number | null;
  variants: string[];
  category: string;
  /** Abréviation de catégorie du livre (« n », « v », « n adj »…), si présente. */
  abbreviation: string | null;
  nounClass: string | null;
  plural: string | null;
  /** Colonne « Traduction française » : première définition, extraite par le lexique. */
  french: string;
  page: number;
  senses: D7Sense[];
  relations: D7Relation[];
  idioms: (D7Example & { sense?: number })[];
  proverbs: D7Example[];
  notes: D7Note[];
  /** Colonne « Entrée complète (avec exemples) », telle quelle. */
  full: string;
  /** Passages que le découpage n'a pas su classer (restent lisibles dans `full`). */
  issues: string[];
}

export interface D7IndexRow {
  fr: string;
  eto: string;
  category: string;
  classPlural: string | null;
  n: number;
}

export interface GrammarTable {
  title: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface D7Json {
  version: string;
  source: typeof BIBLIOGRAPHY & { file: string; sha256: string; note: string };
  readme: string[];
  entries: D7LexEntry[];
  frenchIndex: D7IndexRow[];
  grammar: { intro: string[]; tables: GrammarTable[] };
}

export type EsquisseBlock =
  | { type: 'paragraphe'; text: string }
  | { type: 'tableau'; caption: string | null; columns: string[]; rows: string[][] }
  | { type: 'exemples'; examples: { n: string; text: string }[] };

export interface EsquisseSection {
  number: string;
  title: string;
  level: number;
  blocks: EsquisseBlock[];
}

export interface EsquisseJson {
  version: string;
  source: typeof BIBLIOGRAPHY & { file: string; sha256: string; pages: string; note: string };
  sections: EsquisseSection[];
}

/* ------------------------------------------------------------------ */
/* Mots éton / français                                                */
/* ------------------------------------------------------------------ */

const VOWELS = new Set([...'aeiouəɛɔAEIOUƏƐƆ']);
const TONES = new Set(['\u0300', '\u0301', '\u0302', '\u030C', '\u030B', '\u0304']);
const NASALS = new Set([...'mnŋɲ']);
/** Mots français dont toutes les voyelles portent un accent : jamais lus comme de l'éton en fin de suite. */
const FRENCH_ACCENTED = new Set(['à', 'où', 'là', 'déjà', 'voilà']);
const EDGE_PUNCT = /^[«»"“”(‘’.,;:!?…]+|[«»"“”)‘’.,;:!?…]+$/gu;

/** Lettres et tons qui n'existent pas en français : un mot qui en contient est forcément éton. */
const ETON_ONLY = /[əɛɔŋɲꜜ\u030C\u030B\u0304]/u;

/** Forme française connue (lexique Lefff du dépôt) : départage « très », « côté », « né »… d'un mot éton. */
export type FrenchWordTest = (word: string) => boolean;

/**
 * Vrai si toutes les voyelles du mot portent un ton (ou s'il n'a qu'une nasale syllabique tonalisée)
 * et que ce n'est pas un mot français entièrement accentué (« très », « côté »).
 */
export function isEtonWord(token: string, isFrench: FrenchWordTest = () => false): boolean {
  const word = token.replace(EDGE_PUNCT, '');
  if (word === '' || /\d/u.test(word) || checkEtonCharacters(word).length > 0) return false;
  if (/[A-Z]/u.test(word)) return false;
  if (!ETON_ONLY.test(word.normalize('NFD')) && word.split(/['’]/u).some((w) => w !== '' && isFrench(w.toLowerCase()))) return false;
  const parts = [...word.normalize('NFD')];
  let vowels = 0;
  let toned = 0;
  for (let i = 0; i < parts.length; i++) {
    const ch = parts[i] as string;
    const isVowel = VOWELS.has(ch);
    const isSyllabicNasal = NASALS.has(ch) && TONES.has(parts[i + 1] ?? '');
    if (!isVowel && !isSyllabicNasal) continue;
    if (isVowel) vowels++;
    let j = i + 1;
    let hasTone = false;
    while (j < parts.length && /\p{M}/u.test(parts[j] as string)) {
      if (TONES.has(parts[j] as string)) hasTone = true;
      j++;
    }
    if (hasTone) toned++;
    else if (isVowel) return false;
  }
  return toned > 0 && (vowels === 0 || toned >= vowels);
}

/**
 * Découpe un texte en définition (français avant le premier exemple), puis en paires éton → français.
 * Un exemple sans traduction française est signalé dans `issues`.
 */
export function splitExamples(text: string, isFrench?: FrenchWordTest): { definition: string; examples: D7Example[]; issues: string[] } {
  const tokens = text.split(/\s+/u).filter((t) => t !== '');
  const runs: { eto: boolean; words: string[] }[] = [];
  for (const t of tokens) {
    const eto = isEtonWord(t, isFrench);
    const last = runs[runs.length - 1];
    if (last && last.eto === eto) last.words.push(t);
    else runs.push({ eto, words: [t] });
  }
  // « à », « où »… en fin de suite éton, suivis de français : rendus au français.
  for (let i = 0; i < runs.length - 1; i++) {
    const run = runs[i] as (typeof runs)[number];
    const next = runs[i + 1] as (typeof runs)[number];
    if (!run.eto || next.eto) continue;
    while (run.words.length > 1 && FRENCH_ACCENTED.has((run.words[run.words.length - 1] as string).replace(EDGE_PUNCT, '').toLowerCase())) {
      next.words.unshift(run.words.pop() as string);
    }
  }
  // Une suite éton isolée faite seulement de mots français accentués est du français.
  for (const run of runs) {
    if (run.eto && run.words.every((w) => FRENCH_ACCENTED.has(w.replace(EDGE_PUNCT, '').toLowerCase()))) run.eto = false;
  }
  const merged: typeof runs = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.eto === run.eto) last.words.push(...run.words);
    else merged.push({ eto: run.eto, words: [...run.words] });
  }
  let definition = '';
  const examples: D7Example[] = [];
  const issues: string[] = [];
  let i = 0;
  if (merged[0] && !merged[0].eto) {
    definition = merged[0].words.join(' ');
    i = 1;
  }
  for (; i < merged.length; i += 2) {
    const eto = (merged[i] as (typeof merged)[number]).words.join(' ');
    const fr = merged[i + 1]?.words.join(' ') ?? '';
    if (fr === '') issues.push(`exemple éton sans traduction : « ${eto} »`);
    else examples.push({ eto, fr });
  }
  return { definition: definition.replace(/\s*\.$/u, ''), examples, issues };
}

/* ------------------------------------------------------------------ */
/* Entrée complète                                                     */
/* ------------------------------------------------------------------ */

const ABBREVIATIONS = ['n adj', 'v rés', 'v res', 'q aux', 'idéo', 'prép', 'adv', 'adj', 'int', 'num', 'pro', 'sub', 'prt', 'n', 'v'];
const LABELS: Readonly<Record<string, string>> = {
  'Voir': 'voir', 'Syn': 'synonyme', 'Ant': 'antonyme', 'Idiom': 'idiom', 'Litt': 'litteral', 'Litt.': 'litteral',
  'Usage': 'usage', 'Proverbe': 'proverbe', 'Singulatif': 'singulatif', 'Empr. de': 'emprunt',
};
const LABEL_RE = /(?<=^|\s)(Voir|Syn|Ant|Idiom|Litt\.?|Usage|Proverbe|Singulatif|Empr\. de):\s*/gu;

/** Retire le mot-vedette en tête de `full`, en tolérant les espaces ajoutés par l'extraction (« m̀ -mád »). */
export function stripHeadword(full: string, headword: string): string | null {
  const head = [...headword.replace(/\s+/gu, '')];
  let i = 0;
  const chars = [...full];
  for (const ch of head) {
    while (i < chars.length && /\s/u.test(chars[i] as string)) i++;
    if (chars[i] !== ch) return null;
    i++;
  }
  return chars.slice(i).join('').trim();
}

/**
 * Fin de la valeur d'une étiquette dans `text` (index exclu) :
 * - renvois (Voir, Syn, Ant), usage, emprunt : jusqu'au premier point hors guillemets ;
 * - Litt, Idiom, Proverbe : jusqu'au guillemet fermant ’ (non suivi d'une lettre, ≠ « n’est ») et son point.
 * Ce qui suit (exemples, sens suivant) retourne au texte principal.
 */
export function valueEnd(kind: string, text: string): number {
  const quoted = kind === 'litteral' || kind === 'idiom' || kind === 'proverbe';
  let inQuote = false;
  let sawQuote = false;
  const chars = [...text];
  let offset = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    const next = chars[i + 1] ?? '';
    if (ch === '‘') { inQuote = true; sawQuote = true; }
    else if (ch === '’' && inQuote && !/\p{L}/u.test(next)) {
      inQuote = false;
      if (quoted) {
        const tail = /^\.?/u.exec(chars.slice(i + 1).join(''))?.[0] ?? '';
        return offset + ch.length + tail.length;
      }
    } else if (ch === '.' && !inQuote && (next === '' || /\s/u.test(next)) && !(quoted && !sawQuote && kind !== 'litteral')) {
      return offset + 1;
    }
    offset += ch.length;
  }
  return text.length;
}

/** Ignore les marques de sens « 1) » dans le comptage des parenthèses. */
const openParens = (s: string): number => {
  const t = s.replace(/(?<=^|\s)\d+\)(?=\s)/gu, '');
  return (t.match(/\(/gu) ?? []).length - (t.match(/\)/gu) ?? []).length;
};

/** Positions des étiquettes hors parenthèses (« (Litt.: …) » dans une traduction reste dans l'exemple). */
function labelPositions(text: string): { start: number; end: number; label: string }[] {
  const out: { start: number; end: number; label: string }[] = [];
  for (const m of text.matchAll(LABEL_RE)) {
    if (openParens(text.slice(0, m.index)) > 0) continue;
    out.push({ start: m.index, end: m.index + m[0].length, label: m[1] as string });
  }
  return out;
}

/** Paires « éton ‘français’ » d'un renvoi ; l'apostrophe ’ suivie d'une lettre (n’est) n'est pas un guillemet fermant. */
export function parseQuoted(text: string): { eto: string; fr?: string }[] {
  const items: { eto: string; fr?: string }[] = [];
  const re = /([^‘;]*?)\s*‘(.*?)’(?!\p{L})/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const between = text.slice(last, m.index).replace(/^[\s;.,]+|[\s;.,]+$/gu, '');
    for (const bare of between.split(/[;,]\s*/u)) if (bare.trim()) items.push({ eto: bare.trim() });
    const eto = (m[1] as string).replace(/^[\s;.,]+|[\s;.,]+$/gu, '');
    if (eto) items.push({ eto, fr: (m[2] as string).trim() });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = text.slice(last).replace(/^[\s;.,]+|[\s;.,]+$/gu, '');
  if (rest) for (const bare of rest.split(/[;,]\s*/u)) if (bare.trim()) items.push({ eto: bare.trim().replace(/\.$/u, '') });
  return items;
}

const trimEnd = (s: string): string => s.replace(/[\s.]+$/u, '').trim();

export interface LexiconCells {
  row: D7Row;
  variants: string;
  plural: string;
  full: string;
}

/** Découpe l'« Entrée complète » d'une ligne du lexique. */
export function parseEntry({ row, variants, plural, full }: LexiconCells, isFrench?: FrenchWordTest): D7LexEntry {
  const entry: D7LexEntry = {
    n: row.n, headword: row.headword, form: row.form, homonym: row.homonym,
    variants: variants ? variants.replace(/\.$/u, '').split(/,\s*/u).map((v) => v.trim()).filter(Boolean) : [],
    category: row.category, abbreviation: null, nounClass: row.nounClass, plural: plural ? plural.replace(/\.$/u, '') : null,
    french: row.french, page: row.page, senses: [], relations: [], idioms: [], proverbs: [], notes: [], full, issues: [],
  };
  let rest = stripHeadword(full, row.headword);
  if (rest === null) {
    entry.issues.push('mot-vedette absent du début de l’entrée complète');
    return entry;
  }
  const variantPrefix = variants ? `Variante: ${variants}` : null;
  if (variantPrefix && rest.startsWith(variantPrefix)) rest = rest.slice(variantPrefix.length).replace(/^\./u, '').trim();
  else rest = rest.replace(/^Variante?:\s*.*?\.(?:\s|$)/u, '');
  for (const abbr of ABBREVIATIONS) {
    if (rest.startsWith(`${abbr}.`) && /[\s]|$/u.test(rest.charAt(abbr.length + 1) || ' ')) {
      entry.abbreviation = abbr;
      rest = rest.slice(abbr.length + 1).trim();
      break;
    }
  }
  const stripField = (label: string, value: string | null): void => {
    const exact = value ? `${label}: ${value}.` : null;
    if (exact && rest!.startsWith(exact)) rest = rest!.slice(exact.length).trim();
    else rest = rest!.replace(new RegExp(`^${label}:\\s*\\S+?\\.(?:\\s|$)`, 'u'), '').trim();
  };
  stripField('Cl', row.nounClass);
  stripField('Pl', entry.plural);

  // Sens numérotés « 1) », « 2) »… (hors parenthèses).
  const senseParts: { n: number | null; text: string }[] = [];
  const marks = [...rest.matchAll(/(?<=^|\s)(\d+)\)\s/gu)].filter((m) => openParens(rest!.slice(0, m.index)) === 0);
  const numbered = marks.length > 0 && marks[0]?.index === 0 && marks.every((m, k) => Number(m[1]) === k + 1);
  if (numbered) {
    marks.forEach((m, k) => {
      const end = marks[k + 1]?.index ?? rest!.length;
      senseParts.push({ n: Number(m[1]), text: rest!.slice((m.index ?? 0) + m[0].length, end).trim() });
    });
  } else senseParts.push({ n: null, text: rest });

  for (const part of senseParts) {
    const sense = part.n !== null ? { sense: part.n } : {};
    const main: string[] = [];
    let text = part.text;
    for (;;) {
      const labels = labelPositions(text);
      const l = labels[0];
      if (!l) {
        main.push(text);
        break;
      }
      main.push(text.slice(0, l.start));
      const limit = labels[1]?.start ?? text.length;
      const after = text.slice(l.end, limit);
      const kind = LABELS[l.label] as string;
      const cut = valueEnd(kind, after);
      const value = after.slice(0, cut).trim();
      text = after.slice(cut) + text.slice(limit);
      if (kind === 'voir' || kind === 'synonyme' || kind === 'antonyme') {
        for (const item of parseQuoted(value)) {
          entry.relations.push({ type: kind, eto: item.eto, ...(item.fr !== undefined ? { fr: item.fr } : {}), ...sense });
        }
      } else if (kind === 'idiom' || kind === 'proverbe') {
        const items = parseQuoted(value).filter((x): x is D7Example => x.fr !== undefined);
        if (items.length === 0) entry.issues.push(`${l.label} sans traduction : « ${value} »`);
        for (const item of items) {
          if (kind === 'idiom') entry.idioms.push({ eto: item.eto, fr: item.fr, ...sense });
          else entry.proverbs.push({ eto: item.eto, fr: item.fr });
        }
      } else {
        entry.notes.push({ type: kind as D7Note['type'], text: trimEnd(value.replace(/^‘(.*)’\.?$/u, '$1')), ...sense });
      }
    }
    const { definition, examples, issues } = splitExamples(main.join(' ').replace(/\s+/gu, ' ').trim(), isFrench);
    entry.senses.push({ n: part.n, definition, examples });
    entry.issues.push(...issues);
  }
  return entry;
}

/* ------------------------------------------------------------------ */
/* Lexique, index, grammaire de D7                                     */
/* ------------------------------------------------------------------ */

function tablesOf(markdown: string): MarkdownTable[] {
  try {
    return parseMarkdownTables(markdown.normalize('NFC'));
  } catch (error) {
    if (error instanceof ImportError) throw new D7ImportError(error.problems);
    throw error;
  }
}

/** Colonnes reprises : ni « English », ni colonnes vides de titre. */
const keptColumn = (title: string): boolean => title !== '' && !/^English/iu.test(title);

/** Paragraphes de texte (hors tableaux et titres) d'une section `##` du Markdown. */
function sectionText(markdown: string, h2: string): string[] {
  const lines = markdown.normalize('NFC').split(/\r?\n/u);
  const start = lines.findIndex((l) => l.trim() === `## ${h2}`);
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const t = line.trim();
    if (t === '' || t.startsWith('|') || t.startsWith('#')) continue;
    out.push(t);
  }
  return out;
}

export function convertD7(markdown: string, meta: { file: string; sha256: string }, isFrench?: FrenchWordTest): D7Json {
  const rows = readD7(markdown);
  const tables = tablesOf(markdown);
  const lexicon = tables.find((t) => t.h2 === D7_SECTION) as MarkdownTable;
  const col = (name: string): number => D7_HEADER.indexOf(name);
  const entries = lexicon.rows.map(({ cells }, i) => parseEntry({
    row: rows[i] as D7Row,
    variants: cells[col('Variante(s)')] ?? '',
    plural: cells[col('Pluriel')] ?? '',
    full: cells[col('Entrée complète (avec exemples)')] ?? '',
  }, isFrench));

  const index = tables.filter((t) => t.h2 === D7_INDEX_SECTION);
  if (index.length !== 1 || (index[0] as MarkdownTable).header.join('|') !== D7_INDEX_HEADER.join('|')) {
    throw new D7ImportError([`tableau « ${D7_INDEX_SECTION} » absent ou en-tête inattendu`]);
  }
  const frenchIndex = (index[0] as MarkdownTable).rows.map(({ line, cells }): D7IndexRow => {
    const [fr, eto, category, classPlural, n] = cells as string[];
    if (!/^\d+$/u.test(n ?? '') || Number(n) < 1 || Number(n) > rows.length) {
      throw new D7ImportError([`ligne ${line} : n° « ${n} » hors du lexique`]);
    }
    return { fr: fr ?? '', eto: eto ?? '', category: category ?? '', classPlural: classPlural || null, n: Number(n) };
  });

  const grammarTables = tables.filter((t) => t.h2 === D7_GRAMMAR_SECTION).map((t): GrammarTable => {
    const kept = t.header.map((h, i) => ({ h, i })).filter(({ h }) => keptColumn(h));
    return {
      title: t.h3,
      columns: kept.map(({ h }) => h),
      rows: t.rows.map(({ cells }) => Object.fromEntries(kept.map(({ h, i }) => [h, cells[i] ?? '']))),
    };
  });
  if (grammarTables.length === 0) throw new D7ImportError([`section « ${D7_GRAMMAR_SECTION} » sans tableau`]);

  return {
    version: D7_JSON_VERSION,
    source: {
      ...BIBLIOGRAPHY, ...meta,
      note: 'Lexique extrait du PDF du livre. Colonnes « English » (traductions ajoutées par Claude, absentes du livre) non reprises.',
    },
    readme: sectionText(markdown, 'Lisez-moi'),
    entries,
    frenchIndex,
    grammar: { intro: sectionText(markdown, D7_GRAMMAR_SECTION), tables: grammarTables },
  };
}

/* ------------------------------------------------------------------ */
/* Esquisse grammaticale (HAL)                                         */
/* ------------------------------------------------------------------ */

const splitRow = (line: string): string[] =>
  line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((c) => c.trim());

/** Exemples numérotés d'un bloc de code : « (169) … » jusqu'au numéro suivant, texte gardé tel quel. */
export function splitNumberedExamples(lines: readonly string[]): { n: string; text: string }[] {
  const out: { n: string; text: string[] }[] = [];
  for (const line of lines) {
    const m = /^\((\d+)\)\s?(.*)$/u.exec(line);
    if (m) out.push({ n: m[1] as string, text: [m[2] as string] });
    else if (out.length > 0) (out[out.length - 1] as (typeof out)[number]).text.push(line);
    else out.push({ n: '', text: [line] });
  }
  return out.map(({ n, text }) => ({ n, text: text.join('\n').replace(/\s+$/u, '') }));
}

export function convertEsquisse(markdown: string, meta: { file: string; sha256: string }): EsquisseJson {
  const lines = markdown.normalize('NFC').split(/\r?\n/u);
  const sections: EsquisseSection[] = [];
  const notes: string[] = [];
  let paragraph: string[] = [];
  let current: EsquisseSection | null = null;
  const push = (block: EsquisseBlock): void => {
    if (!current) throw new D7ImportError([`esquisse : contenu avant la première section (« ${JSON.stringify(block).slice(0, 60)} »)`]);
    current.blocks.push(block);
  };
  const flush = (): void => {
    if (paragraph.length > 0) push({ type: 'paragraphe', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const t = line.trim();
    if (t.startsWith('# ')) continue;
    if (t.startsWith('>')) {
      const note = t.replace(/^>\s?/u, '');
      if (note) notes.push(note);
      continue;
    }
    const heading = /^(#{2,4})\s+(\d+(?:\.\d+)*)\.?\s+(.*)$/u.exec(t);
    if (heading) {
      flush();
      current = { number: heading[2] as string, title: (heading[3] as string).trim(), level: (heading[1] as string).length, blocks: [] };
      sections.push(current);
      continue;
    }
    if (t.startsWith('```')) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !(lines[i] as string).trim().startsWith('```'); i++) body.push(lines[i] as string);
      push({ type: 'exemples', examples: splitNumberedExamples(body) });
      continue;
    }
    if (t.startsWith('|')) {
      flush();
      const header = splitRow(t);
      const rows: string[][] = [];
      for (i++; i < lines.length && (lines[i] as string).trim().startsWith('|'); i++) {
        const cells = splitRow(lines[i] as string);
        if (cells.every((c) => /^:?-+:?$/u.test(c))) continue;
        rows.push(cells);
      }
      i--;
      push({ type: 'tableau', caption: null, columns: header, rows });
      continue;
    }
    const caption = /^\*\*(Tableau .*?)\*\*$/u.exec(t);
    if (caption) {
      flush();
      const last = current?.blocks[current.blocks.length - 1];
      if (last?.type === 'tableau' && last.caption === null) last.caption = caption[1] as string;
      else push({ type: 'paragraphe', text: caption[1] as string });
      continue;
    }
    if (t === '') flush();
    else paragraph.push(t);
  }
  flush();
  if (sections.length === 0) throw new D7ImportError(['esquisse : aucune section numérotée']);
  return {
    version: D7_JSON_VERSION,
    source: { ...BIBLIOGRAPHY, ...meta, pages: '18-70 (section 8 « Esquisse grammaticale »)', note: notes.join(' ') },
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* Retour au format du moteur                                          */
/* ------------------------------------------------------------------ */

/** Lignes du lexique (format de l'import historique) reconstruites depuis le JSON versionné. */
export function rowsFromJson(json: Pick<D7Json, 'entries'>): D7Row[] {
  return json.entries.map(({ n, headword, form, homonym, category, nounClass, french, page }) =>
    ({ n, headword, form, homonym, category, nounClass, french, page }));
}

/** Chiffres de contrôle du découpage, affichés par le script. */
export function conversionStats(json: D7Json): Record<string, number> {
  const e = json.entries;
  return {
    entrees: e.length,
    sens: e.reduce((s, x) => s + x.senses.length, 0),
    exemples: e.reduce((s, x) => s + x.senses.reduce((k, y) => k + y.examples.length, 0), 0),
    renvois: e.reduce((s, x) => s + x.relations.length, 0),
    idiomes: e.reduce((s, x) => s + x.idioms.length, 0),
    proverbes: e.reduce((s, x) => s + x.proverbs.length, 0),
    variantes: e.reduce((s, x) => s + x.variants.length, 0),
    entreesAvecSignalement: e.filter((x) => x.issues.length > 0).length,
    indexFrancais: json.frenchIndex.length,
    tableauxGrammaire: json.grammar.tables.length,
  };
}
