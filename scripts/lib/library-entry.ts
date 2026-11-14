/**
 * Type TypeScript d'une entrée de data/ (miroir de data/schemas/entry.schema.json).
 * Le schéma reste la référence : validate-data vérifie chaque fichier avec Ajv.
 */

export type EntryKind = 'term' | 'action' | 'security' | 'message' | 'template' | 'guard' | 'page';
export type Disposition = 'TRANSLATABLE' | 'PROTECTED' | 'OUT_OF_SCOPE';
export type Sensitivity = 'critical' | 'high' | 'standard' | null;
export type VariableType =
  | 'amount' | 'currency' | 'date' | 'time' | 'duration' | 'name' | 'phone'
  | 'account-number' | 'reference' | 'number' | 'brand' | 'other';
export type TranslationStatus =
  | 'SOURCE_EXTRACTED' | 'TRANSLATION_PENDING' | 'DICTIONARY_ATTESTED'
  | 'CONTEXT_PENDING' | 'REVIEW_PENDING' | 'VALIDATED_OBALA';
export type ReviewState = 'PENDING' | 'VALIDATED' | 'REJECTED';

export interface Variable {
  name: string;
  type: VariableType;
}

export interface SimpleFrench {
  synonyms: string[];
  definition: string | null;
}

export interface SourceFr {
  text: string;
  variants: string[];
  origin: string;
  simple?: SimpleFrench | null;
}

export interface SourceEn {
  text: string;
  variants: string[];
  origin: string;
  mappingReview: ReviewState;
}

export interface EtoTarget {
  variety: 'obala';
  text: string | null;
  variants: string[];
  translationStatus: TranslationStatus;
  dictionaryEvidence: { form: string; gloss: string; ref: string }[];
  proposals: {
    text: string;
    method: 'direct' | 'synonym' | 'definition';
    from: string;
    rules: string[];
    missing: string[];
    generatedBy: string;
  }[];
  validation: {
    linguistic: ReviewState;
    financialMeaning: ReviewState;
    reviews: {
      reviewer: string;
      date: string;
      aspect: 'linguistic' | 'financialMeaning';
      decision: 'VALIDATED' | 'CORRECTED' | 'REJECTED';
      comment?: string;
    }[];
  };
}

export interface EntryLinks {
  corpusRef: { id: string; type: 'exact' | 'meaning' } | null;
  pageRefs: string[];
  templateRefs: string[];
  duplicateOf: string | null;
  relatedTo: string[];
  mergedFrom?: string[];
}

export interface LibraryEntry {
  id: string;
  kind: EntryKind;
  category?: string | null;
  subcategory?: string | null;
  disposition: Disposition;
  sensitivity: Sensitivity;
  source: { fr: SourceFr; en: SourceEn | null };
  variables: Variable[];
  context?: string | null;
  example?: string | null;
  contextHints?: { roles?: string[]; steps?: number[] };
  target: { eto: EtoTarget | null };
  links: EntryLinks;
  deprecated: boolean;
  notes?: string;
}

/** Cible Éton vide : aucune forme, aucune proposition, relecture en attente (PROJECT_CONTEXT §4.5). */
export function pendingEtoTarget(): EtoTarget {
  return {
    variety: 'obala',
    text: null,
    variants: [],
    translationStatus: 'TRANSLATION_PENDING',
    dictionaryEvidence: [],
    proposals: [],
    validation: { linguistic: 'PENDING', financialMeaning: 'PENDING', reviews: [] },
  };
}
