/**
 * Import de D8 (docs/sources/corpus_fusionne_SAFINUM_Eton.md) → entrées de data/ (BM2.1 à BM2.3).
 *
 * Fonctions pures : lecture du Markdown, contrôles de cohérence, construction des entrées.
 * L'écriture des fichiers est faite par scripts/import-sources.ts. Toute incohérence de D8
 * arrête l'import (aucune entrée « devinée »). Aucune forme Éton n'est produite.
 */
import { comparisonKey, containsWord, splitSentences, templateLabel } from './compare-text';
import { extractVariables } from './eton-charset';
import {
  pendingEtoTarget,
  type EntryKind,
  type LibraryEntry,
  type Sensitivity,
  type Variable,
  type VariableType,
} from './library-entry';

export const D8_ORIGIN = 'D8';

/* ------------------------------------------------------------------ */
/* Lecture des tableaux Markdown                                       */
/* ------------------------------------------------------------------ */

export interface MarkdownTable {
  h2: string;
  h3: string;
  header: string[];
  rows: { line: number; cells: string[] }[];
}

const splitRow = (line: string): string[] =>
  line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((c) => c.trim());

/** Lit tous les tableaux Markdown, avec le titre `##` et `###` qui les précède. */
export function parseMarkdownTables(markdown: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  let h2 = '';
  let h3 = '';
  let current: MarkdownTable | null = null;
  markdown.split(/\r?\n/u).forEach((line, index) => {
    if (line.startsWith('## ')) { h2 = line.slice(3).trim(); h3 = ''; current = null; return; }
    if (line.startsWith('### ')) { h3 = line.slice(4).trim(); current = null; return; }
    if (!line.trimStart().startsWith('|')) { current = null; return; }
    const cells = splitRow(line);
    if (current === null) {
      current = { h2, h3, header: cells, rows: [] };
      tables.push(current);
      return;
    }
    if (cells.every((c) => /^:?-+:?$/u.test(c))) return;
    if (cells.length !== current.header.length) {
      throw new ImportError([`ligne ${index + 1} : ${cells.length} cellules au lieu de ${current.header.length} (un « | » dans une cellule ?)`]);
    }
    current.rows.push({ line: index + 1, cells });
  });
  return tables;
}

