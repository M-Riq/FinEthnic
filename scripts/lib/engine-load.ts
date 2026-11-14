/**
 * Chargement des ressources du moteur pour les scripts et l'API locale (MOT5).
 * D8 et l'extrait de Lefff sont versionnés ; D7 est lu hors de Git (Q17).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractResources } from '../../src/engine/contract-engine';
import type { EngineResources } from '../../src/engine/engine';
import type { WrongSense } from '../../src/engine/select';
import { parseLexicon } from '../../src/engine/lexicon';
import { readLibraryEntries } from './data-files';
import { contractExtras, corpusEntries, criticalEntryIds, guardTexts } from './engine-corpus';
import { DICTIONARY_PATH, readD7Entries, readIgnoredWords } from './engine-d7';

export const LEXICON_PATH = 'data/language-resources/lefff/lefff-3.4-finethnic.mlex';
export const SENSE_REVIEW_PATH = 'data/language-resources/sense-review.json';

export class MissingDictionaryError extends Error {
  constructor() {
    super(`Dictionnaire D7 introuvable (${DICTIONARY_PATH}). Lancez d'abord : npm run import-dictionary`);
    this.name = 'MissingDictionaryError';
  }
}

/** Sens faux relevés (M18). Lève une erreur lisible si le fichier est mal formé ou cite une entrée inconnue de D8. */
export function readWrongSenses(root: string, knownIds: ReadonlySet<string>): WrongSense[] {
  const data = JSON.parse(readFileSync(join(root, SENSE_REVIEW_PATH), 'utf8')) as { wrongSenses?: unknown };
  if (!Array.isArray(data.wrongSenses)) throw new Error(`${SENSE_REVIEW_PATH} : « wrongSenses » doit être une liste`);
  return data.wrongSenses.map((w: Record<string, unknown>, i) => {
    for (const field of ['entryId', 'fr', 'eto', 'ref', 'reason'] as const) {
      if (typeof w[field] !== 'string' || (w[field] as string).trim() === '') {
        throw new Error(`${SENSE_REVIEW_PATH} : wrongSenses[${i}].${field} manquant`);
      }
    }
    if (!knownIds.has(w.entryId as string)) throw new Error(`${SENSE_REVIEW_PATH} : wrongSenses[${i}] : entrée de D8 inconnue ${String(w.entryId)}`);
    return { entryId: w.entryId, fr: w.fr, eto: w.eto, ref: w.ref, reason: w.reason } as WrongSense;
  });
}

export function loadEngineResources(root: string): EngineResources {
  return engineResources(root, readLibraryEntries(root).entries);
}

/** Ressources du moteur derrière le contrat (MOT6) : celles du moteur, plus les données propres au contrat. */
export function loadContractResources(root: string): ContractResources {
  const { entries } = readLibraryEntries(root);
  return { ...engineResources(root, entries), ...contractExtras(entries) };
}

function engineResources(root: string, entries: Parameters<typeof corpusEntries>[0]): EngineResources {
  const d7 = readD7Entries(root);
  if (d7 === null) throw new MissingDictionaryError();
  const corpus = corpusEntries(entries);
  return {
    corpus,
    guards: guardTexts(entries),
    lexicon: parseLexicon(readFileSync(join(root, LEXICON_PATH), 'utf8')),
    d7,
    ignored: readIgnoredWords(root),
    critical: criticalEntryIds(entries),
    wrongSenses: readWrongSenses(root, new Set(corpus.map((e) => e.id))),
  };
}
