import { describe, expect, it } from 'vitest';
import { createFakeEngine } from '../../src/content/fake-engine';
import { CONFORMANCE_CHECKS, type ConformanceTarget } from './conformance';
import { CONTRACT_EXAMPLE_SAMPLES } from './fixtures/contract-examples';
import { FAKE_ENGINE_SAMPLES } from './fixtures/fake-engine';
import { createMotTestEngine, MOT_TEST_SAMPLES } from './fixtures/mot-engine';
import { createReferenceEngine } from './support/reference-engine';

/**
 * Moteurs soumis à la suite de conformité. Chaque moteur fournit ses échantillons.
 * - Faux moteur de l'extension (P2.9) : src/content/fake-engine.ts, échantillons dans fixtures/fake-engine.ts.
 * - Vrai moteur (MOT6) : moteur MOT chargé avec une bibliothèque et un dictionnaire de test (fixtures/mot-engine.ts).
 */
const TARGETS: readonly ConformanceTarget[] = [
  { name: 'moteur de référence (table de test, contrat §12)', createEngine: createReferenceEngine, samples: CONTRACT_EXAMPLE_SAMPLES },
  { name: 'moteur FinEthnic MOT (données de test)', createEngine: createMotTestEngine, samples: MOT_TEST_SAMPLES },
  { name: 'faux moteur de l’extension (P2.9)', createEngine: () => createFakeEngine(), samples: FAKE_ENGINE_SAMPLES },
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
