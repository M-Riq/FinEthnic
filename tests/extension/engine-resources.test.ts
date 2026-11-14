import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviveResources, serializeResources } from '../../src/content/engine-resources';
import { createContractEngine, type ContractResources } from '../../src/engine/contract-engine';
import { parseLexicon } from '../../src/engine/lexicon';
import type { TranslationRequest } from '../../src/language/contract';
import { detectProtected } from '../../src/protection/patterns';
import { DICTIONARY_PATH } from '../../scripts/lib/engine-d7';
import { LEXICON_PATH, loadContractResources } from '../../scripts/lib/engine-load';

const ROOT = path.join(import.meta.dirname, '../..');
const LEXICON = 'envoyer\tv\tenvoyer\tW\nEnvoie\tv\tenvoyer\tP13s\n';

const tiny = (): ContractResources => ({
  corpus: [],
  guards: ['FCFA'],
  lexicon: parseLexicon(LEXICON),
  d7: [{ fr: 'envoyer', eto: 'lóm', category: 'VERBE', gloss: 'envoyer', ref: 'D7 p. 1' }],
  ignored: [],
  critical: [],
  approved: new Map([['VOC-001', 'táŋ']]),
  rejected: new Set(['VOC-002']),
});

describe('ressources du moteur embarquées (BM7)', () => {
  it('rend à l’identique les listes, les Map et les Set, et relit le lexique comme parseLexicon', () => {
    const original = tiny();
    const revived = reviveResources(serializeResources(original, LEXICON));
    const { lexicon, ...rest } = revived;
    const { lexicon: originalLexicon, ...originalRest } = original;
    expect(rest).toEqual(originalRest);
    expect(revived.approved).toBeInstanceOf(Map);
    expect(revived.rejected).toBeInstanceOf(Set);
    expect(lexicon.size).toBe(originalLexicon.size);
    expect(lexicon.lookup('envoie')).toEqual(originalLexicon.lookup('envoie'));
  });

  it('refuse une ressource qui ne survivrait pas à JSON', () => {
    const withFunction = { ...tiny(), critical: [() => 'x'] } as unknown as ContractResources;
    expect(() => serializeResources(withFunction, LEXICON)).toThrow('non sérialisable');
    const withHole = { ...tiny(), critical: [undefined] } as unknown as ContractResources;
    expect(() => serializeResources(withHole, LEXICON)).toThrow('undefined');
  });

  it.skipIf(!existsSync(path.join(ROOT, DICTIONARY_PATH)))(
    'donne exactement les résultats du moteur des scripts sur tous les textes de D8 (D7 importé)',
    () => {
      const resources = loadContractResources(ROOT);
      const lexiconText = readFileSync(path.join(ROOT, LEXICON_PATH), 'utf8');
      const reference = createContractEngine(resources, { detectProtected });
      const embedded = createContractEngine(reviveResources(serializeResources(resources, lexiconText)), { detectProtected });
      const requests: TranslationRequest[] = resources.corpus.flatMap((e) =>
        [e.text, ...e.synonyms].map((text) => ({ text, sourceLang: 'fr', targetLang: 'eto' }) as TranslationRequest),
      );
      expect(requests.length).toBeGreaterThan(375);
      expect(embedded.info()).toEqual(reference.info());
      expect(embedded.translateMany(requests)).toEqual(reference.translateMany(requests));
    },
  );
});
