/**
 * Suite de conformité au contrat d'intégration (INTEGRATION_CONTRACT.md §7 et §11, ROADMAP T-CON-01 à 05 et 07).
 *
 * Copropriété du responsable et d'Yvan : les MÊMES contrôles s'appliquent au faux moteur (P2) et au vrai
 * moteur (BM5). Chaque contrôle renvoie la liste de ses violations ; une liste vide signifie « conforme ».
 *
 * Les contrôles ne dépendent pas du contenu de la bibliothèque : chaque moteur fournit ses propres
 * échantillons (au moins une requête par statut, et deux cas de bord « libellé + valeurs » : approuvé et non vérifié).
 */
import { isDeepStrictEqual } from 'node:util';
import {
  CONTRACT_VERSION,
  type MatchKind,
  type ResultReason,
  type TranslationEngine,
  type TranslationRequest,
  type TranslationResult,
  type TranslationStatus,
} from '../../src/language/contract';

export const STATUSES = [
  'APPROVED',
  'KNOWN_UNTRANSLATED',
  'PENDING_VALIDATION',
  'NO_MATCH',
  'AMBIGUOUS',
  'PROTECTED',
] as const satisfies readonly TranslationStatus[];

// Échoue à la compilation si le contrat ajoute un statut absent de STATUSES.
const exhaustive: Exclude<TranslationStatus, (typeof STATUSES)[number]> extends never ? true : never = true;
void exhaustive;

const MATCH_KINDS: readonly (MatchKind | null)[] = ['exact', 'normalized', 'variant', 'template', 'label-value', null];

/** Raisons admises pour chaque statut (commentaires de ResultReason, contrat §4). */
const REASONS_BY_STATUS: Record<TranslationStatus, readonly (ResultReason | null)[]> = {
  APPROVED: [null],
  KNOWN_UNTRANSLATED: [null],
  PENDING_VALIDATION: [null],
  NO_MATCH: [null, 'unsupported-language', 'too-long'],
  AMBIGUOUS: ['context-required', 'multiple-languages'],
  PROTECTED: ['protected-entry', 'protected-value', 'out-of-scope'],
};

/** Longueur maximale (I10). */
export const MAX_TEXT_LENGTH = 2000;

export interface ConformanceSamples {
  /** Au moins une requête par statut (T-CON-01). */
  byStatus: Record<TranslationStatus, readonly TranslationRequest[]>;
  /**
   * Cas de bord APPROVED (T-CON-04) : espaces au début ET à la fin, et valeurs protégées connues
   * dans l'ordre du texte, ex. { request: "  Frais : 0 FCFA ", protectedSegments: ["0", "FCFA"] }.
   */
  edge: EdgeSample;
  /**
   * Même chose pour une traduction non vérifiée (PENDING_VALIDATION, décision Q9) : I4 et I5 s'appliquent
   * à unverifiedOutput, ex. { request: "  Total : 5 000 FCFA ", protectedSegments: ["5 000", "FCFA"] }.
   */
  pendingEdge: EdgeSample;
}

export interface EdgeSample {
  request: TranslationRequest;
  protectedSegments: readonly string[];
}

export interface ConformanceTarget {
  name: string;
  createEngine: () => TranslationEngine;
  samples: ConformanceSamples;
}

export interface ConformanceCheck {
  id: string;
  title: string;
  run: (engine: TranslationEngine, samples: ConformanceSamples) => string[];
}

/** Chaînes « hostiles » pour la totalité (I2). */
const PROBE_TEXTS: readonly string[] = [
  '',
  ' ',
  '\u00A0',
  '\n\t ',
  'a'.repeat(100_000),
  'Frais : 0 FCFA'.repeat(200),
  '💸💰🇨🇲',
  '\u0000\u0007\u001B',
  '\uD800',
  'x\uDC00y',
  '\u202Eabc',
  '{montant}',
  '<script>alert(1)</script>',
  '__proto__',
  'constructor',
  'hasOwnProperty',
  'null',
];

