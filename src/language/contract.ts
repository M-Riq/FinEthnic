/**
 * Contrat d'intégration moteur linguistique ⇄ extension Chrome.
 *
 * Ce fichier est la transcription EXACTE de INTEGRATION_CONTRACT.md §4.
 * Il ne contient que des types et des constantes, aucune logique.
 * Le test tests/contract/contract-sync.test.ts vérifie que la partie située
 * sous le repère ci-dessous est identique au bloc du §4.
 * Toute modification passe par la procédure du contrat §10 (PR `contract:`,
 * relecture obligatoire d'Yvan).
 */

// --- Transcription exacte de INTEGRATION_CONTRACT.md §4 ---
export const CONTRACT_VERSION = '0.1.0';

export type SourceLang = 'fr' | 'en';
export type TargetLang = 'eto';

/** Nature du texte, déduite du DOM par l'extension. Ne contient jamais de texte de la page. */
export type TextRole =
  | 'heading' | 'label' | 'button' | 'link' | 'message' | 'status'
  | 'option' | 'placeholder' | 'aria-label' | 'title' | 'unknown';

export interface TranslationContext {
  role?: TextRole;
  /** Valeur brute de <html lang> (ex. "fr", "fr-CM"), utilisée seulement pour départager les langues. */
  pageLang?: string;
  /** Étape SAFINUM si l'extension la connaît ; sinon absent. SPA à URL constante : jamais déduite de l'URL (§6). */
  step?: 1 | 2 | 3 | 4 | 5;
  /** Vrai si le texte est dans une région aria-live, une alerte ou une boîte de dialogue. */
  live?: boolean;
}

export interface TranslationRequest {
  /** Texte EXACT du nœud : non normalisé, espaces de début et de fin compris. */
  text: string;
  /** 'auto' : retenu (Q16), voir §5.3. */
  sourceLang: SourceLang | 'auto';
  targetLang: TargetLang;
  context?: TranslationContext;
}

export type TranslationStatus =
  | 'APPROVED'            // traduction disponible et approuvée
  | 'KNOWN_UNTRANSLATED'  // entrée connue, aucune traduction proposée
  | 'PENDING_VALIDATION'  // une proposition existe mais n'est pas approuvée
  | 'NO_MATCH'            // aucune correspondance
  | 'AMBIGUOUS'           // plusieurs correspondances, impossible de trancher
  | 'PROTECTED';          // texte qui ne doit pas être traduit

export type MatchKind = 'exact' | 'normalized' | 'variant' | 'template' | 'label-value';

export type ResultReason =
  | 'protected-entry'      // entrée de la bibliothèque marquée protégée (ex. "Safinum Pay", "FCFA")
  | 'protected-value'      // le texte n'est composé que de valeurs protégées (ex. "250 000 FCFA")
  | 'out-of-scope'         // entrée hors périmètre (D5 : OUT_OF_SCOPE)
  | 'context-required'     // AMBIGUOUS : plusieurs entrées, le contexte ne départage pas
  | 'multiple-languages'   // AMBIGUOUS : 'auto' trouve des entrées différentes en fr et en en
  | 'unsupported-language' // NO_MATCH : langue source ou cible non prise en charge
  | 'too-long';            // NO_MATCH : texte au-delà de la longueur maximale (§7, I10)

export interface TranslationResult {
  status: TranslationStatus;
  /** Non nul SI ET SEULEMENT SI status === 'APPROVED'. Texte complet prêt à afficher. */
  output: string | null;
  /** ID stable de l'unité de traduction (ex. "VOC-023", "P4-012", "GUARD-001"), sinon null. */
  entryId: string | null;
  /** AMBIGUOUS uniquement : ID des entrées candidates. Sinon []. */
  candidateIds: string[];
  matchKind: MatchKind | null;
  detectedSourceLang: SourceLang | null;
  /** Valeurs protégées trouvées dans `text`, dans l'ordre. Elles doivent se retrouver octet pour octet dans `output`. */
  protectedSegments: string[];
  reason: ResultReason | null;
}

export interface EngineInfo {
  engineId: 'finethnic' | 'fake';
  contractVersion: string;
  libraryVersion: string;
  targetLang: TargetLang;
  variety: 'obala';
  /** Statistiques de la bibliothèque embarquée (aucune donnée de page). */
  entryCounts: { approved: number; pending: number; untranslated: number; protected: number };
}

export interface TranslationEngine {
  info(): EngineInfo;
  translate(request: TranslationRequest): TranslationResult;
  translateMany(requests: readonly TranslationRequest[]): TranslationResult[];
}
