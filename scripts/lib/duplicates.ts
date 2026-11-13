/**
 * Rapport de doublons (BM2.4, ROADMAP §8). Fonctions pures : analyse des entrées de data/ et rendu
 * Markdown. Rien n'est supprimé, fusionné ni réécrit : le rapport prépare les décisions du
 * responsable (§8.2). Les heuristiques (niveau 3) ne décident jamais.
 */
import { comparisonKey, containsWord, splitSentences, templateLabel, words } from './compare-text';
import type { LibraryEntry } from './library-entry';

/** Listes tenues à la main : data/language-resources/duplicate-review.json. */
export interface IdGroup {
  ids: string[];
  label: string;
}
export interface ReviewLists {
  oppositions: IdGroup[];
  oppositionsWithoutEntry: { label: string; reason: string }[];
  distinct: IdGroup[];
  overlaps: IdGroup[];
}

export interface TextRef {
  id: string;
  text: string;
}
export interface PageGroup {
  root: TextRef;
  others: string[];
}
export interface PageCorpusLink {
  page: TextRef;
  corpus: TextRef;
}
export interface PotentialPair {
  a: TextRef;
  b: TextRef;
  reason: string;
  known: 'overlap' | 'distinct' | null;
}
export interface SentenceHit {
  container: TextRef;
  sentence: string;
  matches: string[];
}
export interface SynonymHit {
  entry: TextRef;
  synonym: string;
  matches: string[];
}
export type LabelTemplateStatus = 'untranslated' | 'consistent' | 'divergent';
export interface LabelTemplatePair {
  label: TextRef;
  template: TextRef;
  /** Textes de pages qui utilisent ce libellé (même unité de traduction). */
  pages: string[];
  labelTarget: string | null;
  templateTarget: string | null;
  status: LabelTemplateStatus;
}
export interface CheckedMember extends TextRef {
  target: string | null;
}
export interface CheckedGroup {
  label: string;
  members: CheckedMember[];
  sharedTarget: string | null;
}
export interface DuplicateReport {
  entryCount: number;
  uniqueTextCount: number;
  strict: TextRef[][];
  normalized: TextRef[][];
  pageGroups: PageGroup[];
  exactLinks: PageCorpusLink[];
  meaningLinks: PageCorpusLink[];
  potential: PotentialPair[];
  overlaps: (CheckedGroup & { detected: boolean })[];
  sentences: SentenceHit[];
  labelTemplates: LabelTemplatePair[];
  synonymCollisions: SynonymHit[];
  /** Synonymes égaux à un jeton protégé (GUARD) : la cascade ne doit jamais les traduire. */
  synonymsProtected: SynonymHit[];
  synonymsInVariants: SynonymHit[];
  oppositions: CheckedGroup[];
  distinct: CheckedGroup[];
  oppositionsWithoutEntry: { label: string; reason: string }[];
  /** Points à arbitrer : incohérences de liens, cibles partagées par des entrées distinctes, libellé ↔ gabarit divergent. */
  warnings: string[];
  /** Erreurs de configuration (ID inconnu dans les listes tenues à la main) : le rapport n'est pas fiable. */
  errors: string[];
}

/** Seuil de mots communs du niveau 3 (ROADMAP §8.1). */
export const WORD_OVERLAP_THRESHOLD = 0.8;