const PROBE_LANGS: readonly TranslationRequest['sourceLang'][] = ['fr', 'en', 'auto'];

const PROBE_CONTEXTS: readonly (TranslationRequest['context'] | undefined)[] = [
  undefined,
  {},
  { role: 'button', step: 3, live: true, pageLang: 'fr-CM' },
];

/** Marqueurs de test (⟦TEST:…⟧, ⟦FAKE⟧) : ignorés par le contrôle des chiffres et des segments (I5). */
const TEST_MARKER = /⟦(?:TEST|FAKE)[^⟧]*⟧/gu;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Requête gelée : un moteur qui modifie la requête lève une exception (pureté). */
function request(text: string, sourceLang: TranslationRequest['sourceLang'], context?: TranslationRequest['context']): TranslationRequest {
  return deepFreeze(context === undefined ? { text, sourceLang, targetLang: 'eto' } : { text, sourceLang, targetLang: 'eto', context });
}

function label(req: TranslationRequest): string {
  const shown = req.text.length > 40 ? `${req.text.slice(0, 40)}… (${req.text.length} car.)` : req.text;
  return `${JSON.stringify(shown)} [${req.sourceLang}${req.context ? ` ${JSON.stringify(req.context)}` : ''}]`;
}

/** Appelle translate sans jamais laisser échapper d'exception. */
function call(engine: TranslationEngine, req: TranslationRequest, violations: string[]): TranslationResult | null {
  try {
    return engine.translate(req);
  } catch (error) {
    violations.push(`${label(req)} : exception « ${(error as Error)?.message ?? String(error)} » (I2)`);
    return null;
  }
}

function checkEdge(engine: TranslationEngine, sample: EdgeSample, status: TranslationStatus, out: string[]): void {
  const edge = deepFreeze(sample.request);
  const expected = sample.protectedSegments;
  if (leading(edge.text) === '' || trailing(edge.text) === '') {
    out.push(`${label(edge)} : le cas de bord doit commencer ET finir par des espaces`);
  }
  if (expected.length === 0) out.push(`${label(edge)} : le cas de bord doit déclarer ses valeurs protégées`);
  const res = call(engine, edge, out);
  if (res && res.status !== status) {
    out.push(`${label(edge)} : le cas de bord doit être ${status}, obtenu ${res.status}`);
  }
  // Les segments annoncés par le moteur sont comparés à ceux attendus : sinon une valeur sans chiffre
  // (ex. la devise) pourrait être modifiée et simplement omise de protectedSegments.
  if (res && JSON.stringify(res.protectedSegments) !== JSON.stringify(expected)) {
    out.push(`${label(edge)} : protectedSegments ${JSON.stringify(res.protectedSegments)} au lieu de ${JSON.stringify(expected)} (I5)`);
  }
}

function allSamples(samples: ConformanceSamples): TranslationRequest[] {
  return [...STATUSES.flatMap((s) => samples.byStatus[s] ?? []), samples.edge.request, samples.pendingEdge.request].map(deepFreeze);
}

function probes(): TranslationRequest[] {
  return PROBE_TEXTS.flatMap((text) => PROBE_LANGS.flatMap((lang) => PROBE_CONTEXTS.map((ctx) => request(text, lang, ctx))));
}

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const digits = (s: string): string => [...s.replace(TEST_MARKER, '')].filter((c) => /\p{Nd}/u.test(c)).sort().join('');
const leading = (s: string): string => /^\s*/u.exec(s)?.[0] ?? '';
const trailing = (s: string): string => /\s*$/u.exec(s)?.[0] ?? '';

