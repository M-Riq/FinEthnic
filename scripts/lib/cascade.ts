/**
 * Cascade de traduction (BM3.7, PROJECT_CONTEXT §3.10, décision Q22).
 *
 * Pour chaque entrée à traduire : niveau 1 le terme, niveau 2 les synonymes simples (ordre de D8),
 * niveau 3 la définition simple, arrêt au premier niveau qui réussit. Le résultat est une
 * PROPOSITION (target.eto.proposals[]) pour une locutrice : jamais target.eto.text, jamais
 * VALIDATED_OBALA. Le module n'invente aucune forme : il ne recopie que les formes du dictionnaire,
 * dans l'ordre donné par les règles. Il est pur (aucun fichier lu ni écrit).
 *
 * Assemblage PROVISOIRE (à revoir avec D7, Q23) :
 * - variables {…}, jetons protégés, nombres et ponctuation sont recopiés à l'identique, à leur place ;
 * - entre eux, chaque suite de mots est cherchée dans le dictionnaire (expression la plus longue d'abord) ;
 * - une suite de plusieurs mots doit être découpée entièrement en motifs de règles (le plus long d'abord) ;
 * - aucune lemmatisation : « envoie » n'est pas trouvé par « envoyer ».
 */
import { checkEtonCharacters, checkTextEncoding, extractVariables } from './eton-charset';
import type { EtoTarget, LibraryEntry } from './library-entry';

export const GENERATED_BY = 'propose-translations@0.1.0';

export interface DictionaryEntry {
  fr: string;
  eto: string;
  category: string;
  gloss: string;
  ref: string;
  /** Classe nominale de D7 (« 9/10 », « s.g »), noms seulement (M26). */
  nounClass?: string;
}

export interface Dictionary {
  kind: 'test' | 'd7';
  source: string;
  entries: DictionaryEntry[];
}

export interface GrammarRule {
  id: string;
  description: string;
  ref: string;
  pattern: string[];
  order: number[];
}

export interface GrammarRules {
  description: string;
  source: string;
  ignoredWords: { words: string[]; ref: string; note: string }[];
  rules: GrammarRule[];
}

export type Method = 'direct' | 'synonym' | 'definition';
export type Proposal = EtoTarget['proposals'][number];
export type Evidence = EtoTarget['dictionaryEvidence'][number];

/* ------------------------------------------------------------------ découpage du français */

export type TokenKind = 'word' | 'variable' | 'guard' | 'number' | 'punct';
export interface Token {
  kind: TokenKind;
  text: string;
  /** Clé de recherche : NFC, apostrophe droite, minuscules. */
  key: string;
  spaceBefore: boolean;
}