/** Vérifie la forme de duplicate-review.json ; lève une erreur lisible sinon. */
export function parseReviewLists(data: unknown): ReviewLists {
  const fail = (message: string): never => {
    throw new Error(`duplicate-review.json : ${message}`);
  };
  const obj = (typeof data === 'object' && data !== null && !Array.isArray(data) ? data : fail('objet JSON attendu')) as Record<string, unknown>;
  const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
  const list = (key: string): Record<string, unknown>[] => {
    const value = obj[key];
    if (!Array.isArray(value)) return fail(`« ${key} » doit être un tableau`);
    return value.map((item, i) =>
      (typeof item === 'object' && item !== null ? item : fail(`${key}[${i}] doit être un objet`)) as Record<string, unknown>);
  };
  const groups = (key: string): IdGroup[] => list(key).map((g, i) => {
    const ids = g.ids;
    if (!Array.isArray(ids) || ids.length < 2 || !ids.every(isText)) fail(`${key}[${i}].ids : au moins deux ID attendus`);
    if (!isText(g.label)) fail(`${key}[${i}].label manquant`);
    return { ids: [...(ids as string[])], label: g.label as string };
  });
  return {
    oppositions: groups('oppositions'),
    oppositionsWithoutEntry: list('oppositionsWithoutEntry').map((o, i) => {
      if (!isText(o.label) || !isText(o.reason)) fail(`oppositionsWithoutEntry[${i}] : label et reason attendus`);
      return { label: o.label as string, reason: o.reason as string };
    }),
    distinct: groups('distinct'),
    overlaps: groups('overlaps'),
  };
}

const byNaturalId = (a: { id: string }, b: { id: string }): number =>
  a.id.localeCompare(b.id, 'en', { numeric: true });
const ref = (e: LibraryEntry): TextRef => ({ id: e.id, text: e.source.fr.text });
const withoutVariables = (text: string): string => text.replace(/\{[^}]*\}/gu, ' ');
const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

function groupBy<T>(items: readonly T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return [...groups.values()];
}

