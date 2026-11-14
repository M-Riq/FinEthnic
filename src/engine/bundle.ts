/**
 * Ressources du moteur embarquées dans l'extension (mission phase 4).
 *
 * `scripts/export-engine-data.ts` écrit, à chaque construction, deux textes que `build.mjs` intègre au
 * script de contenu (aucun accès réseau, contrat §9) :
 * - le paquet JSON (`serializeBundle`) : D8 (corpus, gardes, entrées protégées, décisions de relecture),
 *   D7 (entrées converties), règles de grammaire (D7 et esquisse HAL) et statistiques de la bibliothèque ;
 * - l'extrait de Lefff (`.mlex`), analysé ici par `parseLexicon`.
 * Le lexique n'est pas mis dans le JSON : son format texte est plus compact et plus rapide à lire.
 *
 * Module pur, sans dépendance à Node ni au navigateur.
 */
import type { EngineInfo } from '../language/contract';
import { type ContractEngineOptions, type ContractResources, createContractEngine, type ExtendableTranslationEngine } from './contract-engine';
import { parseLexicon } from './lexicon';

export const BUNDLE_FORMAT = 1;

type Serializable = Omit<ContractResources, 'lexicon' | 'approved' | 'rejected'>;

export interface EngineBundle {
  format: typeof BUNDLE_FORMAT;
  resources: Serializable & { approved: [string, string][]; rejected: string[] };
  library: Pick<EngineInfo, 'libraryVersion' | 'entryCounts'>;
}

/** Paquet JSON des ressources ; `library` vient de `info()` d'un moteur créé avec les mêmes ressources. */
export function serializeBundle(resources: ContractResources, library: EngineBundle['library']): string {
  const { lexicon: _lexicon, approved, rejected, ...rest } = resources;
  const bundle: EngineBundle = {
    format: BUNDLE_FORMAT,
    resources: { ...rest, approved: [...(approved ?? new Map<string, string>())], rejected: [...(rejected ?? new Set<string>())] },
    library: { libraryVersion: library.libraryVersion, entryCounts: { ...library.entryCounts } },
  };
  return JSON.stringify(bundle);
}

export interface LoadedEngine {
  engine: ExtendableTranslationEngine;
  resources: ContractResources;
}

/** Recrée le moteur à partir du paquet et du lexique. Lève une erreur si le paquet n'a pas le format attendu. */
export function engineFromBundle(json: string, mlex: string, options: Omit<ContractEngineOptions, 'libraryInfo'> = {}): LoadedEngine {
  const bundle = JSON.parse(json) as Partial<EngineBundle>;
  if (bundle.format !== BUNDLE_FORMAT || !bundle.resources || !bundle.library) {
    throw new Error(`Paquet du moteur illisible (format ${String(bundle.format)}, attendu ${BUNDLE_FORMAT})`);
  }
  const { approved, rejected, ...rest } = bundle.resources;
  const resources: ContractResources = { ...rest, lexicon: parseLexicon(mlex), approved: new Map(approved), rejected: new Set(rejected) };
  return { engine: createContractEngine(resources, { ...options, libraryInfo: bundle.library }), resources };
}
