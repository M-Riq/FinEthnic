/**
 * Faux moteur (P2.8, contrat §9) : développement et tests uniquement.
 *
 * - Sorties visiblement factices : `⟦FAKE⟧ ` suivi du texte original, jamais une chaîne qui ressemble à de l'éton.
 * - Les six statuts sont couverts par une table fixe de textes D8 (pages de test) et de textes anglais fictifs.
 * - Pur (I1) : aucune dépendance au DOM, à `chrome.*`, au réseau ni à l'horloge ; déterministe (I8).
 * - Absent du build de production : seul `engine-provider.ts` l'importe, derrière `__FINETHNIC_DEV__`, en secours
 *   du vrai moteur en développement (phase 4).
 *   La table est construite dans la fabrique pour que esbuild l'élimine ; `build.mjs` le vérifie.
 */
import {
  CONTRACT_VERSION,
  type EngineInfo,
  type MatchKind,
  type ProtectedDetector,
  type ResultReason,
  type SourceLang,
  type TranslationEngine,
  type TranslationRequest,
  type TranslationResult,
  type TranslationStatus,
  type UnverifiedKind,
} from '../language/contract';

const MAX_TEXT_LENGTH = 2000;

interface FakeRow {
  status: TranslationStatus;
  lang: SourceLang;
  entryId: string | null;
  matchKind: MatchKind;
  unverifiedKind?: UnverifiedKind;
  /** Brouillon factice (`partial`) : remplace le texte original après le marqueur. */
  draft?: string;
  candidateIds?: string[];
  reason?: ResultReason;
}

/**
 * Détection minimale des valeurs protégées, en attendant `src/protection/patterns.ts` (P3) :
 * montants groupés (espace, espace insécable, espace fine), signés ou non, tout mot qui contient un chiffre,
 * et les devises FCFA et XAF.
 */
export const detectFakeValues: ProtectedDetector = (text) =>
  text.match(/[+\-\u2212]?\p{Nd}{1,3}(?:[ \u00A0\u202F]\p{Nd}{3})+(?:[.,]\p{Nd}+)?(?!\p{Nd})|[^\s:\p{Nd}]*\p{Nd}[^\s:]*|\b(?:FCFA|XAF)\b/gu) ?? [];

/** Vrai si `text` ne contient que des valeurs protégées, de la ponctuation, des symboles et des espaces. */
function onlyValues(text: string, segments: readonly string[]): boolean {
  let rest = text;
  for (const segment of segments) rest = rest.replace(segment, ' ');
  return segments.length > 0 && /^[\s\p{P}\p{S}]*$/u.test(rest);
}

function result(status: TranslationStatus, fields: Partial<TranslationResult> = {}): TranslationResult {
  return {
    status,
    output: null,
    unverifiedOutput: null,
    unverifiedKind: null,
    entryId: null,
    candidateIds: [],
    matchKind: null,
    detectedSourceLang: null,
    protectedSegments: [],
    reason: null,
    ...fields,
  };
}

export interface FakeEngineOptions {
  /** Détection des valeurs protégées fournie par l'extension (Q14 révisée). Par défaut : `detectFakeValues`. */
  detectProtected?: ProtectedDetector;
}