/** Analyse les entrées (lecture seule) et les listes tenues à la main. */
export function analyzeDuplicates(input: readonly LibraryEntry[], lists: ReviewLists): DuplicateReport {
  const entries = [...input].sort(byNaturalId);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const warnings: string[] = [];
  const errors: string[] = [];

  const corpus = entries.filter((e) => e.kind !== 'page');
  const pages = entries.filter((e) => e.kind === 'page');
  /** Un texte par unité de traduction : les répétitions de pages (`duplicateOf`) sont écartées. */
  const unique = entries.filter((e) => e.kind !== 'page' || e.links.duplicateOf === null);

  /** Entrée qui porte la traduction de l'unité : racine de `duplicateOf`, puis entrée du corpus si le lien est `exact`. */
  const unitOwner = (entry: LibraryEntry): LibraryEntry => {
    let current = entry;
    const seen = new Set<string>();
    while (current.links.duplicateOf !== null && !seen.has(current.id)) {
      seen.add(current.id);
      const next = byId.get(current.links.duplicateOf);
      if (!next) break;
      current = next;
    }
    const link = current.links.corpusRef;
    return link?.type === 'exact' ? byId.get(link.id) ?? current : current;
  };
  const unitTarget = (entry: LibraryEntry): string | null => unitOwner(entry).target.eto?.text ?? null;

  /* Niveaux 1 et 2 : corpus (les pages sont traitées par leurs liens). */
  const strict = groupBy(corpus, (e) => e.source.fr.text.normalize('NFC'))
    .filter((g) => g.length > 1)
    .map((g) => g.map(ref));
  const normalized = groupBy(corpus, (e) => comparisonKey(e.source.fr.text))
    .filter((g) => new Set(g.map((e) => e.source.fr.text.normalize('NFC'))).size > 1)
    .map((g) => g.map(ref));

  /* Pages : textes répétés et liens vers le corpus. */
  const pageGroups: PageGroup[] = [];
  for (const group of groupBy(pages, (e) => comparisonKey(e.source.fr.text))) {
    const [root, ...others] = group;
    if (!root) continue;
    if (root.links.duplicateOf !== null) {
      warnings.push(`${root.id} : première occurrence de son texte, mais \`duplicateOf\` = ${root.links.duplicateOf}`);
    }
    for (const other of others) {
      if (other.links.duplicateOf !== root.id) {
        warnings.push(`${other.id} : même texte que ${root.id}, mais \`duplicateOf\` = ${other.links.duplicateOf ?? 'null'}`);
      }
    }
    for (const e of group) {
      const target = e.links.duplicateOf === null ? undefined : byId.get(e.links.duplicateOf);
      if (target && !group.includes(target)) {
        warnings.push(`${e.id} : \`duplicateOf\` = ${target.id}, dont le texte est différent`);
      }
    }
    if (others.length > 0) pageGroups.push({ root: ref(root), others: others.map((e) => e.id) });
  }

  const corpusByKey = groupBy(corpus, (e) => comparisonKey(e.source.fr.text));
  const corpusMatches = (text: string): LibraryEntry[] =>
    corpusByKey.find((g) => g[0] && comparisonKey(g[0].source.fr.text) === comparisonKey(text)) ?? [];
  const exactLinks: PageCorpusLink[] = [];
  const meaningLinks: PageCorpusLink[] = [];
  for (const page of unique.filter((e) => e.kind === 'page')) {
    const link = page.links.corpusRef;
    const linked = link ? byId.get(link.id) : undefined;
    const same = corpusMatches(page.source.fr.text);
    if (link?.type === 'exact' && linked) {
      if (same.includes(linked)) exactLinks.push({ page: ref(page), corpus: ref(linked) });
      else warnings.push(`${page.id} : lien \`exact\` vers ${linked.id}, dont le texte est différent`);
    } else if (link?.type === 'meaning' && linked) {
      meaningLinks.push({ page: ref(page), corpus: ref(linked) });
    }
    if (same.length > 0 && !(link?.type === 'exact' && linked && same.includes(linked))) {
      warnings.push(`${page.id} : même texte que ${same.map((e) => e.id).join(', ')}, sans lien \`exact\` vers cette entrée`);
    }
  }

  /* Listes tenues à la main : ID connus, cibles. */
  const check = (listName: string, group: IdGroup): CheckedGroup => {
    const members: CheckedMember[] = [];
    for (const id of group.ids) {
      const e = byId.get(id);
      if (e) members.push({ ...ref(e), target: unitTarget(e) });
      else errors.push(`duplicate-review.json, ${listName} « ${group.label} » : ID inconnu ${id}`);
    }
    const targets = groupBy(members.filter((m) => m.target !== null), (m) => (m.target ?? '').normalize('NFC'));
    const shared = targets.find((g) => g.length > 1)?.[0]?.target ?? null;
    return { label: group.label, members, sharedTarget: shared };
  };
  const oppositions = lists.oppositions.map((g) => check('oppositions', g));
  const distinct = lists.distinct.map((g) => check('distinct', g));
  const overlapGroups = lists.overlaps.map((g) => check('overlaps', g));
  for (const g of oppositions) {
    if (g.sharedTarget !== null) warnings.push(`Paire opposée « ${g.label} » : même cible Éton « ${g.sharedTarget} » (interdit, ROADMAP §8.4)`);
  }
  for (const g of distinct) {
    if (g.sharedTarget !== null) warnings.push(`Termes distincts « ${g.label} » : même cible Éton « ${g.sharedTarget} » (à vérifier)`);
  }
  const knownPairs = new Map<string, 'overlap' | 'distinct'>();
  for (const [kind, groups] of [['distinct', lists.distinct], ['overlap', lists.overlaps]] as const) {
    for (const g of groups) {
      for (const a of g.ids) for (const b of g.ids) if (a < b) knownPairs.set(pairKey(a, b), kind);
    }
  }

  /* Niveau 3 : inclusion de chaînes ou mots communs (même catégorie). Libellé ↔ gabarit à part. */
  const potential: PotentialPair[] = [];
  for (let i = 0; i < corpus.length; i++) {
    for (let j = i + 1; j < corpus.length; j++) {
      const a = corpus[i];
      const b = corpus[j];
      if (!a || !b) continue;
      const ka = comparisonKey(withoutVariables(a.source.fr.text));
      const kb = comparisonKey(withoutVariables(b.source.fr.text));
      if (ka === kb) continue;
      const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
      const wa = new Set(words(ka));
      const wb = new Set(words(kb));
      const common = [...wa].filter((w) => wb.has(w)).length;
      const ratio = common / Math.max(wa.size, wb.size, 1);
      let reason: string | null = null;
      if (words(short).length >= 2 && containsWord(long, short)) {
        reason = `« ${short} » est contenu dans l'autre texte`;
      } else if (ratio >= WORD_OVERLAP_THRESHOLD && a.category === b.category) {
        reason = `${Math.round(ratio * 100)} % de mots communs, même catégorie`;
      }
      if (reason) potential.push({ a: ref(a), b: ref(b), reason, known: knownPairs.get(pairKey(a.id, b.id)) ?? null });
    }
  }
  const detected = new Set(potential.map((p) => pairKey(p.a.id, p.b.id)));
  const overlaps = overlapGroups.map((g) => ({
    ...g,
    detected: g.members.every((m, i) => g.members.every((n, k) => k <= i || detected.has(pairKey(m.id, n.id)))),
  }));

  /* Phrases d'un paragraphe égales au texte d'une autre entrée. */
  const sentences: SentenceHit[] = [];
  for (const e of unique) {
    const parts = splitSentences(e.source.fr.text);
    if (parts.length < 2) continue;
    for (const sentence of parts) {
      const matches = unique.filter((o) => o.id !== e.id && comparisonKey(o.source.fr.text) === comparisonKey(sentence));
      if (matches.length > 0) sentences.push({ container: ref(e), sentence, matches: matches.map((o) => o.id) });
    }
  }

  /* T-LIB-09 : libellé seul ↔ même libellé dans un gabarit « Libellé : {variable} », par unité de traduction. */
  const labelTemplates: LabelTemplatePair[] = [];
  const pairs = new Map<string, LabelTemplatePair>();
  const addLabelTemplate = (labelEntry: LibraryEntry, template: LibraryEntry): void => {
    const label = unitOwner(labelEntry);
    const page = labelEntry.kind === 'page' ? [labelEntry.id] : [];
    const key = pairKey(label.id, template.id);
    const existing = pairs.get(key);
    if (existing) {
      existing.pages = [...new Set([...existing.pages, ...page])].sort((a, b) => byNaturalId({ id: a }, { id: b }));
      return;
    }
    const labelTarget = unitTarget(label);
    const templateTarget = unitTarget(template);
    const status: LabelTemplateStatus = labelTarget === null || templateTarget === null
      ? 'untranslated'
      : containsWord(comparisonKey(templateTarget), comparisonKey(labelTarget)) ? 'consistent' : 'divergent';
    const pair: LabelTemplatePair = { label: ref(label), template: ref(template), pages: page, labelTarget, templateTarget, status };
    pairs.set(key, pair);
    labelTemplates.push(pair);
  };
  for (const template of corpus.filter((e) => e.kind === 'template')) {
    const label = templateLabel(template.source.fr.text);
    if (label === null) continue;
    for (const e of corpusMatches(label)) if (e.kind !== 'template') addLabelTemplate(e, template);
  }
  for (const page of pages) {
    for (const id of page.links.templateRefs) {
      const template = byId.get(id);
      if (template) addLabelTemplate(page, template);
      else warnings.push(`${page.id} : \`templateRefs\` cite ${id}, introuvable`);
    }
  }
  for (const p of labelTemplates) {
    if (p.status === 'divergent') {
      warnings.push(`Libellé ${p.label.id} « ${p.labelTarget} » absent de la cible du gabarit ${p.template.id} « ${p.templateTarget} » (T-LIB-09, non bloquant)`);
    }
  }

  /* Synonymes (niveaux 2 et 3 de la cascade, jamais des clés de recherche). */
  const synonymCollisions: SynonymHit[] = [];
  const synonymsProtected: SynonymHit[] = [];
  const synonymsInVariants: SynonymHit[] = [];
  for (const e of unique) {
    const ownVariants = new Set(e.source.fr.variants.map(comparisonKey));
    for (const synonym of e.source.fr.simple?.synonyms ?? []) {
      const k = comparisonKey(synonym);
      const same = unique.filter((o) => comparisonKey(o.source.fr.text) === k);
      const owners = (list: LibraryEntry[]): string[] =>
        [...new Set(list.map((o) => unitOwner(o).id))].filter((id) => id !== e.id).sort((a, b) => byNaturalId({ id: a }, { id: b }));
      const matches = owners(same.filter((o) => o.kind !== 'guard'));
      const guards = owners(same.filter((o) => o.kind === 'guard'));
      if (matches.length > 0) synonymCollisions.push({ entry: ref(e), synonym, matches });
      if (guards.length > 0) synonymsProtected.push({ entry: ref(e), synonym, matches: guards });
      if (ownVariants.has(k)) synonymsInVariants.push({ entry: ref(e), synonym, matches: [e.id] });
    }
  }
  for (const hit of synonymsInVariants) {
    warnings.push(`Synonyme « ${hit.synonym} » de ${hit.entry.id} aussi déclaré comme variante de recherche (interdit, PROJECT_CONTEXT §3.9-2)`);
  }

  return {
    entryCount: entries.length,
    uniqueTextCount: unique.length,
    strict,
    normalized,
    pageGroups,
    exactLinks,
    meaningLinks,
    potential,
    overlaps,
    sentences,
    labelTemplates,
    synonymCollisions,
    synonymsProtected,
    synonymsInVariants,
    oppositions,
    distinct,
    oppositionsWithoutEntry: [...lists.oppositionsWithoutEntry],
    warnings,
    errors,
  };
}

