import { readFileSync } from 'node:fs';
import { parseLexicon } from '../../src/engine/lexicon';

/** Extrait de Lefff versionné, chargé une fois par fichier de test. */
export const LEXICON_PATH = new URL('../../data/language-resources/lefff/lefff-3.4-finethnic.mlex', import.meta.url);
export const LEXICON = parseLexicon(readFileSync(LEXICON_PATH, 'utf8'));
