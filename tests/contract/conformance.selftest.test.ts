/**
 * Auto-tests de la suite : chaque moteur volontairement fautif doit être signalé par le bon contrôle.
 * Sans ces tests, une suite trop permissive passerait inaperçue (R13).
 */
import { describe, expect, it } from 'vitest';
import type { TranslationEngine, TranslationRequest, TranslationResult } from '../../src/language/contract';
import { checkConformance, type ConformanceSamples } from './conformance';
import { CONTRACT_EXAMPLE_SAMPLES } from './fixtures/contract-examples';
import { REFERENCE_INFO, translateWithTable } from './support/reference-engine';

function engineWith(
  translate: (req: TranslationRequest) => TranslationResult,
  info = REFERENCE_INFO,
): TranslationEngine {
  return { info: () => info, translate, translateMany: (reqs) => reqs.map(translate) };
}

function failingChecks(engine: TranslationEngine, samples: ConformanceSamples = CONTRACT_EXAMPLE_SAMPLES): string[] {
  return checkConformance({ name: 'fautif', createEngine: () => engine, samples })
    .filter((c) => c.violations.length > 0)
    .map((c) => c.id);
}

describe('la suite de conformité détecte les moteurs non conformes', () => {
  it('accepte le moteur de référence', () => {
    expect(failingChecks(engineWith(translateWithTable))).toEqual([]);
  });

  it('T-CON-02 : une proposition non approuvée transmise dans output (I3)', () => {
    const leaky = engineWith((req) => {
      const r = translateWithTable(req);
      return r.status === 'PENDING_VALIDATION' ? { ...r, output: 'proposition' } : r;
    });
    expect(failingChecks(leaky)).toContain('T-CON-02');
  });

  it('T-CON-03 : une exception sur un surrogate isolé (I2)', () => {
    const fragile = engineWith((req) => {
      if (/[\uD800-\uDFFF]/u.test(req.text)) throw new Error('surrogate');
      return translateWithTable(req);
    });
    expect(failingChecks(fragile)).toContain('T-CON-03');
  });

  it('T-CON-03 : un moteur qui retire les espaces avant de contrôler la longueur (I10)', () => {
    const trims = engineWith((req) => translateWithTable({ ...req, text: req.text.trim() }));
    expect(failingChecks(trims)).toContain('T-CON-03');
  });

  it('T-CON-04 : des espaces de bord perdus (I4)', () => {
    const trimsOutput = engineWith((req) => {
      const r = translateWithTable(req);
      return r.output === null ? r : { ...r, output: r.output.trim() };
    });
    expect(failingChecks(trimsOutput)).toContain('T-CON-04');
  });

  it('T-CON-04 : un montant modifié (I5)', () => {
    const changesAmount = engineWith((req) => {
      const r = translateWithTable(req);
      return r.output === null ? r : { ...r, output: r.output.replace(' 0 ', ' 10 ') };
    });
    expect(failingChecks(changesAmount)).toContain('T-CON-04');
  });

  it('T-CON-04 : une devise modifiée et retirée de protectedSegments (I5)', () => {
    const changesCurrency = engineWith((req) => {
      const r = translateWithTable(req);
      if (r.output === null) return r;
      return { ...r, output: r.output.replace('FCFA', 'XAF'), protectedSegments: r.protectedSegments.filter((s) => s !== 'FCFA') };
    });
    expect(failingChecks(changesCurrency)).toContain('T-CON-04');
  });

  it('T-CON-04 : une valeur protégée dupliquée (I5)', () => {
    const duplicates = engineWith((req) => {
      const r = translateWithTable(req);
      return r.output === null ? r : { ...r, output: r.output.replace('FCFA', 'FCFA FCFA') };
    });
    expect(failingChecks(duplicates)).toContain('T-CON-04');
  });

  it('T-CON-04 : un cas de bord sans espace final est refusé', () => {
    const { edge } = CONTRACT_EXAMPLE_SAMPLES;
    const samples = { ...CONTRACT_EXAMPLE_SAMPLES, edge: { ...edge, request: { ...edge.request, text: edge.request.text.trimEnd() } } };
    expect(failingChecks(engineWith(translateWithTable), samples)).toEqual(['T-CON-04']);
  });

  it('T-CON-05 : des résultats qui changent d’un appel à l’autre (I8)', () => {
    let calls = 0;
    const unstable = engineWith((req) => {
      const r = translateWithTable(req);
      calls += 1;
      return r.status === 'APPROVED' ? { ...r, entryId: `${r.entryId}-${calls}` } : r;
    });
    expect(failingChecks(unstable)).toContain('T-CON-05');
  });

  it('T-CON-05 : un moteur qui modifie la requête reçue', () => {
    const mutates = engineWith((req) => {
      (req as { text: string }).text = req.text.trim();
      return translateWithTable(req);
    });
    expect(failingChecks(mutates)).toContain('T-CON-05');
  });

  it('T-CON-07 : une version de contrat différente', () => {
    expect(failingChecks(engineWith(translateWithTable, { ...REFERENCE_INFO, contractVersion: '0.0.9' }))).toEqual(['T-CON-07']);
  });

  it('T-CON-01 : un statut sans échantillon', () => {
    const samples = { ...CONTRACT_EXAMPLE_SAMPLES, byStatus: { ...CONTRACT_EXAMPLE_SAMPLES.byStatus, AMBIGUOUS: [] } };
    expect(failingChecks(engineWith(translateWithTable), samples)).toContain('T-CON-01');
  });
});