/** Forme d'un résultat (contrat §4 et §5.1). Renvoie les violations. */
export function checkResultShape(req: TranslationRequest, res: unknown): string[] {
  const where = label(req);
  if (res === null || typeof res !== 'object') return [`${where} : résultat absent ou non objet`];
  const r = res as TranslationResult;
  const out: string[] = [];
  if (!(STATUSES as readonly string[]).includes(r.status)) return [`${where} : statut invalide ${JSON.stringify(r.status)}`];

  if (r.status === 'APPROVED' ? typeof r.output !== 'string' || r.output.length === 0 : r.output !== null) {
    out.push(`${where} : ${r.status} avec output ${JSON.stringify(r.output)} (I3 : output non nul ⇔ APPROVED)`);
  }
  if (
    r.status === 'PENDING_VALIDATION'
      ? typeof r.unverifiedOutput !== 'string' || r.unverifiedOutput.length === 0
      : r.unverifiedOutput !== null
  ) {
    out.push(`${where} : ${r.status} avec unverifiedOutput ${JSON.stringify(r.unverifiedOutput)} (I3 : unverifiedOutput non nul ⇔ PENDING_VALIDATION)`);
  }
  if (!Array.isArray(r.candidateIds) || r.candidateIds.some((id) => typeof id !== 'string')) {
    out.push(`${where} : candidateIds doit être un tableau de chaînes`);
  } else if (r.status === 'AMBIGUOUS' ? r.candidateIds.length < 2 : r.candidateIds.length !== 0) {
    out.push(`${where} : ${r.status} avec ${r.candidateIds.length} candidat(s) (≥ 2 si AMBIGUOUS, sinon [])`);
  }
  const needsEntry = r.status === 'APPROVED' || r.status === 'KNOWN_UNTRANSLATED' || r.status === 'PENDING_VALIDATION';
  if (needsEntry && (typeof r.entryId !== 'string' || r.entryId.length === 0)) {
    out.push(`${where} : ${r.status} sans entryId`);
  }
  if ((r.status === 'NO_MATCH' || r.status === 'AMBIGUOUS') && r.entryId !== null) {
    out.push(`${where} : ${r.status} avec entryId ${JSON.stringify(r.entryId)} (attendu : null)`);
  }
  if (!REASONS_BY_STATUS[r.status].includes(r.reason)) {
    out.push(`${where} : raison ${JSON.stringify(r.reason)} impossible pour ${r.status}`);
  }
  if (!MATCH_KINDS.includes(r.matchKind) || (r.status === 'NO_MATCH' && r.matchKind !== null)) {
    out.push(`${where} : matchKind ${JSON.stringify(r.matchKind)} invalide pour ${r.status}`);
  }
  if (r.detectedSourceLang !== null && r.detectedSourceLang !== 'fr' && r.detectedSourceLang !== 'en') {
    out.push(`${where} : detectedSourceLang invalide ${JSON.stringify(r.detectedSourceLang)}`);
  }
  if (!Array.isArray(r.protectedSegments) || r.protectedSegments.some((s) => typeof s !== 'string' || s.length === 0)) {
    out.push(`${where} : protectedSegments doit être un tableau de chaînes non vides`);
  } else {
    let from = 0;
    for (const segment of r.protectedSegments) {
      const at = req.text.indexOf(segment, from);
      if (at < 0) {
        out.push(`${where} : segment protégé ${JSON.stringify(segment)} absent du texte, ou dans le désordre`);
        break;
      }
      from = at + segment.length;
    }
  }
  return out;
}

/** Texte affichable d'un résultat : `output` (APPROVED) ou `unverifiedOutput` (PENDING_VALIDATION, §5.4). */
function shownText(r: TranslationResult): { field: 'output' | 'unverifiedOutput'; text: string } | null {
  if (r.status === 'APPROVED' && typeof r.output === 'string') return { field: 'output', text: r.output };
  if (r.status === 'PENDING_VALIDATION' && typeof r.unverifiedOutput === 'string') return { field: 'unverifiedOutput', text: r.unverifiedOutput };
  return null;
}

