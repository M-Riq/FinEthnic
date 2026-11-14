/**
 * Chargement des ressources du moteur pour les scripts et l'API locale (MOT5).
 * D8 et l'extrait de Lefff sont versionnés ; D7 est lu hors de Git (Q17).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EngineResources } from '../../src/engine/engine';
import { parseLexicon } from '../../src/engine/lexicon';
import { readLibraryEntries } from './data-files';
import { corpusEntries, criticalEntryIds, guardTexts } from './engine-corpus';
import { DICTIONARY_PATH, readD7Entries, readIgnoredWords } from './engine-d7';

export const LEXICON_PATH = 'data/language-resources/lefff/lefff-3.4-finethnic.mlex';

export class MissingDictionaryError extends Error {
  constructor() {
    super(`Dictionnaire D7 introuvable (${DICTIONARY_PATH}). Lancez d'abord : npm run import-dictionary`);
    this.name = 'MissingDictionaryError';
  }
}

export function loadEngineResources(root: string): EngineResources {
  const d7 = readD7Entries(root);
  if (d7 === null) throw new MissingDictionaryError();
  const { entries } = readLibraryEntries(root);
  return {
    corpus: corpusEntries(entries),
    guards: guardTexts(entries),
    lexicon: parseLexicon(readFileSync(join(root, LEXICON_PATH), 'utf8')),
    d7,
    ignored: readIgnoredWords(root),
    critical: criticalEntryIds(entries),
  };
}