/* ------------------------------------------------------------------ rendu Markdown */

const cell = (text: string): string => text.replace(/\|/gu, '\\|').replace(/\s*\n\s*/gu, ' ');
const quoted = (text: string): string => `« ${cell(text)} »`;
const target = (text: string | null): string => (text === null ? '—' : quoted(text));

function table(headers: readonly string[], rows: readonly (readonly string[])[], empty: string): string[] {
  if (rows.length === 0) return [`_${empty}_`, ''];
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
  ];
}

const STATUS_LABEL: Record<LabelTemplateStatus, string> = {
  untranslated: 'pas encore traduit',
  consistent: 'cohérent',
  divergent: '⚠ divergent',
};
const KNOWN_LABEL = { overlap: 'recouvrement connu', distinct: 'distinct (à préserver)' } as const;

/** Rapport Markdown déterministe (aucune date) : data/exports/markdown/duplicates.md. */
export function renderDuplicatesMarkdown(r: DuplicateReport): string {
  const sharedOrNone = (g: CheckedGroup): string =>
    g.sharedTarget !== null ? `⚠ même cible ${quoted(g.sharedTarget)}`
      : g.members.every((m) => m.target === null) ? 'aucune cible pour l\'instant' : 'cibles différentes';
  const members = (g: CheckedGroup): string => g.members.map((m) => `${m.id} ${quoted(m.text)}`).join(' / ');

  const lines = [
    '# Rapport de doublons — bibliothèque FinEthnic',
    '',
    '> Fichier **généré** par `npm run check-duplicates` (ROADMAP §8, BM2.4) : ne pas le modifier à la main.',
    '> Ce rapport ne supprime ni ne fusionne rien. Chaque décision revient au responsable (ROADMAP §8.2) ;',
    '> les listes tenues à la main sont dans `data/language-resources/duplicate-review.json`.',
    '',
    '## Résumé',
    '',
    ...table(['Contrôle', 'Résultat'], [
      ['Entrées analysées', `${r.entryCount} (${r.uniqueTextCount} textes uniques)`],
      ['Erreurs dans les listes tenues à la main', String(r.errors.length)],
      ['Points à arbitrer', String(r.warnings.length)],
      ['Niveau 1 — doublons stricts (corpus)', String(r.strict.length)],
      ['Niveau 2 — doublons après normalisation (corpus)', String(r.normalized.length)],
      ['Pages — textes répétés', `${r.pageGroups.length} groupe(s), ${r.pageGroups.reduce((n, g) => n + g.others.length, 0)} répétition(s)`],
      ['Pages ↔ corpus — liens `exact`', `${r.exactLinks.length} (${r.exactLinks.filter((l) => !l.corpus.id.startsWith('PAG-')).length} vers VOC/ACT/SEC/MSG, ${r.exactLinks.filter((l) => l.corpus.id.startsWith('PAG-')).length} vers PAG)`],
      ['Pages ↔ corpus — liens `meaning`', String(r.meaningLinks.length)],
      ['Niveau 3 — doublons potentiels', String(r.potential.length)],
      ['Phrases incluses dans un paragraphe', String(r.sentences.length)],
      ['Libellé ↔ gabarit (T-LIB-09)', `${r.labelTemplates.length} paire(s), ${r.labelTemplates.filter((p) => p.status === 'divergent').length} divergente(s)`],
      ['Synonymes égaux au texte d\'une autre entrée', String(r.synonymCollisions.length)],
      ['Synonymes égaux à un texte protégé (GUARD)', String(r.synonymsProtected.length)],
      ['Synonymes utilisés comme variantes de recherche', String(r.synonymsInVariants.length)],
      ['Niveau 4 — paires opposées', `${r.oppositions.length} (+ ${r.oppositionsWithoutEntry.length} sans entrée)`],
      ['Termes proches mais distincts', String(r.distinct.length)],
    ], ''),
  ];

  if (r.errors.length > 0) {
    lines.push('## ✗ Erreurs dans les listes tenues à la main', '', ...r.errors.map((e) => `- ${cell(e)}`), '');
  }
  lines.push('## Points à arbitrer', '');
  lines.push(...(r.warnings.length > 0 ? [...r.warnings.map((w) => `- ⚠ ${cell(w)}`), ''] : ['_Aucun._', '']));

  lines.push('## Niveau 1 — Doublons stricts (corpus)', '',
    'Textes identiques entre entrées du corpus. Les fusions déjà faites par D8 sont tracées dans `links.mergedFrom`.', '');
  lines.push(...table(['Entrées', 'Texte'], r.strict.map((g) => [g.map((e) => e.id).join(', '), quoted(g[0]?.text ?? '')]), 'Aucun doublon strict.'));

  lines.push('## Niveau 2 — Doublons après normalisation (corpus)', '',
    'Mêmes textes à la casse, aux espaces, aux apostrophes et à la ponctuation finale près.', '');
  lines.push(...table(['Entrées', 'Textes'], r.normalized.map((g) => [g.map((e) => e.id).join(', '), g.map((e) => quoted(e.text)).join(' / ')]), 'Aucun doublon après normalisation.'));

  lines.push('## Pages — textes répétés (une seule unité de traduction)', '',
    'Normal : chaque occurrence garde son ID de page et pointe vers la première par `duplicateOf`.', '');
  lines.push(...table(['Première occurrence', 'Texte', 'Répétitions'], r.pageGroups.map((g) => [g.root.id, quoted(g.root.text), g.others.join(', ')]), 'Aucun texte répété.'));

  lines.push('## Pages ↔ corpus — liens `exact` (traduction partagée)', '');
  lines.push(...table(['Page', 'Texte', 'Entrée du corpus'], r.exactLinks.map((l) => [l.page.id, quoted(l.page.text), l.corpus.id]), 'Aucun lien exact.'));

  lines.push('## Pages ↔ corpus — liens `meaning` (même sens, traduction distincte)', '',
    'Le texte de la page diffère du corpus : chaque traduction est validée séparément.', '');
  lines.push(...table(['Page', 'Texte de la page', 'Entrée du corpus', 'Texte du corpus'], r.meaningLinks.map((l) => [l.page.id, quoted(l.page.text), l.corpus.id, quoted(l.corpus.text)]), 'Aucun lien par le sens.'));

  lines.push('## Niveau 3 — Doublons potentiels (heuristique, décision humaine)', '',
    `Inclusion d'un texte d'au moins deux mots dans un autre, ou au moins ${Math.round(WORD_OVERLAP_THRESHOLD * 100)} % de mots communs dans la même catégorie. Variables \`{…}\` ignorées.`, '');
  lines.push(...table(['Entrée A', 'Entrée B', 'Raison', 'Déjà connu'], r.potential.map((p) => [
    `${p.a.id} ${quoted(p.a.text)}`, `${p.b.id} ${quoted(p.b.text)}`, cell(p.reason), p.known ? KNOWN_LABEL[p.known] : '—',
  ]), 'Aucun doublon potentiel.'));

  lines.push('### Recouvrements de sens connus (liste tenue à la main)', '');
  lines.push(...table(['Recouvrement', 'Entrées', 'Repéré par l\'heuristique'], r.overlaps.map((g) => [cell(g.label), members(g), g.detected ? 'oui' : 'non (sens seulement)']), 'Aucun.'));

  lines.push('## Phrases incluses dans un paragraphe', '');
  lines.push(...table(['Paragraphe', 'Phrase', 'Égale à'], r.sentences.map((s) => [s.container.id, quoted(s.sentence), s.matches.join(', ')]), 'Aucune phrase d\'un paragraphe n\'est égale au texte d\'une autre entrée.'));

  lines.push('## Libellé ↔ gabarit (T-LIB-09)', '',
    'Un libellé seul et le même libellé dans un gabarit « Libellé : {variable} » devraient avoir des traductions cohérentes. Une divergence est signalée mais ne bloque rien.', '');
  lines.push(...table(['Libellé', 'Gabarit', 'Pages', 'Cible du libellé', 'Cible du gabarit', 'État'], r.labelTemplates.map((p) => [
    `${p.label.id} ${quoted(p.label.text)}`, `${p.template.id} ${quoted(p.template.text)}`, p.pages.join(', ') || '—',
    target(p.labelTarget), target(p.templateTarget), STATUS_LABEL[p.status],
  ]), 'Aucune paire libellé ↔ gabarit.'));

  lines.push('## Synonymes égaux au texte d\'une autre entrée', '',
    'Normal et attendu : les synonymes sont les niveaux 2 et 3 de la cascade de traduction (PROJECT_CONTEXT §3.10). Ils ne servent **jamais** à reconnaître un texte : « monnaie » désigne VOC-017, pas VOC-016 (T-LIB-12).', '');
  lines.push(...table(['Entrée', 'Synonyme', 'Égal au texte de'], r.synonymCollisions.map((s) => [`${s.entry.id} ${quoted(s.entry.text)}`, quoted(s.synonym), s.matches.join(', ')]), 'Aucun.'));

  lines.push('### Synonymes égaux à un texte protégé (GUARD)', '',
    'La cascade ne doit jamais traduire ces synonymes : ils restent recopiés tels quels.', '');
  lines.push(...table(['Entrée', 'Synonyme', 'Texte protégé'], r.synonymsProtected.map((s) => [`${s.entry.id} ${quoted(s.entry.text)}`, quoted(s.synonym), s.matches.join(', ')]), 'Aucun.'));

  lines.push('## Synonymes utilisés comme variantes de recherche (doit rester vide)', '');
  lines.push(...table(['Entrée', 'Synonyme', 'Variante de'], r.synonymsInVariants.map((s) => [s.entry.id, quoted(s.synonym), s.matches.join(', ')]), 'Aucun : les synonymes ne sont pas des clés de recherche.'));

  lines.push('## Niveau 4 — Paires opposées (cibles Éton obligatoirement différentes)', '');
  lines.push(...table(['Paire', 'Entrées', 'Cibles Éton'], r.oppositions.map((g) => [cell(g.label), members(g), sharedOrNone(g)]), 'Aucune.'));
  lines.push('### Paires opposées sans entrée dans la bibliothèque', '');
  lines.push(...table(['Paire', 'Raison'], r.oppositionsWithoutEntry.map((o) => [cell(o.label), cell(o.reason)]), 'Aucune.'));

  lines.push('## Termes proches mais distincts (à préserver)', '');
  lines.push(...table(['Termes', 'Entrées', 'Cibles Éton'], r.distinct.map((g) => [cell(g.label), members(g), sharedOrNone(g)]), 'Aucun.'));

  while (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}
