import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLexicon } from '../../src/engine/lexicon';

/** Extrait de Lefff versionné, chargé une fois par fichier de test (chemin texte : lisible aussi sous jsdom). */
export const LEXICON_PATH = join(import.meta.dirname, '../../data/language-resources/lefff/lefff-3.4-finethnic.mlex');
export const LEXICON = parseLexicon(readFileSync(LEXICON_PATH, 'utf8'));
