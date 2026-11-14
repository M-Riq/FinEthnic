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
export const CONTRACT_VERSION = '0.4.0';

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
  | 'PENDING_VALIDATION'  // traduction non vérifiée par une locutrice, dans unverifiedOutput (§5.4)
  | 'NO_MATCH'            // aucune correspondance
  | 'AMBIGUOUS'           // plusieurs correspondances, impossible de trancher
  | 'PROTECTED';          // texte qui ne doit pas être traduit

/**
 * 'composed' : texte absent de la bibliothèque, que le moteur compose à partir des entrées du corpus et
 * du dictionnaire (I7). Jamais APPROVED ; entryId vaut alors null.
 */
export type MatchKind = 'exact' | 'normalized' | 'variant' | 'template' | 'label-value' | 'composed';

/**
 * Nature d'une traduction non vérifiée (§5.4) :
 * - 'complete' : tout le texte est rendu ;
 * - 'partial'  : brouillon ; les mots que le moteur ne sait pas rendre restent en français, entre crochets.
 */
export type UnverifiedKind = 'complete' | 'partial';

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
  /**
   * Non nul SI ET SEULEMENT SI status === 'PENDING_VALIDATION'. Traduction NON VÉRIFIÉE par une locutrice,
   * pour tout le texte. Affichée seulement avec le marqueur et le texte original au survol (§5.4).
   */
  unverifiedOutput: string | null;
  /** Non nul SI ET SEULEMENT SI status === 'PENDING_VALIDATION'. 'partial' : brouillon, signalé comme incomplet (§5.4). */
  unverifiedKind: UnverifiedKind | null;
  /** ID stable de l'unité de traduction (ex. "VOC-023", "P4-012", "GUARD-001"), sinon null (dont matchKind 'composed'). */
  entryId: string | null;
  /** AMBIGUOUS uniquement : ID des entrées candidates. Sinon []. */
  candidateIds: string[];
  matchKind: MatchKind | null;
  detectedSourceLang: SourceLang | null;
  /** Valeurs protégées trouvées dans `text`, dans l'ordre. Elles doivent se retrouver octet pour octet dans `output`. */
  protectedSegments: string[];
  reason: ResultReason | null;
  /**
   * Facultatif (v0.4.0). Termes français gardés tels quels dans `unverifiedOutput` parce que le dictionnaire
   * ne les a pas (notions modernes validées par le responsable : « compte », « mot de passe »…), dans
   * l'ordre où ils y apparaissent (I12). Ils peuvent venir d'un synonyme de la bibliothèque et non de `text`.
   * Absent ou [] : aucun terme gardé signalé ; toujours absent ou [] hors PENDING_VALIDATION.
   */
  keptFrench?: string[];
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

/**
 * Détection des valeurs protégées fournie par l'extension (Q14 révisée, §8) : renvoie, dans l'ordre du
 * texte, les segments à ne jamais traduire. Le moteur l'ajoute à sa propre détection.
 */
export type ProtectedDetector = (text: string) => readonly string[];

export interface TranslationEngine {
  info(): EngineInfo;
  translate(request: TranslationRequest): TranslationResult;
  translateMany(requests: readonly TranslationRequest[]): TranslationResult[];
}
