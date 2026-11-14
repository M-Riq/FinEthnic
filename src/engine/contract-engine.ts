/**
 * Moteur MOT derrière l'interface du contrat d'intégration (MOT6, INTEGRATION_CONTRACT.md v0.4.0).
 *
 * Correspondance des statuts (M17, §5.2 du contrat) :
 * - SUCCESS     → PENDING_VALIDATION, unverifiedKind 'complete' (aucune locutrice n'a vérifié) ;
 * - PARTIAL     → PENDING_VALIDATION, unverifiedKind 'partial' (brouillon, mots non rendus entre crochets),
 *                 ou KNOWN_UNTRANSLATED / NO_MATCH si le brouillon ne contient aucun mot éton ;
 * - FALLBACK    → KNOWN_UNTRANSLATED (entrée de D8) ou NO_MATCH (texte composé) ;
 * - PENDING     → NO_MATCH ;
 * - PASSTHROUGH → PROTECTED (protected-value).
 * Une traduction validée par une locutrice (`approved`) donne APPROVED ; une traduction rejetée
 * (`rejected`) donne KNOWN_UNTRANSLATED (I6). Le moteur ne produit pas AMBIGUOUS : il rattache un texte
 * à une seule entrée de D8, l'entrée canonique du corpus. Les décisions des locutrices portées par les
 * autres entrées de même texte (libellés de pages) comptent aussi : un rejet suffit ; une validation
 * n'est retenue que si toutes les validations du texte concordent.
 *
 * Les termes français gardés tels quels (M20 : « compte », « mot de passe »…) sont listés dans
 * `keptFrench`, dans l'ordre de `unverifiedOutput` (I12).
 *
 * Les segments protégés sont rendus octet pour octet (I5) : le moteur travaille sur le texte normalisé
 * (espaces insécables unifiées), l'adaptateur remet les octets d'origine, puis vérifie l'intégrité.
 * En cas d'écart, la traduction n'est pas renvoyée : le texte original reste affiché.
 *
 * Module pur, sans dépendance à Node : il doit pouvoir tourner dans l'extension.
 */
import {
  CONTRACT_VERSION,
  type EngineInfo,
  type MatchKind,
  type ProtectedDetector,
  type ResultReason,
  type TranslationEngine,
  type TranslationRequest,
  type TranslationResult,
} from '../language/contract';
import { textKey } from './corpus';
import { createEngine, ENGINE_VERSION, type EngineOptions, type EngineResources } from './engine';
import { normalize, type TokenKind } from './normalize';
import type { TextResult, UnitResult } from './select';

/** Longueur maximale d'un texte (I10). */
export const MAX_TEXT_LENGTH = 2000;

/** Entrée de D8 qui ne se traduit pas : nom protégé ou hors périmètre (§5.2). */
export interface ProtectedEntry {
  id: string;
  text: string;
  reason: 'protected-entry' | 'out-of-scope';
}

export interface ContractResources extends EngineResources {
  protectedEntries?: readonly ProtectedEntry[];
  /** Traductions validées par une locutrice (langue et sens financier), par identifiant d'entrée. */
  approved?: ReadonlyMap<string, string>;
  /** Entrées dont la traduction a été rejetée par une locutrice (I6). */
  rejected?: ReadonlySet<string>;
}

export interface ContractEngineOptions extends EngineOptions {
  /** Détection des valeurs protégées fournie par l'extension (Q14 révisée). */
  detectProtected?: ProtectedDetector;
}

const PROTECTED_KINDS: ReadonlySet<TokenKind> = new Set(['variable', 'amount', 'number', 'guard', 'url', 'email']);

const NO_RESULT: TranslationResult = {
  status: 'NO_MATCH',
  output: null,
  unverifiedOutput: null,
  unverifiedKind: null,
  entryId: null,
  candidateIds: [],
  matchKind: null,
  detectedSourceLang: null,
  protectedSegments: [],
  reason: null,
};

const noMatch = (reason: ResultReason | null = null): TranslationResult => ({ ...NO_RESULT, reason });

