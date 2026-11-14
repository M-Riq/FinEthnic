/**
 * Choix du moteur (P2.8, contrat §4 « Chargement ») : SEUL fichier qui importe un moteur.
 *
 * - Construction de développement : le faux moteur (contrat §9).
 * - Construction de production : aucun moteur tant que l'inclusion du vrai moteur et de son lexique (D7)
 *   n'est pas décidée (BM7). La page est alors analysée, mais aucun texte n'est évalué.
 *
 * Un moteur dont `info().contractVersion` diffère de la version attendue est refusé (T-CON-07).
 */
import { CONTRACT_VERSION, type TranslationEngine } from '../language/contract';
import { createFakeEngine } from './fake-engine';

declare const __FINETHNIC_DEV__: boolean | undefined;

/** Renvoie le moteur s'il respecte la version du contrat attendue par l'extension, sinon `null`. */
export function acceptEngine(engine: TranslationEngine | null): TranslationEngine | null {
  if (!engine) return null;
  try {
    return engine.info().contractVersion === CONTRACT_VERSION ? engine : null;
  } catch {
    return null;
  }
}

export function provideEngine(): TranslationEngine | null {
  // Condition écrite en place (pas dans une constante) : esbuild la réduit à `false` en production
  // et élimine alors tout le faux moteur du bundle.
  return acceptEngine(typeof __FINETHNIC_DEV__ !== 'undefined' && __FINETHNIC_DEV__ ? createFakeEngine() : null);
}
