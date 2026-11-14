import { describe, expect, it } from 'vitest';
import { CONFORMANCE_CHECKS, type ConformanceTarget } from './conformance';
import { CONTRACT_EXAMPLE_SAMPLES } from './fixtures/contract-examples';
import { createMotTestEngine, MOT_TEST_SAMPLES } from './fixtures/mot-engine';
import { createReferenceEngine } from './support/reference-engine';

/**
 * Moteurs soumis à la suite de conformité. Chaque moteur fournit ses échantillons.
 * - P2.9 (Yvan) : ajouter le faux moteur (src/content/fake-engine.ts) avec ses propres échantillons.
 * - Vrai moteur (MOT6) : moteur MOT chargé avec une bibliothèque et un dictionnaire de test (fixtures/mot-engine.ts).
 */
const TARGETS: readonly ConformanceTarget[] = [
  { name: 'moteur de référence (table de test, contrat §12)', createEngine: createReferenceEngine, samples: CONTRACT_EXAMPLE_SAMPLES },
  { name: 'moteur FinEthnic MOT (données de test)', createEngine: createMotTestEngine, samples: MOT_TEST_SAMPLES },
];

for (const target of TARGETS) {
  describe(`conformité au contrat — ${target.name}`, () => {
    for (const check of CONFORMANCE_CHECKS) {
      it(`${check.id} ${check.title}`, () => {
        expect(check.run(target.createEngine(), target.samples)).toEqual([]);
      });
    }
  });
}

describe('moteurs à brancher', () => {
  it.todo('faux moteur (P2.8–P2.9, Yvan)');
});