/** Clé de comparaison des textes protégés : NFC, espaces et apostrophes unifiées, minuscules. */
const looseKey = (s: string): string =>
  s.normalize('NFC').replace(/[\s\u00A0\u202F]+/gu, ' ').replace(/[’ʼ‘]/gu, "'").trim().toLowerCase();

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Motif qui retrouve, dans le texte reçu, un segment du texte normalisé (espaces et apostrophes d'origine). */
const originalPattern = (normalized: string): RegExp =>
  new RegExp(
    [...normalized].map((c) => (c === ' ' ? '[\\s\\u00A0\\u202F]+' : c === "'" ? "['’ʼ‘]" : escapeRegExp(c))).join(''),
    'gu',
  );

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const digits = (s: string): string => [...s].filter((c) => /\p{Nd}/u.test(c)).sort().join('');

/** Hachage FNV-1a 32 bits (libraryVersion). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

interface Span {
  start: number;
  end: number;
  /** Jeton du moteur ; null si le segment vient de la détection de l'extension. */
  kind: TokenKind | null;
}

/** Montant « 5 000 FCFA » : segments « 5 000 » et « FCFA » (contrat §12). */
function splitAmount(core: string, span: Span): Span[] {
  const text = core.slice(span.start, span.end);
  const m = /^(.*\p{Nd})([\s\u00A0\u202F]*)(\P{Nd}+)$/u.exec(text) ?? /^(\P{Nd}+?)([\s\u00A0\u202F]*)(\p{Nd}.*)$/u.exec(text);
  if (!m || (m[2] ?? '') === '') return [span];
  const first = (m[1] ?? '').length;
  const second = first + (m[2] ?? '').length;
  return [
    { start: span.start, end: span.start + first, kind: span.kind },
    { start: span.start + second, end: span.end, kind: span.kind },
  ];
}

interface Protection {
  /** Segments protégés, dans l'ordre du texte. */
  segments: string[];
  /** Remplacements forme normalisée → octets d'origine, à appliquer à la sortie du moteur. */
  restore: [string, string][];
  /** Faux si un segment du moteur n'a pas été retrouvé dans le texte reçu. */
  located: boolean;
  /** Vrai si le texte ne contient que des segments protégés, des espaces et de la ponctuation. */
  onlyProtected: boolean;
}

function protection(core: string, guards: readonly string[], detect: ProtectedDetector | undefined): Protection {
  const spans: Span[] = [];
  const restore: [string, string][] = [];
  let located = true;
  let from = 0;
  for (const token of normalize(core, { guards }).tokens) {
    if (!PROTECTED_KINDS.has(token.kind)) continue;
    const pattern = originalPattern(token.text);
    pattern.lastIndex = from;
    const m = pattern.exec(core);
    if (!m) {
      located = false;
      continue;
    }
    const span: Span = { start: m.index, end: m.index + m[0].length, kind: token.kind };
    from = span.end;
    if (m[0] !== token.text) restore.push([token.text, m[0]]);
    spans.push(span);
  }
  if (detect) {
    let at = 0;
    for (const segment of detect(core)) {
      if (typeof segment !== 'string' || segment.length === 0) continue;
      const i = core.indexOf(segment, at);
      if (i < 0) continue;
      spans.push({ start: i, end: i + segment.length, kind: null });
      at = i + segment.length;
    }
  }
  // Segments qui se chevauchent : le plus long l'emporte.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const span of spans) {
    const last = kept[kept.length - 1];
    if (last && span.start < last.end) {
      if (span.end - span.start > last.end - last.start) kept[kept.length - 1] = span;
      continue;
    }
    kept.push(span);
  }
  const pieces = kept.flatMap((s) => (s.kind === 'amount' ? splitAmount(core, s) : [s]));
  let rest = core;
  for (const s of [...kept].reverse()) rest = rest.slice(0, s.start) + rest.slice(s.end);
  return {
    segments: pieces.map((s) => core.slice(s.start, s.end)),
    restore,
    located,
    onlyProtected: kept.length > 0 && /^[\s\p{P}\p{S}]*$/u.test(rest),
  };
}

/** Remet les octets d'origine des segments protégés dans la sortie du moteur. */
function restoreSegments(output: string, restore: readonly [string, string][]): string {
  let out = output;
  let from = 0;
  for (const [normalized, original] of restore) {
    const i = out.indexOf(normalized, from);
    if (i < 0) continue;
    out = out.slice(0, i) + original + out.slice(i + normalized.length);
    from = i + original.length;
  }
  return out;
}

