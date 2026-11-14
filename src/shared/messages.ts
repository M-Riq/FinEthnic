/**
 * Messages entre le popup et le script de contenu (P2.6), par `chrome.tabs.sendMessage` (sans permission `tabs`).
 *
 * La réponse ne contient que des compteurs, des booléens et des énumérations : jamais de texte de la page.
 */

export const DIAGNOSTIC_REQUEST = 'finethnic:diagnostic';
export const DIAGNOSTIC_RESULT = 'finethnic:diagnostic-result';

export interface DiagnosticRequest {
  type: typeof DIAGNOSTIC_REQUEST;
}

/**
 * Compteurs du diagnostic. `candidates` est le total des textes à traduire ; `waiting` (pas encore évalués)
 * et les compteurs par statut le répartissent. `numeric` compte à part les textes faits de chiffres sans lettre,
 * `values` les textes avec des lettres protégés par leur position (cellule valeur, écho de saisie : P3).
 */
export const COUNT_KEYS = [
  'candidates',
  'numeric',
  'values',
  'waiting',
  'approved',
  'unverified',
  'partial',
  'untranslated',
  'noMatch',
  'ambiguous',
  'protected',
] as const;
export type CountKey = (typeof COUNT_KEYS)[number];

export type EngineKind = 'none' | 'fake' | 'finethnic';
const ENGINE_KINDS: readonly EngineKind[] = ['none', 'fake', 'finethnic'];

export interface DiagnosticSnapshot {
  type: typeof DIAGNOSTIC_RESULT;
  /** Traduction activée : sinon la page n'est pas analysée et tous les compteurs valent 0. */
  enabled: boolean;
  engine: EngineKind;
  /** Étape SAFINUM reconnue (1 à 5), 0 si inconnue. */
  step: number;
  counts: Record<CountKey, number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function isDiagnosticRequest(message: unknown): message is DiagnosticRequest {
  return isRecord(message) && message['type'] === DIAGNOSTIC_REQUEST;
}

export function isDiagnosticSnapshot(message: unknown): message is DiagnosticSnapshot {
  if (!isRecord(message) || message['type'] !== DIAGNOSTIC_RESULT) return false;
  const { enabled, engine, step, counts } = message;
  return (
    typeof enabled === 'boolean' &&
    ENGINE_KINDS.some((kind) => kind === engine) &&
    isCount(step) &&
    step <= 5 &&
    isRecord(counts) &&
    COUNT_KEYS.every((key) => isCount(counts[key]))
  );
}
