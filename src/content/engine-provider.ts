/**
 * Choix du moteur (P2.8, BM7, contrat §4 « Chargement ») : SEUL fichier qui importe un moteur.
 *
 * `build.mjs --engine` fixe le moteur à la construction :
 * - `real` (production par défaut) : le vrai moteur (`createContractEngine`), avec ses ressources embarquées
 *   dans le bundle (`engine-resources.ts`) et les motifs protégés de l'extension (`detectProtected`, Q14 révisée) ;
 * - `fake` (développement par défaut) : le faux moteur (contrat §9), interdit en production ;
 * - `none` : aucun moteur ; la page est analysée, mais aucun texte n'est évalué.
 *
 * Un moteur dont `info().contractVersion` diffère de la version attendue est refusé (T-CON-07). Un moteur
 * qui ne se construit pas (ressources illisibles) est remplacé par l'absence de moteur : la page reste en
 * français.
 */
import { createContractEngine } from '../engine/contract-engine';
import { CONTRACT_VERSION, type TranslationEngine } from '../language/contract';
import { detectProtected } from '../protection/patterns';
import { reviveResources } from './engine-resources';
import { createFakeEngine } from './fake-engine';

/** Moteur choisi à la construction ; absent hors bundle (tests). */
declare const __FINETHNIC_ENGINE__: 'real' | 'fake' | 'none' | undefined;
/** Ressources sérialisées du vrai moteur, définies seulement avec `--engine real`. */
declare const __FINETHNIC_ENGINE_DATA__: string;
declare const __FINETHNIC_ENGINE_LEXICON__: string;

/** Renvoie le moteur s'il respecte la version du contrat attendue par l'extension, sinon `null`. */
export function acceptEngine(engine: TranslationEngine | null): TranslationEngine | null {
  if (!engine) return null;
  try {
    return engine.info().contractVersion === CONTRACT_VERSION ? engine : null;
  } catch {
    return null;
  }
}

/** Construit le moteur, ou `null` s'il échoue : jamais d'exception vers la page. */
export function buildEngine(create: () => TranslationEngine): TranslationEngine | null {
  try {
    return acceptEngine(create());
  } catch {
    return null;
  }
}

export function provideEngine(): TranslationEngine | null {
  // Conditions écrites en place (pas dans une constante) : esbuild les réduit à `true` ou `false` et
  // élimine du bundle le moteur non choisi, ses ressources comprises.
  if (typeof __FINETHNIC_ENGINE__ !== 'undefined' && __FINETHNIC_ENGINE__ === 'real') {
    return buildEngine(() =>
      createContractEngine(reviveResources({ data: __FINETHNIC_ENGINE_DATA__, lexicon: __FINETHNIC_ENGINE_LEXICON__ }), {
        detectProtected,
      }),
    );
  }
  if (typeof __FINETHNIC_ENGINE__ !== 'undefined' && __FINETHNIC_ENGINE__ === 'fake') {
    return buildEngine(() => createFakeEngine({ detectProtected }));
  }
  return null;
}
