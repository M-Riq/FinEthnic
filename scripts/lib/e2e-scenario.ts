/**
 * Scénario de bout en bout extension ↔ moteur (docs/tests/E2E-extension-moteur.md).
 *
 * Les cas et les résultats attendus sont dans tests/e2e/engine-scenario.json. Ce module construit les
 * requêtes du contrat et compare les résultats reçus aux champs attendus (un champ absent de `expect`
 * n'est pas vérifié). Il sert au script `npm run e2e-check` (API locale) et au test vitest (en mémoire).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TranslationRequest, TranslationResult } from '../../src/language/contract';

export const SCENARIO_PATH = 'tests/e2e/engine-scenario.json';

export interface ScenarioCase {
  id: string;
  text: string;
  /** Le texte est répété `repeat` fois (textes trop longs). */
  repeat?: number;
  sourceLang?: TranslationRequest['sourceLang'];
  expect: Partial<TranslationResult>;
  /** Ce que l'extension doit afficher (§5.4 du contrat). */
  display: string;
}

export interface Scenario {
  contractVersion: string;
  cases: ScenarioCase[];
}

export function loadScenario(root: string): Scenario {
  return JSON.parse(readFileSync(join(root, SCENARIO_PATH), 'utf8')) as Scenario;
}

export function scenarioRequest(c: ScenarioCase): TranslationRequest {
  return { text: c.text.repeat(c.repeat ?? 1), sourceLang: c.sourceLang ?? 'fr', targetLang: 'eto' };
}

/** Écarts entre le résultat reçu et les champs attendus, en clair ; [] si tout correspond. */
export function checkCase(c: ScenarioCase, result: TranslationResult): string[] {
  return Object.entries(c.expect).flatMap(([field, want]) => {
    const raw = (result as unknown as Record<string, unknown>)[field];
    // keptFrench est facultatif : absent vaut [] (contrat §5, I12).
    const got = field === 'keptFrench' && raw === undefined ? [] : raw;
    return JSON.stringify(got) === JSON.stringify(want)
      ? []
      : [`${field} : attendu ${JSON.stringify(want)}, reçu ${JSON.stringify(got)}`];
  });
}