/** I5 : chaque segment présent au moins autant de fois qu'annoncé, jamais plus que dans le texte ; mêmes chiffres. */
function intact(text: string, shown: string, segments: readonly string[]): boolean {
  for (const segment of new Set(segments)) {
    const listed = segments.filter((s) => s === segment).length;
    if (count(shown, segment) < listed || count(shown, segment) > count(text, segment)) return false;
  }
  return digits(shown) === digits(text);
}

/** Correspondance avec une entrée de D8 : une seule unité à traduire, trouvée telle quelle dans le corpus. */
function entryMatch(core: string, r: TextResult, corpusText: ReadonlyMap<string, string>): { unit: UnitResult; entryId: string; kind: MatchKind } | null {
  const translatable = r.units.filter((u) => u.status !== 'PASSTHROUGH');
  const unit = translatable[0];
  if (translatable.length !== 1 || !unit || unit.match !== 'EXACT' || unit.entryId === null) return null;
  const text = corpusText.get(unit.entryId) ?? '';
  const kind: MatchKind = r.units.length > 1 ? 'label-value' : text.includes('{') ? 'template' : core === text ? 'exact' : 'normalized';
  return { unit, entryId: unit.entryId, kind };
}

/** Ponctuation finale (« ? », « . », « … ») ignorée par la comparaison à D8. */
const finalPunctuation = (s: string): string => (/[.!?…\s]*$/u.exec(s)?.[0] ?? '').replace(/\s/gu, '');

/** Termes français gardés dans la sortie (M20), dans l'ordre des unités. */
const keptTerms = (r: TextResult): string[] =>
  r.units.flatMap((u) => (u.status === 'SUCCESS' || u.status === 'PARTIAL' ? (u.chosen?.eton.kept ?? []) : []));

/** Nombre de mots rendus en éton dans le texte. */
const etonWords = (r: TextResult): number =>
  r.units.reduce((n, u) => n + (u.status === 'SUCCESS' || u.status === 'PARTIAL' ? (u.chosen?.eton.found ?? 0) : 0), 0);

