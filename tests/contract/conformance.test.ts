import { describe, expect, it } from 'vitest';
import { CONFORMANCE_CHECKS, type ConformanceTarget } from './conformance';
import { CONTRACT_EXAMPLE_SAMPLES } from './fixtures/contract-examples';
import { createReferenceEngine } from './support/reference-engine';

/**
 * Moteurs soumis à la suite de conformité. Chaque moteur fournit ses échantillons.
 * - P2.9 (Yvan) : ajouter le faux moteur (src/content/fake-engine.ts) avec ses propres échantillons.
 * - BM5 (responsable) : ajouter le vrai moteur, chargé avec tests/language/fixtures/test-lexicon.json,
 *   avec CONTRACT_EXAMPLE_SAMPLES.
 */
const TARGETS: readonly ConformanceTarget[] = [
  { name: 'moteur de référence (table de test, contrat §12)', createEngine: createReferenceEngine, samples: CONTRACT_EXAMPLE_SAMPLES },
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
  it.todo('moteur FinEthnic (BM5)');
});
