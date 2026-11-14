/**
 * Choix du moteur (P2.8, contrat §4 « Chargement ») : SEUL fichier qui crée un moteur.
 *
 * Phase 4 : le vrai moteur MOT (`createContractEngine`) est recréé à partir des ressources embarquées
 * (`engine-data.ts`, produites par `npm run build`), avec les motifs protégés de l'extension
 * (`detectProtected`, Q14 révisée). C'est le cas en production comme en développement : la page de test
 * locale doit montrer les vraies traductions.
 * Si les ressources manquent ou sont illisibles : aucun moteur en production (la page est analysée, aucun
 * texte n'est évalué) ; le faux moteur (contrat §9) en développement, visiblement factice.
 *
 * Un moteur dont `info().contractVersion` diffère de la version attendue est refusé (T-CON-07).
 */
import { engineFromBundle, type LoadedEngine } from '../engine/bundle';
import { CONTRACT_VERSION, type TranslationEngine } from '../language/contract';
import { detectProtected } from '../protection/patterns';
import { createFakeEngine } from './fake-engine';

declare const __FINETHNIC_DEV__: boolean | undefined;

/** Textes des ressources embarquées (voir `engine-data.ts`). */
export interface EngineData {
  resources: string;
  lefff: string;
}

export interface ProvidedEngine {
  engine: TranslationEngine | null;
  /** Vrai moteur et ses ressources (enrichissement de D8, lexique) ; null pour le faux moteur ou sans moteur. */
  loaded: LoadedEngine | null;
}

/** Renvoie le moteur s'il respecte la version du contrat attendue par l'extension, sinon `null`. */
export function acceptEngine(engine: TranslationEngine | null): TranslationEngine | null {
  if (!engine) return null;
  try {
    return engine.info().contractVersion === CONTRACT_VERSION ? engine : null;
  } catch {
    return null;
  }
}

export function provideEngine(data: EngineData | null = null): ProvidedEngine {
  let loaded: LoadedEngine | null = null;
  if (data) {
    try {
      loaded = engineFromBundle(data.resources, data.lefff, { detectProtected });
    } catch {
      loaded = null;
    }
  }
  // Condition écrite en place (pas dans une constante) : esbuild la réduit à `false` en production
  // et élimine alors tout le faux moteur du bundle.
  const fallback = typeof __FINETHNIC_DEV__ !== 'undefined' && __FINETHNIC_DEV__ ? createFakeEngine({ detectProtected }) : null;
  const engine = acceptEngine(loaded?.engine ?? fallback);
  return { engine, loaded: engine !== null && engine === loaded?.engine ? loaded : null };
}