export function createContractEngine(resources: ContractResources, options: ContractEngineOptions = {}): TranslationEngine {
  const { detectProtected, ...engineOptions } = options;
  const engine = createEngine(resources, engineOptions);
  const approved = resources.approved ?? new Map<string, string>();
  const rejected = resources.rejected ?? new Set<string>();
  const protectedEntries = resources.protectedEntries ?? [];
  const protectedByKey = new Map(protectedEntries.map((e) => [looseKey(e.text), e] as const));
  const corpusText = new Map(resources.corpus.map((e) => [e.id, e.text] as const));
  // Entrées de même texte (ex. VOC-023 et P2-3 « Montant ») : leurs décisions de relecture valent pour toutes.
  const sameText = new Map<string, string[]>();
  for (const e of resources.corpus) {
    const key = textKey(e.text, resources.guards);
    const ids = sameText.get(key) ?? [];
    ids.push(e.id);
    sameText.set(key, ids);
  }
  const groupOf = (id: string): readonly string[] => sameText.get(textKey(corpusText.get(id) ?? '', resources.guards)) ?? [id];

  function translateCore(req: TranslationRequest): TranslationResult {
    if (req === null || typeof req !== 'object' || typeof req.text !== 'string') return noMatch();
    const { text } = req;
    if (text.length > MAX_TEXT_LENGTH) return noMatch('too-long');
    // Texte mal formé (surrogate isolé) : rien de sûr à afficher, le texte original reste.
    if (/\p{Cs}/u.test(text)) return noMatch();
    if (req.targetLang !== 'eto') return noMatch('unsupported-language');
    // Q15 : seul le français est traduit ; 'auto' cherche donc en français.
    if (req.sourceLang !== 'fr' && req.sourceLang !== 'auto') return noMatch('unsupported-language');

    const lead = /^\s*/u.exec(text)?.[0] ?? '';
    const rest = text.slice(lead.length);
    const trail = /\s*$/u.exec(rest)?.[0] ?? '';
    const core = rest.slice(0, rest.length - trail.length);
    if (core === '') return noMatch();

    const prot = protection(core, resources.guards, detectProtected);
    const base = { ...NO_RESULT, detectedSourceLang: 'fr' as const, protectedSegments: prot.segments };

    const listed = protectedByKey.get(looseKey(core));
    if (listed) {
      return { ...base, status: 'PROTECTED', entryId: listed.id, matchKind: core === listed.text ? 'exact' : 'normalized', reason: listed.reason };
    }
    if (prot.onlyProtected) return { ...base, status: 'PROTECTED', detectedSourceLang: null, reason: 'protected-value' };

    const r = engine.translate(core);
    if (r.status === 'PASSTHROUGH') {
      // Rien à traduire : PROTECTED seulement s'il y a des valeurs protégées (sinon ponctuation, symboles…).
      return prot.segments.length > 0 ? { ...base, status: 'PROTECTED', detectedSourceLang: null, reason: 'protected-value' } : noMatch();
    }

    const entry = entryMatch(core, r, corpusText);
    const untranslated = (): TranslationResult =>
      entry ? { ...base, status: 'KNOWN_UNTRANSLATED', entryId: entry.entryId, matchKind: entry.kind } : noMatch();
    const shown = (eton: string): string | null => {
      const out = lead + restoreSegments(eton, prot.restore) + trail;
      return prot.located && intact(text, out, prot.segments) ? out : null;
    };

    const group = entry ? groupOf(entry.entryId) : [];
    if (group.some((id) => rejected.has(id))) return untranslated();
    const targets = new Set(group.flatMap((id) => approved.get(id) ?? []));
    // Une traduction validée n'est renvoyée telle quelle que si le texte a la même ponctuation finale
    // (« Frais de transfert ? » n'est pas « Frais de transfert ») et si les validations concordent.
    const validated = entry && (entry.kind === 'exact' || entry.kind === 'normalized') && targets.size === 1
      && finalPunctuation(core) === finalPunctuation(corpusText.get(entry.entryId) ?? '') ? [...targets][0] : undefined;
    if (entry && validated !== undefined) {
      const output = shown(validated);
      if (output !== null) return { ...base, status: 'APPROVED', output, entryId: entry.entryId, matchKind: entry.kind };
    }
    if ((r.status !== 'SUCCESS' && r.status !== 'PARTIAL') || etonWords(r) === 0) return untranslated();

    const unverifiedOutput = shown(r.status === 'SUCCESS' ? (r.output ?? '') : (r.draft ?? ''));
    if (unverifiedOutput === null) return untranslated();
    return {
      ...base,
      status: 'PENDING_VALIDATION',
      unverifiedOutput,
      unverifiedKind: r.status === 'SUCCESS' ? 'complete' : 'partial',
      entryId: entry?.entryId ?? null,
      matchKind: entry?.kind ?? 'composed',
      keptFrench: keptTerms(r),
    };
  }

  function translate(req: TranslationRequest): TranslationResult {
    try {
      return translateCore(req);
    } catch {
      // I2 : jamais d'exception ; dans le doute, le texte original reste affiché.
      return noMatch();
    }
  }

  let info: EngineInfo | null = null;
  function computeInfo(): EngineInfo {
    const counts = { approved: 0, pending: 0, untranslated: 0, protected: protectedEntries.length };
    for (const e of resources.corpus) {
      const status = translate({ text: e.text, sourceLang: 'fr', targetLang: 'eto' }).status;
      if (status === 'APPROVED') counts.approved += 1;
      else if (status === 'PENDING_VALIDATION') counts.pending += 1;
      else if (status === 'PROTECTED') counts.protected += 1;
      else counts.untranslated += 1;
    }
    const library = JSON.stringify([
      resources.corpus, resources.guards, resources.d7, resources.ignored, resources.critical, resources.wrongSenses ?? [], resources.keptFrench ?? [],
      protectedEntries, [...approved], [...rejected], resources.lexicon.size,
    ]);
    return {
      engineId: 'finethnic',
      contractVersion: CONTRACT_VERSION,
      libraryVersion: `mot-${ENGINE_VERSION}+${fnv1a(library)}`,
      targetLang: 'eto',
      variety: 'obala',
      entryCounts: counts,
    };
  }

  const engineContract: TranslationEngine = {
    info: () => {
      info ??= computeInfo();
      return { ...info, entryCounts: { ...info.entryCounts } };
    },
    translate,
    translateMany: (requests) => (Array.isArray(requests) ? requests.map((r) => translate(r)) : []),
  };
  return engineContract;
}
