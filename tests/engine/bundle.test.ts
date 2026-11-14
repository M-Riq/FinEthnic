import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportEngineData } from '../../scripts/export-engine-data';
import { D7_JSON_PATH } from '../../scripts/lib/engine-d7';
import { LEXICON_PATH, loadContractResources } from '../../scripts/lib/engine-load';
import { engineFromBundle, serializeBundle } from '../../src/engine/bundle';
import { createContractEngine } from '../../src/engine/contract-engine';
import type { TranslationRequest } from '../../src/language/contract';
import { MOT_TEST_RESOURCES } from '../contract/fixtures/mot-engine';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const req = (text: string): TranslationRequest => ({ text, sourceLang: 'fr', targetLang: 'eto' });

describe('createContractEngine — entrées enrichies (extend)', () => {
  it('un texte nouveau se traduit par les synonymes de son entrée enrichie ; les statistiques ne changent pas', () => {
    const engine = createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0 });
    const before = engine.info();
    expect(engine.translate(req('Tarif')).status).toBe('NO_MATCH');
    engine.extend([{ id: 'ENR-0001', text: 'Tarif', synonyms: ['somme'], definition: null }]);
    expect(engine.translate(req('Tarif'))).toMatchObject({
      status: 'PENDING_VALIDATION', unverifiedKind: 'complete', unverifiedOutput: '⟦TEST:somme⟧', entryId: 'ENR-0001', matchKind: 'exact',
    });
    expect(engine.info()).toEqual(before);
  });
});

describe('paquet du moteur embarqué (bundle)', () => {
  it('le moteur recréé donne les mêmes résultats et les statistiques fournies, sans les recalculer', () => {
    const original = createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0 });
    const json = serializeBundle(MOT_TEST_RESOURCES, original.info());
    const { engine, resources } = engineFromBundle(json, readFileSync(join(ROOT, LEXICON_PATH), 'utf8'), { cacheSize: 0 });
    expect(engine.info()).toEqual(original.info());
    expect(resources.approved).toEqual(MOT_TEST_RESOURCES.approved);
    expect(resources.rejected).toEqual(MOT_TEST_RESOURCES.rejected);
    for (const text of ['Frais de transfert', 'Montant', 'Montant à envoyer', 'Compter', 'Safinum Pay', 'Total : 5 000 FCFA', 'Bonjour']) {
      expect(engine.translate(req(text)), text).toEqual(original.translate(req(text)));
    }
  });

  it('refuse un paquet d’un autre format', () => {
    expect(() => engineFromBundle('{"format":2,"resources":{},"library":{}}', '')).toThrow(/format 2/u);
  });

  it.skipIf(!existsSync(join(ROOT, D7_JSON_PATH)))('ressources réelles : les fichiers exportés recréent le même moteur', () => {
    const dir = mkdtempSync(join(tmpdir(), 'finethnic-'));
    try {
      const files = exportEngineData(ROOT, dir);
      const { engine } = engineFromBundle(readFileSync(files.resources, 'utf8'), readFileSync(files.lefff, 'utf8'), { cacheSize: 0 });
      const resources = loadContractResources(ROOT);
      const original = createContractEngine(resources, { cacheSize: 0 });
      const differences = resources.corpus
        .filter((e) => JSON.stringify(engine.translate(req(e.text))) !== JSON.stringify(original.translate(req(e.text))))
        .map((e) => e.id);
      expect(differences).toEqual([]);
      expect(engine.info()).toEqual(original.info());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