/** Bords et valeurs protégées du texte affichable (I4, I5), approuvé ou non vérifié. */
function checkShownIntegrity(req: TranslationRequest, r: TranslationResult): string[] {
  const shown = shownText(r);
  if (!shown) return [];
  const { field, text: shownValue } = shown;
  const where = label(req);
  const out: string[] = [];
  if (leading(shownValue) !== leading(req.text) || trailing(shownValue) !== trailing(req.text)) {
    out.push(`${where} : espaces de bord modifiés dans ${field} ${JSON.stringify(shownValue)} (I4)`);
  }
  const output = shownValue.replace(TEST_MARKER, '');
  const text = req.text.replace(TEST_MARKER, '');
  const segments = Array.isArray(r.protectedSegments) ? r.protectedSegments : [];
  for (const segment of new Set(segments)) {
    const listed = segments.filter((s) => s === segment).length;
    // Borne basse : chaque segment annoncé est présent. Borne haute : jamais plus de copies que dans text
    // (une égalité stricte échouerait à tort quand un segment est inclus dans un autre, ex. "0" dans "250 000").
    if (count(output, segment) < listed) {
      out.push(`${where} : segment protégé ${JSON.stringify(segment)} absent de ${field} ou trop peu présent (I5)`);
    }
    if (count(output, segment) > count(text, segment)) {
      out.push(`${where} : segment protégé ${JSON.stringify(segment)} plus présent dans ${field} que dans text (I5)`);
    }
  }
  if (digits(output) !== digits(req.text)) {
    out.push(`${where} : chiffres différents entre text et ${field} ${JSON.stringify(shownValue)} (I5)`);
  }
  return out;
}

