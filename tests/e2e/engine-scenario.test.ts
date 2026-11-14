import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkCase, loadScenario, scenarioRequest } from '../../scripts/lib/e2e-scenario';
import { DICTIONARY_PATH } from '../../scripts/lib/engine-d7';
import { loadContractResources } from '../../scripts/lib/engine-load';
import { createContractEngine } from '../../src/engine/contract-engine';
import { checkResultShape } from '../contract/conformance';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const scenario = loadScenario(ROOT);

describe('scénario de bout en bout : les cas sont valides', () => {
  it('identifiants uniques, au moins un cas par statut attendu par l\'extension', () => {
    expect(new Set(scenario.cases.map((c) => c.id)).size).toBe(scenario.cases.length);
    expect(new Set(scenario.cases.map((c) => c.expect.status))).toEqual(
      new Set(['PENDING_VALIDATION', 'KNOWN_UNTRANSLATED', 'PROTECTED', 'NO_MATCH']),
    );
  });
});

describe.skipIf(!existsSync(join(ROOT, DICTIONARY_PATH)))('scénario de bout en bout — D8 et D7 réels', () => {
  const engine = createContractEngine(loadContractResources(ROOT), { cacheSize: 0 });
  it.each(scenario.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const request = scenarioRequest(c);
    const result = engine.translate(request);
    expect(checkResultShape(request, result)).toEqual([]);
    expect(checkCase(c, result)).toEqual([]);
  });
});
