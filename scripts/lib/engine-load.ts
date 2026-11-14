/**
 * Chargement des ressources du moteur pour les scripts et l'API locale (MOT5).
 * D8 et l'extrait de Lefff sont versionnés ; D7 est lu hors de Git (Q17).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractResources } from '../../src/engine/contract-engine';
import type { CorpusEntry } from '../../src/engine/corpus';
import type { EngineResources } from '../../src/engine/engine';
import type { WrongSense } from '../../src/engine/select';
import { parseLexicon } from '../../src/engine/lexicon';
import { readLibraryEntries } from './data-files';
import { contractExtras, corpusEntries, criticalEntryIds, guardTexts } from './engine-corpus';
import { DICTIONARY_PATH, readConnectives, readD7Entries, readIgnoredWords, readPartitives } from './engine-d7';

export const LEXICON_PATH = 'data/language-resources/lefff/lefff-3.4-finethnic.mlex';
export const SENSE_REVIEW_PATH = 'data/language-resources/sense-review.json';
export const KEPT_FRENCH_PATH = 'data/language-resources/kept-french-terms.json';
export const SYNONYM_ADDITIONS_PATH = 'data/language-resources/d8-synonym-additions.json';

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

/** Termes français gardés dans la phrase éton (M20). Lève une erreur lisible si le fichier est mal formé. */
export function readKeptFrench(root: string): string[] {
  const data = JSON.parse(readFileSync(join(root, KEPT_FRENCH_PATH), 'utf8')) as { groups?: unknown; excluded?: unknown };
  if (!Array.isArray(data.groups)) throw new Error(`${KEPT_FRENCH_PATH} : « groups » doit être une liste`);
  const excluded = new Set((Array.isArray(data.excluded) ? data.excluded : [])
    .map((x: { fr?: unknown }) => (typeof x.fr === 'string' ? x.fr.toLocaleLowerCase('fr') : '')));
  const seen = new Set<string>();
  const out: string[] = [];
  data.groups.forEach((g: { terms?: unknown }, i) => {
    if (!Array.isArray(g.terms)) throw new Error(`${KEPT_FRENCH_PATH} : groups[${i}].terms doit être une liste`);
    for (const t of g.terms as unknown[]) {
      if (typeof t !== 'string' || t.trim() === '') throw new Error(`${KEPT_FRENCH_PATH} : groups[${i}] : terme vide`);
      const key = t.trim().toLocaleLowerCase('fr');
      if (seen.has(key)) throw new Error(`${KEPT_FRENCH_PATH} : terme en double « ${t} »`);
      if (excluded.has(key)) throw new Error(`${KEPT_FRENCH_PATH} : « ${t} » est à la fois gardé et exclu`);
      seen.add(key);
      out.push(t.trim());
    }
  });
  return out;
}

/**
 * Synonymes validés ajoutés à D8 (M22), placés après ceux de D8. Lève une erreur lisible si un champ manque,
 * si l'entrée est inconnue, si son texte ne correspond plus à D8 ou si le synonyme est déjà connu.
 */
export function withSynonymAdditions(root: string, corpus: readonly CorpusEntry[]): CorpusEntry[] {
  const data = JSON.parse(readFileSync(join(root, SYNONYM_ADDITIONS_PATH), 'utf8')) as { additions?: unknown };
  if (!Array.isArray(data.additions)) throw new Error(`${SYNONYM_ADDITIONS_PATH} : « additions » doit être une liste`);
  const byId = new Map(corpus.map((e) => [e.id, { ...e, synonyms: [...e.synonyms] }]));
  const key = (t: string): string => t.trim().toLocaleLowerCase('fr');
  data.additions.forEach((a: Record<string, unknown>, i) => {
    for (const field of ['entryId', 'text', 'synonym', 'reason', 'ref', 'decidedBy', 'date'] as const) {
      if (typeof a[field] !== 'string' || (a[field] as string).trim() === '') {
        throw new Error(`${SYNONYM_ADDITIONS_PATH} : additions[${i}].${field} manquant`);
      }
    }
    const e = byId.get(a.entryId as string);
    if (e === undefined) throw new Error(`${SYNONYM_ADDITIONS_PATH} : additions[${i}] : entrée de D8 inconnue ${String(a.entryId)}`);
    if (e.text !== a.text) throw new Error(`${SYNONYM_ADDITIONS_PATH} : additions[${i}] : le texte de ${e.id} est « ${e.text} » dans D8`);
    const synonym = (a.synonym as string).trim();
    if (e.synonyms.some((x) => key(x) === key(synonym))) throw new Error(`${SYNONYM_ADDITIONS_PATH} : additions[${i}] : « ${synonym} » est déjà un synonyme de ${e.id}`);
    e.synonyms.push(synonym);
  });
  return corpus.map((e) => byId.get(e.id) as CorpusEntry);
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
  const corpus = withSynonymAdditions(root, corpusEntries(entries));
  return {
    corpus,
    guards: guardTexts(entries),
    lexicon: parseLexicon(readFileSync(join(root, LEXICON_PATH), 'utf8')),
    d7,
    ignored: readIgnoredWords(root),
    partitives: readPartitives(root),
    connectives: readConnectives(root),
    critical: criticalEntryIds(entries),
    wrongSenses: readWrongSenses(root, new Set(corpus.map((e) => e.id))),
    keptFrench: readKeptFrench(root),
  };
}