export const CONFORMANCE_CHECKS: readonly ConformanceCheck[] = [
  {
    id: 'T-CON-07',
    title: 'info() : version du contrat, langue et variété',
    run(engine) {
      const out: string[] = [];
      let info;
      try {
        info = engine.info();
      } catch (error) {
        return [`info() : exception « ${(error as Error)?.message ?? String(error)} »`];
      }
      if (info.contractVersion !== CONTRACT_VERSION) {
        out.push(`contractVersion ${JSON.stringify(info.contractVersion)} ≠ ${CONTRACT_VERSION} attendu par l'extension`);
      }
      if (info.engineId !== 'finethnic' && info.engineId !== 'fake') out.push(`engineId invalide ${JSON.stringify(info.engineId)}`);
      if (info.targetLang !== 'eto') out.push(`targetLang ${JSON.stringify(info.targetLang)} ≠ "eto"`);
      if (info.variety !== 'obala') out.push(`variety ${JSON.stringify(info.variety)} ≠ "obala"`);
      if (typeof info.libraryVersion !== 'string' || info.libraryVersion.length === 0) out.push('libraryVersion vide');
      for (const key of ['approved', 'pending', 'untranslated', 'protected'] as const) {
        const n = info.entryCounts?.[key];
        if (!Number.isInteger(n) || n < 0) out.push(`entryCounts.${key} invalide ${JSON.stringify(n)}`);
      }
      return out;
    },
  },
  {
    id: 'T-CON-01',
    title: 'un cas par statut : les 6 statuts sont obtenus',
    run(engine, samples) {
      const out: string[] = [];
      for (const status of STATUSES) {
        const reqs = samples.byStatus[status] ?? [];
        if (reqs.length === 0) out.push(`aucun échantillon pour ${status}`);
        for (const req of reqs.map(deepFreeze)) {
          const res = call(engine, req, out);
          if (res && res.status !== status) out.push(`${label(req)} : ${res.status} au lieu de ${status}`);
        }
      }
      return out;
    },
  },
  {
    id: 'T-CON-02',
    title: 'forme des résultats et I3 (output ⇔ APPROVED, unverifiedOutput ⇔ PENDING_VALIDATION)',
    run(engine, samples) {
      const out: string[] = [];
      for (const req of [...allSamples(samples), ...probes()]) {
        const res = call(engine, req, out);
        if (res) out.push(...checkResultShape(req, res));
      }
      return out;
    },
  },
  {
    id: 'T-CON-03',
    title: 'totalité (I2) et longueur maximale (I10)',
    run(engine, samples) {
      const out: string[] = [];
      for (const req of probes()) {
        const res = call(engine, req, out);
        if (!res) continue;
        if (!(STATUSES as readonly string[]).includes(res.status)) out.push(`${label(req)} : statut invalide (I2)`);
        if (req.text.length > MAX_TEXT_LENGTH && (res.status !== 'NO_MATCH' || res.reason !== 'too-long')) {
          out.push(`${label(req)} : ${res.status}/${res.reason} au lieu de NO_MATCH/too-long (I10)`);
        }
      }
      const approved = samples.byStatus.APPROVED?.[0];
      if (approved) {
        const padded = request(approved.text.padEnd(MAX_TEXT_LENGTH + 1, ' '), approved.sourceLang, approved.context);
        const res = call(engine, padded, out);
        if (res && (res.status !== 'NO_MATCH' || res.reason !== 'too-long')) {
          out.push(`texte approuvé complété par des espaces au-delà de ${MAX_TEXT_LENGTH} caractères : ${res.status} au lieu de NO_MATCH/too-long (I10)`);
        }
        const unsupported: TranslationRequest[] = [
          { ...approved, sourceLang: 'de' as TranslationRequest['sourceLang'] },
          { ...approved, targetLang: 'fr' as TranslationRequest['targetLang'] },
        ].map(deepFreeze);
        for (const req of unsupported) {
          const r = call(engine, req, out);
          if (r && (r.status !== 'NO_MATCH' || r.reason !== 'unsupported-language')) {
            out.push(`langue non prise en charge (${req.sourceLang} → ${req.targetLang}) : ${r.status}/${r.reason} au lieu de NO_MATCH/unsupported-language`);
          }
        }
      }
      return out;
    },
  },
  {
    id: 'T-CON-04',
    title: 'bords et valeurs protégées (I4, I5)',
    run(engine, samples) {
      const out: string[] = [];
      checkEdge(engine, samples.edge, 'APPROVED', out);
      checkEdge(engine, samples.pendingEdge, 'PENDING_VALIDATION', out);
      for (const req of allSamples(samples)) {
        const res = call(engine, req, out);
        if (res) out.push(...checkShownIntegrity(req, res));
      }
      return out;
    },
  },
  {
    id: 'T-CON-05',
    title: 'déterminisme (I8) et translateMany',
    run(engine, samples) {
      const out: string[] = [];
      const reqs = [...allSamples(samples), ...probes().filter((r) => r.text.length < 200)];
      const first = reqs.map((req) => call(engine, req, out));
      const second = reqs.map((req) => call(engine, req, out));
      reqs.forEach((req, i) => {
        if (!isDeepStrictEqual(first[i], second[i])) out.push(`${label(req)} : deux appels donnent des résultats différents (I8)`);
      });
      try {
        const many = engine.translateMany(deepFreeze([...reqs]));
        if (!isDeepStrictEqual(many, first)) out.push('translateMany(requêtes) ≠ requêtes.map(translate)');
        if (!isDeepStrictEqual(engine.translateMany(deepFreeze([])), [])) out.push('translateMany([]) doit renvoyer []');
      } catch (error) {
        out.push(`translateMany : exception « ${(error as Error)?.message ?? String(error)} » (I2)`);
      }
      return out;
    },
  },
];

/** Exécute toute la suite sur un moteur. */
export function checkConformance(target: ConformanceTarget): { id: string; title: string; violations: string[] }[] {
  return CONFORMANCE_CHECKS.map((check) => ({
    id: check.id,
    title: check.title,
    violations: check.run(target.createEngine(), target.samples),
  }));
}