/* Variable, mot (avec traits d'union, élision « l' » détachée), ou tout autre signe. */
const TOKEN = /\{[^{}]*\}|[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*['’]?|\S/gu;

export const lookupKey = (text: string): string =>
  text.normalize('NFC').replace(/’/gu, "'").toLocaleLowerCase('fr');

/** Découpe un texte. `guards` : jetons protégés déjà découpés (ex. [["Safinum", "Pay"]]). */
export function tokenize(text: string, guards: readonly (readonly string[])[] = []): Token[] {
  const nfc = text.normalize('NFC');
  const tokens: Token[] = [...nfc.matchAll(TOKEN)].map((m) => {
    const t = m[0];
    const kind: TokenKind = t.startsWith('{') && t.endsWith('}') ? 'variable'
      : /^\p{N}+$/u.test(t) ? 'number'
      : /^[\p{L}\p{M}\p{N}]/u.test(t) ? 'word'
      : 'punct';
    return { kind, text: t, key: lookupKey(t), spaceBefore: m.index > 0 && /\s/u.test(nfc.charAt(m.index - 1)) };
  });
  const longestFirst = [...guards].filter((g) => g.length > 0).sort((a, b) => b.length - a.length);
  for (let i = 0; i < tokens.length; i++) {
    const guard = longestFirst.find((g) => g.every((part, k) => tokens[i + k]?.text === part));
    if (!guard) continue;
    for (let k = 0; k < guard.length; k++) (tokens[i + k] as Token).kind = 'guard';
    i += guard.length - 1;
  }
  return tokens;
}

const wordKeys = (text: string): string[] => tokenize(text).map((t) => t.key);

/* ------------------------------------------------------------------ ressources */

export interface CascadeResources {
  index: Map<string, DictionaryEntry[]>;
  maxWords: number;
  ignored: Set<string>;
  rules: readonly GrammarRule[];
  guards: string[][];
}

const TEST_FORM = /^⟦TEST:[^⟧]+⟧$/u;

/** Contrôles que les schémas ne peuvent pas faire. Liste vide : ressources utilisables. */
export function checkCascadeResources(dictionary: Dictionary, grammar: GrammarRules): string[] {
  const issues: string[] = [];
  dictionary.entries.forEach((e, i) => {
    const where = `dictionnaire, entrée ${i + 1} (« ${e.fr} »)`;
    for (const value of [e.fr, e.eto, e.category, e.gloss, e.ref]) {
      for (const message of checkTextEncoding(value)) issues.push(`${where} : ${message}`);
    }
    if (!tokenize(e.fr).every((t) => t.kind === 'word')) issues.push(`${where} : « fr » ne doit contenir que des mots`);
    if (dictionary.kind === 'test' && !TEST_FORM.test(e.eto)) {
      issues.push(`${where} : un dictionnaire de test n'accepte que des formes ⟦TEST:…⟧`);
    }
    if (dictionary.kind === 'd7') {
      if (e.eto.includes('⟦')) issues.push(`${where} : marqueur de test dans un dictionnaire D7`);
      for (const message of checkEtonCharacters(e.eto)) issues.push(`${where} : ${message}`);
    }
  });
  grammar.ignoredWords.forEach((group, i) => {
    for (const word of group.words) {
      const tokens = tokenize(word);
      if (tokens.length !== 1 || tokens[0]?.kind !== 'word') issues.push(`règles, ignoredWords ${i + 1} : « ${word} » doit être un seul mot`);
    }
  });
  const ids = new Set<string>();
  for (const rule of grammar.rules) {
    if (ids.has(rule.id)) issues.push(`règle ${rule.id} : ID en double`);
    ids.add(rule.id);
    const sorted = [...rule.order].sort((a, b) => a - b);
    if (sorted.length !== rule.pattern.length || sorted.some((n, i) => n !== i + 1)) {
      issues.push(`règle ${rule.id} : « order » doit reprendre chaque position du motif (1 à ${rule.pattern.length}) une seule fois`);
    }
  }
  return issues;
}

/** Prépare l'index du dictionnaire. À appeler après checkCascadeResources. */
export function prepareResources(dictionary: Dictionary, grammar: GrammarRules, guardTexts: readonly string[]): CascadeResources {
  const index = new Map<string, DictionaryEntry[]>();
  let maxWords = 1;
  for (const entry of dictionary.entries) {
    const keys = wordKeys(entry.fr);
    maxWords = Math.max(maxWords, keys.length);
    const key = keys.join(' ');
    index.set(key, [...(index.get(key) ?? []), entry]);
  }
  return {
    index,
    maxWords,
    ignored: new Set(grammar.ignoredWords.flatMap((g) => g.words.map(lookupKey))),
    rules: grammar.rules,
    guards: guardTexts.map((g) => tokenize(g).map((t) => t.text)),
  };
}

/* ------------------------------------------------------------------ traduction d'un texte */

export interface TextResult {
  ok: boolean;
  text: string | null;
  rules: string[];
  /** Mots absents du dictionnaire (clés de recherche). */
  missing: string[];
  /** Suites de catégories qu'aucune règle ne couvre (ex. « NOM + NOM »). */
  uncovered: string[];
  /** Autres raisons d'échec (variables, rien à traduire). */
  problems: string[];
  /** Formes candidates de chaque mot ou expression utilisé (sens multiples compris). */
  units: DictionaryEntry[][];
}

type Piece = { kind: 'fixed'; text: string; spaceBefore: boolean } | { kind: 'words'; tokens: Token[]; spaceBefore: boolean };

function pieces(tokens: readonly Token[]): Piece[] {
  const out: Piece[] = [];
  for (const token of tokens) {
    const last = out[out.length - 1];
    if (token.kind !== 'word') out.push({ kind: 'fixed', text: token.text, spaceBefore: token.spaceBefore });
    else if (last?.kind === 'words') last.tokens.push(token);
    else out.push({ kind: 'words', tokens: [token], spaceBefore: token.spaceBefore });
  }
  return out;
}

const signature = (units: readonly DictionaryEntry[][]): string =>
  units.map((u) => [...new Set(u.map((e) => e.category))].join('|')).join(' + ');

/** Découpe la suite en motifs de règles, le plus long d'abord (à égalité, la première règle du fichier). */
function assemble(units: readonly DictionaryEntry[][], rules: readonly GrammarRule[]): { forms: string[]; rules: string[] } | null {
  const forms: string[] = [];
  const used: string[] = [];
  let i = 0;
  while (i < units.length) {
    let best: GrammarRule | undefined;
    for (const rule of rules) {
      if (rule.pattern.length > units.length - i) continue;
      if (!rule.pattern.every((category, k) => units[i + k]?.some((e) => e.category === category))) continue;
      if (!best || rule.pattern.length > best.pattern.length) best = rule;
    }
    if (!best) return null;
    const matched = best.pattern.map((category, k) => (units[i + k] as DictionaryEntry[]).find((e) => e.category === category)?.eto ?? '');
    forms.push(...best.order.map((n) => matched[n - 1] ?? ''));
    used.push(best.id);
    i += best.pattern.length;
  }
  return { forms, rules: used };
}

const sortedVariables = (text: string): string => [...extractVariables(text)].sort().join(',');

/**
 * Traduit un texte français par le dictionnaire et les règles.
 * `expectedVariables` : texte dont les variables doivent se retrouver à l'identique (la source).
 */
export function translateText(text: string, res: CascadeResources, expectedVariables: string = text): TextResult {
  const missing: string[] = [];
  const uncovered: string[] = [];
  const problems: string[] = [];
  const units: DictionaryEntry[][] = [];
  const rendered: { text: string; spaceBefore: boolean }[] = [];
  const rules: string[] = [];

  for (const piece of pieces(tokenize(text, res.guards))) {
    if (piece.kind === 'fixed') {
      rendered.push(piece);
      continue;
    }
    const pieceUnits: DictionaryEntry[][] = [];
    const tokens = piece.tokens;
    for (let i = 0; i < tokens.length;) {
      const lookup = (length: number): DictionaryEntry[] | undefined =>
        res.index.get(tokens.slice(i, i + length).map((t) => t.key).join(' '));
      let length = Math.min(res.maxWords, tokens.length - i);
      while (length > 1 && !lookup(length)) length--;
      const found = lookup(length);
      const key = (tokens[i] as Token).key;
      if (found) {
        pieceUnits.push(found);
        i += length;
      } else {
        if (!res.ignored.has(key) && !missing.includes(key)) missing.push(key);
        i += 1;
      }
    }
    units.push(...pieceUnits);
    if (missing.length > 0 || pieceUnits.length === 0) continue;
    if (pieceUnits.length === 1) {
      rendered.push({ text: (pieceUnits[0] as DictionaryEntry[])[0]?.eto ?? '', spaceBefore: piece.spaceBefore });
      continue;
    }
    const assembled = assemble(pieceUnits, res.rules);
    if (!assembled) {
      const sig = signature(pieceUnits);
      if (!uncovered.includes(sig)) uncovered.push(sig);
      continue;
    }
    rules.push(...assembled.rules.filter((id) => !rules.includes(id)));
    rendered.push({ text: assembled.forms.join(' '), spaceBefore: piece.spaceBefore });
  }

  if (missing.length === 0 && units.length === 0) problems.push('aucun mot à traduire');
  let output = '';
  for (const part of rendered) output += (output !== '' && part.spaceBefore ? ' ' : '') + part.text;
  if (missing.length === 0 && uncovered.length === 0 && sortedVariables(output) !== sortedVariables(expectedVariables)) {
    problems.push(`variables différentes de la source (${sortedVariables(expectedVariables) || 'aucune'})`);
  }
  // Mêmes contrôles que validate-data : un signe recopié de la source (ex. « *126# ») hors de la
  // liste blanche éton ferait refuser tout --write ; la tentative échoue donc ici, entrée par entrée.
  if (missing.length === 0 && uncovered.length === 0 && problems.length === 0) {
    for (const message of [...checkTextEncoding(output), ...checkEtonCharacters(output)]) {
      problems.push(`texte proposé refusé : ${message}`);
    }
  }
  const ok = missing.length === 0 && uncovered.length === 0 && problems.length === 0;
  return { ok, text: ok ? output : null, rules: ok ? rules : [], missing, uncovered, problems, units };
}

/* ------------------------------------------------------------------ cascade sur les entrées */

export interface Attempt extends TextResult {
  level: 1 | 2 | 3;
  method: Method;
  from: string;
}

export type SkipReason = 'protected' | 'deprecated' | 'already-processed' | 'page-repeat' | 'page-shared';

export interface EntryOutcome {
  id: string;
  fr: string;
  result: 'proposed' | 'failed' | 'skipped';
  skip: { reason: SkipReason; detail: string } | null;
  method: Method | null;
  /** Texte de page sans synonymes ni définition : seul le niveau 1 est possible. */
  levelOneOnly: boolean;
  attempts: Attempt[];
  proposals: Proposal[];
  evidence: Evidence[];
}

function skipReason(entry: LibraryEntry): EntryOutcome['skip'] {
  const eto = entry.target.eto;
  if (!eto) return { reason: 'protected', detail: entry.disposition };
  if (entry.deprecated) return { reason: 'deprecated', detail: '' };
  if (eto.translationStatus !== 'TRANSLATION_PENDING' || eto.text !== null || eto.proposals.length > 0) {
    return { reason: 'already-processed', detail: eto.translationStatus };
  }
  if (entry.kind === 'page' && entry.links.duplicateOf) return { reason: 'page-repeat', detail: entry.links.duplicateOf };
  if (entry.kind === 'page' && entry.links.corpusRef?.type === 'exact') return { reason: 'page-shared', detail: entry.links.corpusRef.id };
  return null;
}

function evidenceOf(attempts: readonly Attempt[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const unit of attempts.filter((a) => a.ok).flatMap((a) => a.units)) {
    for (const e of unit) {
      const key = `${e.eto}\u0000${e.gloss}\u0000${e.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ form: e.eto, gloss: e.gloss, ref: e.ref });
    }
  }
  return out;
}

/**
 * Applique la cascade à une entrée. Les pages liées au corpus par le sens (`meaning`) n'empruntent
 * PAS les synonymes de l'entrée liée : leur texte diffère (ex. « Confirmer le transfert » / « Confirmer »).
 */
export function cascadeEntry(entry: LibraryEntry, res: CascadeResources): EntryOutcome {
  const simple = entry.source.fr.simple ?? null;
  const base = { id: entry.id, fr: entry.source.fr.text, levelOneOnly: !simple, attempts: [] as Attempt[], proposals: [] as Proposal[], evidence: [] as Evidence[] };
  const skip = skipReason(entry);
  if (skip) return { ...base, result: 'skipped', skip, method: null, levelOneOnly: false };

  const levels: { level: 1 | 2 | 3; method: Method; texts: string[] }[] = [
    { level: 1, method: 'direct', texts: [entry.source.fr.text] },
    { level: 2, method: 'synonym', texts: simple?.synonyms ?? [] },
    { level: 3, method: 'definition', texts: simple?.definition ? [simple.definition] : [] },
  ];
  const missingBefore: string[] = [];
  for (const { level, method, texts } of levels) {
    const proposals: Proposal[] = [];
    for (const from of texts) {
      const attempt: Attempt = { level, method, from, ...translateText(from, res, entry.source.fr.text) };
      base.attempts.push(attempt);
      if (attempt.ok && attempt.text !== null) {
        proposals.push({ text: attempt.text, method, from, rules: attempt.rules, missing: [...missingBefore], generatedBy: GENERATED_BY });
      } else {
        missingBefore.push(...attempt.missing.filter((w) => !missingBefore.includes(w)));
      }
    }
    if (proposals.length > 0) {
      return { ...base, result: 'proposed', skip: null, method, proposals, evidence: evidenceOf(base.attempts) };
    }
  }
  return { ...base, result: 'failed', skip: null, method: null };
}

export function runCascade(entries: readonly LibraryEntry[], res: CascadeResources): EntryOutcome[] {
  return entries.map((entry) => cascadeEntry(entry, res));
}

/** Entrée mise à jour : propositions, justifications et REVIEW_PENDING. Rien d'autre ne change. */
export function applyOutcome(entry: LibraryEntry, outcome: EntryOutcome): LibraryEntry {
  const eto = entry.target.eto;
  if (outcome.result !== 'proposed' || !eto || outcome.id !== entry.id) return entry;
  return {
    ...entry,
    target: {
      ...entry.target,
      eto: { ...eto, translationStatus: 'REVIEW_PENDING', proposals: outcome.proposals, dictionaryEvidence: outcome.evidence },
    },
  };
}

/* ------------------------------------------------------------------ rapport Markdown */

export interface ReportMeta {
  dictionary: { kind: Dictionary['kind']; source: string; entries: number };
  grammar: { source: string; rules: number };
  written: boolean;
}

const cell = (text: string): string => text.replace(/\|/gu, '\\|').replace(/\s*\n\s*/gu, ' ');
const quoted = (text: string): string => `« ${cell(text)} »`;
const examples = (ids: readonly string[]): string => (ids.length > 5 ? `${ids.slice(0, 5).join(', ')}… (+${ids.length - 5})` : ids.join(', '));

function table(headers: readonly string[], rows: readonly (readonly string[])[], empty: string): string[] {
  if (rows.length === 0) return [`_${empty}_`, ''];
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`), ''];
}

const SKIP_LABELS: Record<SkipReason, string> = {
  'protected': 'Entrée protégée (jamais traduite)',
  'deprecated': 'Entrée obsolète',
  'already-processed': 'Déjà en relecture ou validée',
  'page-repeat': 'Texte de page répété (traduit avec sa première occurrence)',
  'page-shared': 'Texte de page identique à une entrée du corpus (traduction partagée)',
};

/** Rapport de la cascade : comptes par niveau, mots manquants, structures à couvrir, détail des échecs. */
export function renderCascadeReport(outcomes: readonly EntryOutcome[], meta: ReportMeta): string {
  const proposed = outcomes.filter((o) => o.result === 'proposed');
  const failed = outcomes.filter((o) => o.result === 'failed');
  const skipped = outcomes.filter((o) => o.result === 'skipped');
  const byMethod = (m: Method): number => proposed.filter((o) => o.method === m).length;

  const tally = (pick: (o: EntryOutcome) => string[]): string[][] => {
    const map = new Map<string, string[]>();
    for (const o of failed) for (const k of new Set(pick(o))) map.set(k, [...(map.get(k) ?? []), o.id]);
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'fr'))
      .map(([k, ids]) => [cell(k), String(ids.length), examples(ids)]);
  };
  const missingOf = (o: EntryOutcome): string[] => o.attempts.flatMap((a) => a.missing);
  const uncoveredOf = (o: EntryOutcome): string[] => o.attempts.flatMap((a) => a.uncovered);

  const lines: string[] = [
    '# Rapport de la cascade de traduction',
    '',
    '> Généré par `npm run propose-translations` (BM3.7, PROJECT_CONTEXT §3.10). Ne pas modifier à la main.',
    '> Sur la page de test, la première proposition de chaque entrée est affichée avec un marqueur « non vérifiée » (Q9), sauf si une locutrice a déjà donné une forme. Les suivantes ne sont pas affichées. Une locutrice les accepte, les corrige ou les rejette (Q22).',
    '',
    `- Dictionnaire : ${cell(meta.dictionary.source)} (${meta.dictionary.kind}, ${meta.dictionary.entries} formes)`,
    `- Règles : ${cell(meta.grammar.source)} (${meta.grammar.rules} règles)`,
    `- Écriture dans data/ : ${meta.written ? 'oui (`--write`)' : 'non (essai)'}`,
    '',
  ];
  if (meta.dictionary.kind === 'test') {
    lines.push('> ⚠ **Dictionnaire de TEST** : les formes ⟦TEST:…⟧ sont fictives. Rien dans ce rapport n’est de l’Éton.', '');
  }
  lines.push(
    '## Résumé',
    '',
    ...table(['Résultat', 'Entrées'], [
      ['Niveau 1 — terme (`direct`)', String(byMethod('direct'))],
      ['Niveau 2 — synonymes simples (`synonym`)', String(byMethod('synonym'))],
      ['Niveau 3 — définition simple (`definition`)', String(byMethod('definition'))],
      ['Échec : reste en `TRANSLATION_PENDING`, confiée aux locutrices', String(failed.length)],
      ['Non traitées (détail en fin de rapport)', String(skipped.length)],
    ], ''),
    '## Mots manquants',
    '',
    'Mots absents du dictionnaire dans les entrées en échec, du plus bloquant au moins bloquant.',
    '',
    ...table(['Mot', 'Entrées bloquées', 'Exemples'], tally(missingOf), 'Aucun.'),
    '## Structures non couvertes par une règle',
    '',
    'Suites de catégories trouvées dans le dictionnaire, mais qu’aucune règle de `grammar-rules.json` ne couvre (Q23).',
    '',
    ...table(['Catégories', 'Entrées bloquées', 'Exemples'], tally(uncoveredOf), 'Aucune.'),
    '## Propositions',
    '',
    ...table(['ID', 'Méthode', 'Texte français utilisé', 'Proposition', 'Règles'],
      proposed.flatMap((o) => o.proposals.map((p) => [o.id, `\`${p.method}\``, quoted(p.from), quoted(p.text), p.rules.join(', ') || '—'])),
      'Aucune.'),
    '## Entrées en échec',
    '',
    ...table(['ID', 'Texte', 'Mots manquants', 'Autres raisons'],
      failed.map((o) => {
        const missing = [...new Set(missingOf(o))];
        const other = [...new Set([...uncoveredOf(o).map((s) => `structure ${s}`), ...o.attempts.flatMap((a) => a.problems)])];
        return [o.id, quoted(o.fr) + (o.levelOneOnly ? ' (niveau 1 seulement)' : ''), cell(missing.join(', ')) || '—', cell(other.join(' ; ')) || '—'];
      }),
      'Aucune.'),
  );
  const levelOneOnly = outcomes.filter((o) => o.levelOneOnly);
  lines.push(
    '## Textes sans synonymes ni définition (niveau 1 seulement)',
    '',
    'Seul le niveau 1 est possible. Pour un texte de page lié au corpus par le sens, les synonymes de l’entrée liée ne sont pas repris, car le texte diffère.',
    '',
    levelOneOnly.length > 0 ? `${levelOneOnly.length} : ${levelOneOnly.map((o) => o.id).join(', ')}` : '_Aucun._',
    '',
    '## Entrées non traitées',
    '',
    ...table(['Motif', 'Entrées', 'Exemples'],
      (Object.keys(SKIP_LABELS) as SkipReason[])
        .map((reason) => [reason, skipped.filter((o) => o.skip?.reason === reason).map((o) => o.id)] as const)
        .filter(([, ids]) => ids.length > 0)
        .map(([reason, ids]) => [SKIP_LABELS[reason], String(ids.length), examples(ids)]),
      'Aucune.'),
  );
  return `${lines.join('\n').trimEnd()}\n`;
}
