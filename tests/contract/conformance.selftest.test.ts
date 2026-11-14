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

  it('T-CON-02 : une traduction non vérifiée transmise dans output au lieu de unverifiedOutput (I3)', () => {
    const leaky = engineWith((req) => {
      const r = translateWithTable(req);
      return r.status === 'PENDING_VALIDATION' ? { ...r, output: r.unverifiedOutput } : r;
    });
    expect(failingChecks(leaky)).toContain('T-CON-02');
  });

  it('T-CON-02 : PENDING_VALIDATION sans unverifiedOutput (I3)', () => {
    const silent = engineWith((req) => {
      const r = translateWithTable(req);
      return r.status === 'PENDING_VALIDATION' ? { ...r, unverifiedOutput: null } : r;
    });
    expect(failingChecks(silent)).toContain('T-CON-02');
  });

  it('T-CON-02 : unverifiedOutput renseigné pour un autre statut (I3)', () => {
    const guesses = engineWith((req) => {
      const r = translateWithTable(req);
      return r.status === 'KNOWN_UNTRANSLATED' ? { ...r, unverifiedOutput: 'devinette' } : r;
    });
    expect(failingChecks(guesses)).toContain('T-CON-02');
  });

  it('T-CON-04 : des espaces de bord perdus dans unverifiedOutput (I4)', () => {
    const trims = engineWith((req) => {
      const r = translateWithTable(req);
      return r.unverifiedOutput === null ? r : { ...r, unverifiedOutput: r.unverifiedOutput.trim() };
    });
    expect(failingChecks(trims)).toEqual(['T-CON-04']);
  });

  it('T-CON-04 : un montant modifié dans unverifiedOutput (I5)', () => {
    const changesAmount = engineWith((req) => {
      const r = translateWithTable(req);
      return r.unverifiedOutput === null ? r : { ...r, unverifiedOutput: r.unverifiedOutput.replace('5 000', '50 000') };
    });
    expect(failingChecks(changesAmount)).toEqual(['T-CON-04']);
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

  it('T-CON-04 : une devise modifiée dans unverifiedOutput et retirée de protectedSegments (I5)', () => {
    const changesCurrency = engineWith((req) => {
      const r = translateWithTable(req);
      if (r.unverifiedOutput === null) return r;
      return {
        ...r,
        unverifiedOutput: r.unverifiedOutput.replace('FCFA', 'XAF'),
        protectedSegments: r.protectedSegments.filter((s) => s !== 'FCFA'),
      };
    });
    expect(failingChecks(changesCurrency)).toEqual(['T-CON-04']);
  });

  it('T-CON-04 : un cas de bord non vérifié qui n’est pas PENDING_VALIDATION est refusé', () => {
    const samples = { ...CONTRACT_EXAMPLE_SAMPLES, pendingEdge: CONTRACT_EXAMPLE_SAMPLES.edge };
    expect(failingChecks(engineWith(translateWithTable), samples)).toEqual(['T-CON-04']);
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

  it('T-CON-02 : un brouillon sans unverifiedKind, présenté comme complet par défaut (I3)', () => {
    const unlabeled = engineWith((req) => ({ ...translateWithTable(req), unverifiedKind: null }));
    expect(failingChecks(unlabeled)).toEqual(['T-CON-02']);
  });

  it('T-CON-02 : un texte composé approuvé ou rattaché à une entrée (I7)', () => {
    const approvesComposed = engineWith((req) => {
      const r = translateWithTable(req);
      return r.matchKind === 'composed' ? { ...r, entryId: 'P5-002' } : r;
    });
    expect(failingChecks(approvesComposed)).toEqual(['T-CON-02']);
  });

  it('T-CON-02 : keptFrench absent est accepté ; un terme gardé absent de unverifiedOutput est refusé (I12)', () => {
    const withKept = (kept: (r: TranslationResult) => string[]) => engineWith((req) => {
      const r = translateWithTable(req);
      return { ...r, keptFrench: kept(r) };
    });
    const firstWord = (r: TranslationResult): string[] => (r.unverifiedOutput ? [r.unverifiedOutput.trim().split(' ')[0] as string] : []);
    expect(failingChecks(withKept(firstWord))).toEqual([]);
    expect(failingChecks(withKept((r) => (r.unverifiedOutput ? ['mot de passe'] : [])))).toEqual(['T-CON-02']);
  });

  it('T-CON-02 : keptFrench renseigné hors PENDING_VALIDATION (I12)', () => {
    const leaky = engineWith((req) => {
      const r = translateWithTable(req);
      return r.status === 'APPROVED' ? { ...r, keptFrench: ['compte'] } : r;
    });
    expect(failingChecks(leaky)).toEqual(['T-CON-02']);
  });

  it('T-CON-01 et T-CON-02 : un statut déclaré jamais renvoyé', () => {
    const { AMBIGUOUS: _ambiguous, ...rest } = CONTRACT_EXAMPLE_SAMPLES.byStatus;
    const declared = { ...CONTRACT_EXAMPLE_SAMPLES, byStatus: { ...rest, AMBIGUOUS: [] }, neverReturned: { AMBIGUOUS: 'test' } };
    const noAmbiguous = (req: TranslationRequest): TranslationResult =>
      translateWithTable(req.text === 'Retour' ? { ...req, text: 'inconnu' } : req);
    expect(failingChecks(engineWith(noAmbiguous), declared)).toEqual([]);
    // Déclaration fausse : AMBIGUOUS sur une chaîne sonde.
    const liar = engineWith((req) => (req.text === '__proto__' ? translateWithTable({ ...req, text: 'Retour', sourceLang: 'fr' }) : noAmbiguous(req)));
    expect(failingChecks(liar, declared)).toEqual(['T-CON-02']);
    expect(failingChecks(engineWith(noAmbiguous), { ...declared, neverReturned: { APPROVED: 'test', AMBIGUOUS: 'test' } })).toContain('T-CON-01');
  });
});
