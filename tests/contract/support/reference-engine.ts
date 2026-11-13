/**
 * Moteur de RÉFÉRENCE à table, réservé aux tests de la suite de conformité.
 * Ce n'est ni le faux moteur d'Yvan (src/content/fake-engine.ts, P2.8) ni le vrai moteur (BM5) :
 * il montre seulement qu'un moteur conforme passe la suite, et sert de base aux moteurs
 * volontairement fautifs des auto-tests. Ses lignes reprennent les exemples du contrat §12.
 */
import {
  CONTRACT_VERSION,
  type EngineInfo,
  type SourceLang,
  type TranslationEngine,
  type TranslationRequest,
  type TranslationResult,
} from '../../../src/language/contract';

type Row = Omit<TranslationResult, 'detectedSourceLang'> & { lang: SourceLang | null };

const row = (r: Partial<Row> & Pick<Row, 'status'>): Row => ({
  output: null,
  unverifiedOutput: null,
  entryId: null,
  candidateIds: [],
  matchKind: 'exact',
  protectedSegments: [],
  reason: null,
  lang: 'fr',
  ...r,
});

const TABLE = new Map<string, Row>([
  ['Frais de transfert', row({ status: 'APPROVED', output: '⟦TEST:P2-001⟧', entryId: 'P2-001' })],
  ['Frais : 0 FCFA', row({ status: 'APPROVED', output: '⟦TEST:VOC-028⟧ : 0 FCFA', entryId: 'VOC-028', matchKind: 'label-value', protectedSegments: ['0', 'FCFA'] })],
  ['Votre transfert a été envoyé avec succès.', row({ status: 'APPROVED', output: '⟦TEST:P5-002⟧', entryId: 'P5-002' })],
  ['Montant', row({ status: 'KNOWN_UNTRANSLATED', entryId: 'VOC-023' })],
  ['Available balance', row({ status: 'KNOWN_UNTRANSLATED', entryId: 'VOC-008', lang: 'en' })],
  ['Confirmer le transfert', row({ status: 'PENDING_VALIDATION', unverifiedOutput: '⟦TEST:P4-012⟧', entryId: 'P4-012' })],
  ['Total : 5 000 FCFA', row({ status: 'PENDING_VALIDATION', unverifiedOutput: '⟦TEST:VOC-034⟧ : 5 000 FCFA', entryId: 'VOC-034', matchKind: 'label-value', protectedSegments: ['5 000', 'FCFA'] })],
  ['Retour', row({ status: 'AMBIGUOUS', candidateIds: ['TST-001', 'TST-002'], reason: 'context-required' })],
  ['250 000 FCFA', row({ status: 'PROTECTED', matchKind: null, protectedSegments: ['250 000', 'FCFA'], reason: 'protected-value', lang: null })],
  ['Safinum Pay', row({ status: 'PROTECTED', entryId: 'GUARD-001', reason: 'protected-entry' })],
  ['Points de fidélité', row({ status: 'PROTECTED', entryId: 'TST-003', reason: 'out-of-scope' })],
]);

const SOURCE_LANGS: readonly unknown[] = ['fr', 'en', 'auto'];

const noMatch = (reason: TranslationResult['reason']): TranslationResult => ({
  status: 'NO_MATCH',
  output: null,
  unverifiedOutput: null,
  entryId: null,
  candidateIds: [],
  matchKind: null,
  detectedSourceLang: null,
  protectedSegments: [],
  reason,
});

export function translateWithTable(req: TranslationRequest): TranslationResult {
  if (req.text.length > 2000) return noMatch('too-long');
  if (!SOURCE_LANGS.includes(req.sourceLang) || req.targetLang !== 'eto') return noMatch('unsupported-language');
  const lead = /^\s*/u.exec(req.text)?.[0] ?? '';
  const rest = req.text.slice(lead.length);
  const trail = /\s*$/u.exec(rest)?.[0] ?? '';
  const found = TABLE.get(rest.slice(0, rest.length - trail.length));
  if (!found || (req.sourceLang !== 'auto' && found.lang !== null && found.lang !== req.sourceLang)) return noMatch(null);
  const { lang, ...result } = found;
  return {
    ...result,
    output: result.output === null ? null : lead + result.output + trail,
    unverifiedOutput: result.unverifiedOutput === null ? null : lead + result.unverifiedOutput + trail,
    candidateIds: [...result.candidateIds],
    protectedSegments: [...result.protectedSegments],
    detectedSourceLang: lang,
  };
}

export const REFERENCE_INFO: EngineInfo = {
  engineId: 'finethnic',
  contractVersion: CONTRACT_VERSION,
  libraryVersion: '0.0.0-reference',
  targetLang: 'eto',
  variety: 'obala',
  entryCounts: { approved: 3, pending: 2, untranslated: 2, protected: 2 },
};

export function createReferenceEngine(): TranslationEngine {
  const engine: TranslationEngine = {
    info: () => ({ ...REFERENCE_INFO, entryCounts: { ...REFERENCE_INFO.entryCounts } }),
    translate: translateWithTable,
    translateMany: (requests) => requests.map((r) => engine.translate(r)),
  };
  return engine;
}