export function createFakeEngine(options: FakeEngineOptions = {}): TranslationEngine {
  const detect = options.detectProtected ?? detectFakeValues;
  const MARK = '\u27E6FAKE\u27E7 ';
  const fr = (status: TranslationStatus, entryId: string | null, extra: Partial<FakeRow> = {}): FakeRow => ({
    status,
    lang: 'fr',
    entryId,
    matchKind: 'exact',
    ...extra,
  });
  const pending = (entryId: string): FakeRow => fr('PENDING_VALIDATION', entryId, { unverifiedKind: 'complete' });
  const draft = (text: string): FakeRow =>
    fr('PENDING_VALIDATION', null, { unverifiedKind: 'partial', matchKind: 'composed', draft: text });

  const table = new Map<string, FakeRow>([
    ['Votre compte', fr('APPROVED', 'P1-1')],
    ['Solde disponible', fr('APPROVED', 'P1-4')],
    ['Frais de transfert', fr('APPROVED', 'P2-1')],
    ['Frais', fr('APPROVED', 'P2-8')],
    ['Continuer', fr('APPROVED', 'P2-13')],
    ['Votre transfert a été envoyé avec succès', fr('APPROVED', 'P5-2')],
    ['Nouveau transfert', fr('APPROVED', 'P5-10')],
    ['Available balance', { ...fr('APPROVED', 'FAKE-EN-1'), lang: 'en' }],
    ['Montant', pending('P2-3')],
    ['Bénéficiaire', pending('P3-1')],
    ['Total débité', pending('P4-5')],
    ['Confirmer le transfert', pending('P4-12')],
    ['Effectuer un transfert', draft('Effectuer [un transfert]')],
    ['Consultez votre solde', draft('Consultez [votre solde]')],
    ['Total à débiter', fr('KNOWN_UNTRANSLATED', 'P2-10')],
    ['Référence', fr('KNOWN_UNTRANSLATED', 'P4-8')],
    ['Récapitulatif', fr('KNOWN_UNTRANSLATED', 'P4-1')],
    ['Recent transactions', { ...fr('KNOWN_UNTRANSLATED', 'FAKE-EN-2'), lang: 'en' }],
    ['Retour', fr('AMBIGUOUS', null, { matchKind: 'exact', candidateIds: ['P2-12', 'FAKE-AMB-1'], reason: 'context-required' })],
    ['Safinum Pay', fr('PROTECTED', 'FAKE-GUARD-1', { reason: 'protected-entry' })],
    ['Safinum', fr('PROTECTED', 'FAKE-GUARD-2', { reason: 'protected-entry' })],
  ]);

  const counts = { approved: 0, pending: 0, untranslated: 0, protected: 0 };
  for (const row of table.values()) {
    if (row.status === 'APPROVED') counts.approved++;
    else if (row.status === 'PENDING_VALIDATION') counts.pending++;
    else if (row.status === 'KNOWN_UNTRANSLATED') counts.untranslated++;
    else if (row.status === 'PROTECTED') counts.protected++;
  }

  const lookup = (text: string, lang: TranslationRequest['sourceLang']): FakeRow | undefined => {
    const row = table.get(text);
    return row && (lang === 'auto' || row.lang === lang) ? row : undefined;
  };

  /** Résultat d'une ligne, avec le texte affiché (`shown`) placé entre les espaces de bord d'origine (I4). */
  const fromRow = (row: FakeRow, shown: string, lead: string, trail: string, extra: Partial<TranslationResult>): TranslationResult => {
    const base: Partial<TranslationResult> = {
      entryId: row.entryId,
      matchKind: row.matchKind,
      detectedSourceLang: row.lang,
      ...extra,
    };
    switch (row.status) {
      case 'APPROVED':
        return result('APPROVED', { ...base, output: lead + MARK + shown + trail });
      case 'PENDING_VALIDATION':
        return result('PENDING_VALIDATION', {
          ...base,
          unverifiedOutput: lead + MARK + (row.draft ?? shown) + trail,
          unverifiedKind: row.unverifiedKind ?? 'complete',
        });
      case 'AMBIGUOUS':
        return result('AMBIGUOUS', { ...base, entryId: null, candidateIds: [...(row.candidateIds ?? [])], reason: row.reason ?? 'context-required' });
      case 'PROTECTED':
        return result('PROTECTED', { ...base, reason: row.reason ?? 'protected-entry' });
      default:
        return result(row.status, base);
    }
  };

  const translate = (req: TranslationRequest): TranslationResult => {
    const text: unknown = req.text;
    if (typeof text !== 'string') return result('NO_MATCH');
    if (text.length > MAX_TEXT_LENGTH) return result('NO_MATCH', { reason: 'too-long' });
    if ((req.sourceLang !== 'fr' && req.sourceLang !== 'en' && req.sourceLang !== 'auto') || req.targetLang !== 'eto') {
      return result('NO_MATCH', { reason: 'unsupported-language' });
    }
    const lead = /^\s*/u.exec(text)?.[0] ?? '';
    const rest = text.slice(lead.length);
    const trail = /\s*$/u.exec(rest)?.[0] ?? '';
    const core = rest.slice(0, rest.length - trail.length);
    if (core === '') return result('NO_MATCH');

    const row = lookup(core, req.sourceLang);
    if (row) return fromRow(row, core, lead, trail, {});

    const segments = [...detect(core)];
    if (onlyValues(core, segments)) {
      return result('PROTECTED', { protectedSegments: segments, reason: 'protected-value' });
    }

    // « Libellé : valeurs » : le libellé est dans la table et le reste n'est fait que de valeurs protégées.
    const labelled = /^(.+?)(\s*:\s*)(.+)$/su.exec(core);
    if (labelled) {
      const [, label = '', separator = '', values = ''] = labelled;
      const labelRow = lookup(label, req.sourceLang);
      const valueSegments = [...detect(values)];
      if (
        labelRow &&
        (labelRow.status === 'APPROVED' || labelRow.status === 'KNOWN_UNTRANSLATED' || (labelRow.status === 'PENDING_VALIDATION' && !labelRow.draft)) &&
        onlyValues(values, valueSegments)
      ) {
        return fromRow({ ...labelRow, matchKind: 'label-value' }, label + separator + values, lead, trail, {
          protectedSegments: valueSegments,
        });
      }
    }
    return result('NO_MATCH');
  };

  const info: EngineInfo = {
    engineId: 'fake',
    contractVersion: CONTRACT_VERSION,
    libraryVersion: '0.0.0-fake',
    targetLang: 'eto',
    variety: 'obala',
    entryCounts: counts,
  };

  return {
    info: () => ({ ...info, entryCounts: { ...counts } }),
    translate,
    translateMany: (requests) => requests.map(translate),
  };
}