export class ImportError extends Error {
  constructor(readonly problems: string[]) {
    super(`Import D8 refusé (${problems.length} problème(s)) :\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ImportError';
  }
}

/* ------------------------------------------------------------------ */
/* Structure de D8                                                     */
/* ------------------------------------------------------------------ */

const CORPUS_HEADER = ['ID', 'Terme français', 'Synonymes simples', 'Définition simple', 'Source',
  'Présent sur les pages (texte exact)', 'Catégorie', 'Sous-catégorie', 'Remarque'];
const ADDITIONS_HEADER = ['ID', 'Terme français', 'Synonymes simples', 'Définition simple', 'Page et numéro', 'Page', 'Remarque'];
const CONTROL_HEADER = ['Page - N°', 'Texte français (page)', 'Résultat', 'ID dans le fichier fusionné', 'Terme du fichier fusionné'];
const SUMMARY_HEADER = ['Indicateur', 'Valeur'];

/** Sections du corpus fusionné : préfixe d'ID, titre `###`, fichier de sortie et type d'entrée. */
export const CORPUS_SECTIONS = [
  { prefix: 'VOC', title: 'Vocabulaire financier', file: 'vocabulaire-financier.json', kind: 'term' },
  { prefix: 'ACT', title: 'Actions financières', file: 'actions-financieres.json', kind: 'action' },
  { prefix: 'SEC', title: 'Sécurité financière', file: 'securite-financiere.json', kind: 'security' },
  { prefix: 'MSG', title: 'Phrases et messages', file: 'phrases-et-messages.json', kind: 'message' },
  { prefix: 'PAG', title: 'Ajout depuis les pages', file: 'ajouts-depuis-les-pages.json', kind: 'message' },
] as const satisfies readonly { prefix: string; title: string; file: string; kind: EntryKind }[];

export const GUARD_FILE = 'entrees-protegees.json';
export const pageFile = (step: number): string => `page-${step}.json`;

/** Jetons protégés (BM2.3) : jamais traduits, toujours recopiés tels quels. */
export const GUARD_TOKENS = [
  { id: 'GUARD-001', text: 'Safinum', notes: 'Nom de marque : ne jamais traduire (D8 PAG-010, PROJECT_CONTEXT §3.6-3).' },
  { id: 'GUARD-002', text: 'Safinum Pay', notes: 'Nom de marque : ne jamais traduire (PROJECT_CONTEXT §3.6-3).' },
  { id: 'GUARD-003', text: 'FCFA', notes: 'Code de devise : toujours protégé, même dans « Franc CFA (FCFA) » (PROJECT_CONTEXT §3.3).' },
  { id: 'GUARD-004', text: 'XAF', notes: 'Code de devise ISO 4217 : toujours protégé.' },
] as const;

/**
 * Type de chaque variable de D8. Une variable absente de cette table arrête l'import :
 * son type doit être décidé (il sert au moteur pour vérifier la valeur, ROADMAP BM5.2).
 */
export const VARIABLE_TYPES: Readonly<Record<string, VariableType>> = {
  montant: 'amount',
  frais: 'amount',
  total: 'amount',
  devise: 'currency',
  date: 'date',
  heure: 'time',
  durée: 'duration',
  nom: 'name',
  nom_bénéficiaire: 'name',
  numéro_compte: 'account-number',
  référence: 'reference',
  // SEC-052 et MSG-057 : « envoyé au {numéro} » (code ou reçu envoyé par SMS). À confirmer en S1.
  numéro: 'phone',
};

const SENSITIVITY: Readonly<Record<string, Exclude<Sensitivity, null>>> = {
  Critique: 'critical',
  Élevée: 'high',
  Standard: 'standard',
};

/** Indicateurs du résumé de D8 et valeur attendue calculée sur les tableaux. */
const SUMMARY_KEYS = {
  rows: 'Lignes dans le fichier fusionné',
  corpusOnly: 'Termes seulement dans le corpus',
  both: 'Termes présents dans les deux fichiers',
  added: 'Termes ajoutés depuis les pages (absents du corpus)',
  pagesInCorpus: 'Textes des pages déjà au corpus',
  pagesAdded: 'Textes des pages ajoutés',
  pages: 'Total des textes des pages',
} as const;

export interface D8CorpusRow {
  line: number;
  section: string;
  id: string;
  term: string;
  synonyms: string;
  definition: string;
  source: string;
  presentOnPages: string;
  category: string;
  subcategory: string;
  remark: string;
}

export interface D8PageRow {
  line: number;
  pageId: string;
  text: string;
  result: string;
  corpusId: string;
  corpusTerm: string;
}

export interface D8Source {
  summary: Map<string, number>;
  corpus: D8CorpusRow[];
  additionsView: string[][];
  control: D8PageRow[];
}

/** Lit D8 et vérifie la forme de ses tableaux (en-têtes exacts, sections attendues). */
export function readD8(markdown: string): D8Source {
  const tables = parseMarkdownTables(markdown.normalize('NFC'));
  const problems: string[] = [];
  const find = (h2: string, header: string[]): MarkdownTable[] => {
    const found = tables.filter((t) => t.h2 === h2);
    if (found.length === 0) problems.push(`section « ## ${h2} » introuvable`);
    for (const t of found) {
      if (t.header.join('|') !== header.join('|')) {
        problems.push(`en-tête inattendu dans « ${h2}${t.h3 ? ` / ${t.h3}` : ''} » : ${t.header.join(' | ')}`);
      }
    }
    return found;
  };

  const summaryTables = find('Résumé', SUMMARY_HEADER);
  const corpusTables = find('Corpus fusionné', CORPUS_HEADER);
  const additionsTables = find('Ajouts depuis les pages', ADDITIONS_HEADER);
  const controlTables = find('Contrôle des 60 textes', CONTROL_HEADER);

  const sectionTitles = corpusTables.map((t) => t.h3);
  const expectedTitles = CORPUS_SECTIONS.map((s) => s.title);
  if (sectionTitles.join('|') !== expectedTitles.join('|')) {
    problems.push(`sections du corpus inattendues : ${sectionTitles.join(', ')} (attendu : ${expectedTitles.join(', ')})`);
  }
  if (problems.length > 0) throw new ImportError(problems);

  const summary = new Map<string, number>();
  for (const { cells } of summaryTables.flatMap((t) => t.rows)) {
    summary.set(cells[0] ?? '', Number(cells[1]));
  }

  const corpus = corpusTables.flatMap((t) => t.rows.map(({ line, cells }) => {
    const [id = '', term = '', synonyms = '', definition = '', source = '', presentOnPages = '',
      category = '', subcategory = '', remark = ''] = cells;
    return { line, section: t.h3, id, term, synonyms, definition, source, presentOnPages, category, subcategory, remark };
  }));

  const control = controlTables.flatMap((t) => t.rows.map(({ line, cells }) => {
    const [pageId = '', text = '', result = '', corpusId = '', corpusTerm = ''] = cells;
    return { line, pageId, text, result, corpusId, corpusTerm };
  }));

  return { summary, corpus, additionsView: additionsTables.flatMap((t) => t.rows.map((r) => r.cells)), control };
}

/* ------------------------------------------------------------------ */
/* Construction des entrées                                            */
/* ------------------------------------------------------------------ */

export interface ImportedFile {
  name: string;
  entries: LibraryEntry[];
}

export interface ImportResult {
  corpusFiles: ImportedFile[];
  pageFiles: ImportedFile[];
  stats: {
    corpusEntries: number;
    guardEntries: number;
    pageEntries: number;
    uniquePageTexts: number;
    exactLinks: number;
    meaningLinks: number;
    pagLinks: number;
    templateRefs: string[];
    pagesWithTemplateRefs: string[];
    mergedFrom: Record<string, string[]>;
    renamedEtonFin: number;
  };
}

const PAGE_REF = /^(P[1-5]-\d{1,3}) « (.+) »$/u;
const SENTENCE_END = /[.!?…:]$/u;

/** Une phrase (ou un gabarit) a une reformulation ; un terme a une liste de synonymes séparés par des virgules. */
const isSentenceLike = (term: string): boolean => SENTENCE_END.test(term) || extractVariables(term).length > 0;

/**
 * Découpe la colonne « Synonymes simples ».
 * - Terme : liste séparée par des virgules.
 * - Phrase : la reformulation est gardée entière ; elle n'est découpée en phrases que si la source
 *   tient en une phrase et la reformulation en plusieurs (alternatives, ex. MSG-001).
 * Le découpage doit être sans perte : rejoindre les morceaux redonne la cellule de D8.
 */
export function splitSynonyms(term: string, cell: string): { synonyms: string[]; separator: string } {
  if (cell === '') return { synonyms: [], separator: '' };
  if (!isSentenceLike(term)) return { synonyms: cell.split(',').map((s) => s.trim()), separator: ', ' };
  const sentences = splitSentences(cell);
  if (splitSentences(term).length === 1 && sentences.length > 1) return { synonyms: sentences, separator: ' ' };
  return { synonyms: [cell], separator: '' };
}

const replaceEtonFin = (text: string, counter: { n: number }): string =>
  text.replace(/EtonFin/gu, () => { counter.n += 1; return 'FinEthnic'; });

const sortedSet = (values: Iterable<string>): string => [...new Set(values)].sort().join(',');

/** Construit les entrées de data/ à partir de D8. Lève ImportError à la première série d'incohérences. */
export function buildLibraryFromD8(d8: D8Source): ImportResult {
  const problems: string[] = [];
  const renamed = { n: 0 };
  const at = (row: { line: number }, message: string): void => { problems.push(`D8 ligne ${row.line} : ${message}`); };

  /* --- Résumé de D8 --- */
  const count = (predicate: (r: D8CorpusRow) => boolean): number => d8.corpus.filter(predicate).length;
  const expected: Record<keyof typeof SUMMARY_KEYS, number> = {
    rows: d8.corpus.length,
    corpusOnly: count((r) => r.source === 'Corpus'),
    both: count((r) => r.source === 'Les deux'),
    added: count((r) => r.source === 'Pages'),
    pagesInCorpus: d8.control.filter((r) => r.result === 'Déjà au corpus').length,
    pagesAdded: d8.control.filter((r) => r.result === 'Ajouté').length,
    pages: d8.control.length,
  };
  for (const [key, label] of Object.entries(SUMMARY_KEYS) as [keyof typeof SUMMARY_KEYS, string][]) {
    const announced = d8.summary.get(label);
    if (announced !== expected[key]) problems.push(`résumé de D8 : « ${label} » = ${String(announced)}, mais ${expected[key]} ligne(s) trouvée(s)`);
  }

  /* --- Entrées du corpus --- */
  const byId = new Map<string, D8CorpusRow>();
  for (const row of d8.corpus) {
    const section = CORPUS_SECTIONS.find((s) => s.title === row.section);
    if (!section || !new RegExp(`^${section.prefix}-\\d{3}$`, 'u').test(row.id)) at(row, `ID « ${row.id} » inattendu dans la section « ${row.section} »`);
    if (byId.has(row.id)) at(row, `ID en double : ${row.id}`);
    byId.set(row.id, row);
    if (row.term === '') at(row, `${row.id} : terme vide`);
    if (row.category !== row.section) at(row, `${row.id} : catégorie « ${row.category} » ≠ section « ${row.section} »`);
    const isPag = row.id.startsWith('PAG-');
    const hasPages = row.presentOnPages !== '';
    const sourceOk = row.source === 'Corpus' ? !hasPages && !isPag
      : row.source === 'Les deux' ? hasPages && !isPag
        : row.source === 'Pages' ? hasPages && isPag : false;
    if (!sourceOk) at(row, `${row.id} : colonne Source « ${row.source} » incohérente avec « Présent sur les pages »`);
  }

  /* --- Contrôle des 60 textes ↔ colonne « Présent sur les pages » --- */
  const declaredRefs = new Map<string, { corpusId: string; text: string }>();
  for (const row of d8.corpus) {
    if (row.presentOnPages === '') continue;
    for (const part of row.presentOnPages.split(';').map((p) => p.trim())) {
      const m = PAGE_REF.exec(part);
      if (!m) { at(row, `${row.id} : référence de page illisible « ${part} »`); continue; }
      const [, pageId = '', text = ''] = m;
      if (declaredRefs.has(pageId)) at(row, `${pageId} cité par ${declaredRefs.get(pageId)?.corpusId} et ${row.id}`);
      declaredRefs.set(pageId, { corpusId: row.id, text });
    }
  }
  const pageIds = new Set<string>();
  for (const row of d8.control) {
    if (!/^P[1-5]-\d{1,3}$/u.test(row.pageId)) at(row, `ID de page inattendu « ${row.pageId} »`);
    if (pageIds.has(row.pageId)) at(row, `ID de page en double : ${row.pageId}`);
    pageIds.add(row.pageId);
    const target = byId.get(row.corpusId);
    if (!target) { at(row, `${row.pageId} → ${row.corpusId} : ID absent du corpus`); continue; }
    if (target.term !== row.corpusTerm) at(row, `${row.pageId} : terme « ${row.corpusTerm} » ≠ terme de ${row.corpusId} « ${target.term} »`);
    if ((row.result === 'Ajouté') !== row.corpusId.startsWith('PAG-')) at(row, `${row.pageId} : résultat « ${row.result} » incohérent avec ${row.corpusId}`);
    if (row.result !== 'Ajouté' && row.result !== 'Déjà au corpus') at(row, `${row.pageId} : résultat inconnu « ${row.result} »`);
    const declared = declaredRefs.get(row.pageId);
    if (!declared || declared.corpusId !== row.corpusId || declared.text !== row.text) {
      at(row, `${row.pageId} « ${row.text} » → ${row.corpusId} absent ou différent dans « Présent sur les pages » de ${row.corpusId}`);
    }
  }
  for (const [pageId, { corpusId }] of declaredRefs) {
    if (!pageIds.has(pageId)) problems.push(`${corpusId} cite ${pageId}, absent de « Contrôle des 60 textes »`);
  }

  /* --- « Ajouts depuis les pages » : simple vue des PAG, comparée sans être importée --- */
  const pagRows = d8.corpus.filter((r) => r.id.startsWith('PAG-'));
  const viewKey = (cells: readonly string[]): string => cells.join(' | ');
  const fromCorpus = pagRows.map((r) => viewKey([r.id, r.term, r.synonyms, r.definition, r.presentOnPages, r.subcategory, r.remark]));
  const fromView = d8.additionsView.map(viewKey);
  if (fromCorpus.join('\n') !== fromView.join('\n')) {
    const diff = fromView.filter((v) => !fromCorpus.includes(v)).concat(fromCorpus.filter((v) => !fromView.includes(v)));
    problems.push(`« Ajouts depuis les pages » diffère des entrées PAG du corpus : ${diff.slice(0, 3).join(' ⟂ ')}`);
  }

  if (problems.length > 0) throw new ImportError(problems);

  /* --- Construction des entrées du corpus --- */
  const mergedFrom: Record<string, string[]> = {};
  const corpusEntries = new Map<string, LibraryEntry>();
  for (const row of d8.corpus) {
    const section = CORPUS_SECTIONS.find((s) => s.title === row.section);
    const term = replaceEtonFin(row.term, renamed);
    const names = [...new Set(extractVariables(term))];
    const variables: Variable[] = [];
    for (const name of names) {
      const type = VARIABLE_TYPES[name];
      if (type === undefined) at(row, `${row.id} : variable {${name}} sans type connu (à ajouter à VARIABLE_TYPES)`);
      else variables.push({ name, type });
    }

    const remarkVars = /Variables à ne pas traduire : (.*)$/u.exec(row.remark)?.[1];
    if (sortedSet(extractVariables(remarkVars ?? '')) !== sortedSet(names)) {
      at(row, `${row.id} : variables de « Remarque » (${remarkVars ?? 'aucune'}) ≠ variables du terme (${names.join(', ') || 'aucune'})`);
    }

    const { synonyms, separator } = splitSynonyms(term, replaceEtonFin(row.synonyms, renamed));
    if (synonyms.join(separator) !== replaceEtonFin(row.synonyms, renamed)) at(row, `${row.id} : découpage des synonymes avec perte`);
    if (synonyms.some((s) => s === '')) at(row, `${row.id} : synonyme vide`);
    if (new Set(synonyms).size !== synonyms.length) at(row, `${row.id} : synonyme répété`);
    for (const s of synonyms) {
      if (sortedSet(extractVariables(s)) !== sortedSet(names)) at(row, `${row.id} : la reformulation « ${s} » n'a pas les mêmes variables que le terme`);
    }
    const definition = replaceEtonFin(row.definition, renamed);
    if (extractVariables(definition).some((v) => !names.includes(v))) at(row, `${row.id} : variable de la définition absente du terme`);

    const sensitivityLabel = /Sensibilité : (\p{L}+)/u.exec(row.remark)?.[1];
    const sensitivity = sensitivityLabel === undefined ? null : SENSITIVITY[sensitivityLabel];
    if (sensitivity === undefined) at(row, `${row.id} : sensibilité inconnue « ${sensitivityLabel} »`);

    const merged = [...row.remark.matchAll(/Même texte que ([A-Z]+-\d{3}) \(fusionné\)/gu)].map((m) => m[1] ?? '');
    for (const id of merged) {
      if (byId.has(id)) at(row, `${row.id} : ${id} est noté fusionné mais existe encore`);
    }
    if (merged.length > 0) mergedFrom[row.id] = merged;

    const pageRefs = row.presentOnPages === '' ? [] : row.presentOnPages.split(';').map((p) => PAGE_REF.exec(p.trim())?.[1] ?? '');
    const remark = replaceEtonFin(row.remark, renamed);

    corpusEntries.set(row.id, {
      id: row.id,
      kind: variables.length > 0 ? 'template' : section?.kind ?? 'term',
      category: row.category,
      subcategory: row.subcategory,
      disposition: 'TRANSLATABLE',
      sensitivity: sensitivity ?? null,
      source: { fr: { text: term, variants: [], origin: D8_ORIGIN, simple: { synonyms, definition: definition || null } }, en: null },
      variables,
      target: { eto: pendingEtoTarget() },
      links: {
        corpusRef: null,
        pageRefs,
        templateRefs: [],
        duplicateOf: null,
        relatedTo: [],
        ...(merged.length > 0 ? { mergedFrom: merged } : {}),
      },
      deprecated: false,
      ...(remark ? { notes: remark } : {}),
    });
  }

  /* --- Entrées protégées (GUARD) --- */
  const guardEntries: LibraryEntry[] = GUARD_TOKENS.map((g) => ({
    id: g.id,
    kind: 'guard',
    category: null,
    subcategory: null,
    disposition: 'PROTECTED',
    sensitivity: null,
    source: { fr: { text: g.text, variants: [], origin: 'FinEthnic (ROADMAP BM2.3)' }, en: null },
    variables: [],
    target: { eto: null },
    links: { corpusRef: null, pageRefs: [], templateRefs: [], duplicateOf: null, relatedTo: [] },
    deprecated: false,
    notes: g.notes,
  }));

  /* --- Entrées de pages --- */
  const templateLabels = [...corpusEntries.values()]
    .filter((e) => e.kind === 'template')
    .flatMap((e) => {
      const label = templateLabel(e.source.fr.text);
      return label ? [{ id: e.id, key: comparisonKey(label) }] : [];
    });
  const firstByText = new Map<string, string>();
  const pageEntries = d8.control.map((row): LibraryEntry => {
    const corpus = corpusEntries.get(row.corpusId);
    const key = comparisonKey(row.text);
    const exact = corpus !== undefined && comparisonKey(corpus.source.fr.text) === key;
    const first = firstByText.get(key);
    if (first === undefined) firstByText.set(key, row.pageId);
    const step = Number(row.pageId.slice(1, 2));
    return {
      id: row.pageId,
      kind: 'page',
      category: null,
      subcategory: `Page ${step}`,
      disposition: 'TRANSLATABLE',
      sensitivity: null,
      source: { fr: { text: replaceEtonFin(row.text, renamed), variants: [], origin: D8_ORIGIN }, en: null },
      variables: [],
      contextHints: { steps: [step] },
      target: { eto: pendingEtoTarget() },
      links: {
        corpusRef: { id: row.corpusId, type: exact ? 'exact' : 'meaning' },
        pageRefs: [],
        templateRefs: templateLabels.filter((t) => t.key === key).map((t) => t.id),
        duplicateOf: first ?? null,
        relatedTo: [],
      },
      deprecated: false,
    };
  });

  /* --- Liens vers les jetons protégés --- */
  for (const entry of [...corpusEntries.values(), ...pageEntries]) {
    entry.links.relatedTo = GUARD_TOKENS.filter((g) => containsWord(entry.source.fr.text, g.text)).map((g) => g.id);
  }

  if (problems.length > 0) throw new ImportError(problems);

  /* --- Fichiers et statistiques --- */
  const corpusFiles: ImportedFile[] = [
    ...CORPUS_SECTIONS.map((s) => ({
      name: s.file,
      entries: [...corpusEntries.values()].filter((e) => e.id.startsWith(`${s.prefix}-`)),
    })),
    { name: GUARD_FILE, entries: guardEntries },
  ];
  const pageFiles: ImportedFile[] = [1, 2, 3, 4, 5].map((step) => ({
    name: pageFile(step),
    entries: pageEntries.filter((e) => e.id.startsWith(`P${step}-`)),
  }));

  const roots = pageEntries.filter((e) => e.links.duplicateOf === null);
  const linkCount = (type: 'exact' | 'meaning', pag: boolean): number => roots.filter((e) =>
    e.links.corpusRef?.type === type && e.links.corpusRef.id.startsWith('PAG-') === pag).length;
  const withTemplates = pageEntries.filter((e) => e.links.templateRefs.length > 0);

  return {
    corpusFiles,
    pageFiles,
    stats: {
      corpusEntries: corpusEntries.size,
      guardEntries: guardEntries.length,
      pageEntries: pageEntries.length,
      uniquePageTexts: roots.length,
      exactLinks: linkCount('exact', false),
      meaningLinks: linkCount('meaning', false) + linkCount('meaning', true),
      pagLinks: linkCount('exact', true),
      templateRefs: [...new Set(withTemplates.flatMap((e) => e.links.templateRefs))].sort(),
      pagesWithTemplateRefs: withTemplates.map((e) => e.id),
      mergedFrom,
      renamedEtonFin: renamed.n,
    },
  };
}

/** Sérialisation déterministe d'un fichier de data/ (indentation 2, NFC, fin de ligne finale). */
export const serializeEntries = (entries: readonly LibraryEntry[]): string =>
  `${JSON.stringify(entries, null, 2)}\n`.normalize('NFC');
