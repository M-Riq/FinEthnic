/**
 * Passage des ressources de langue au moteur (src/engine/d7.ts, src/engine/eton.ts).
 *
 * D7 reste hors de Git (Q17) : le dictionnaire est lu dans data/language-resources/raw/dictionary.json,
 * produit par `npm run import-dictionary`. Les mots ignorés viennent de grammar-rules.json (règle
 * validée en BM3.6), comme les partitifs supprimés après un verbe (M21).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { D7Entry } from '../../src/engine/d7';
import type { IgnoredWords, Partitive } from '../../src/engine/eton';
import type { Dictionary } from './cascade';

export const DICTIONARY_PATH = 'data/language-resources/raw/dictionary.json';
export const GRAMMAR_RULES_PATH = 'data/language-resources/grammar-rules.json';

/** Entrées de D7, ou null si le dictionnaire n'a pas été importé. */
export function readD7Entries(root: string): D7Entry[] | null {
  const path = join(root, DICTIONARY_PATH);
  if (!existsSync(path)) return null;
  const dictionary = JSON.parse(readFileSync(path, 'utf8')) as Dictionary;
  return dictionary.entries.map(({ fr, eto, category, gloss, ref }) => ({ fr, eto, category, gloss, ref }));
}

interface GrammarRulesFile {
  ignoredWords?: { words: string[]; ref: string }[];
  partitives?: unknown;
}

export function readIgnoredWords(root: string): IgnoredWords[] {
  const data = JSON.parse(readFileSync(join(root, GRAMMAR_RULES_PATH), 'utf8')) as GrammarRulesFile;
  return (data.ignoredWords ?? []).map((g, i) => ({ id: `D7-MOTS-IGNORES-${i + 1}`, words: g.words, ref: g.ref }));
}

/** Partitifs supprimés après un verbe (M21). Lève une erreur lisible si la section est mal formée. */
export function readPartitives(root: string): Partitive[] {
  const data = JSON.parse(readFileSync(join(root, GRAMMAR_RULES_PATH), 'utf8')) as GrammarRulesFile;
  const list = data.partitives ?? [];
  if (!Array.isArray(list)) throw new Error(`${GRAMMAR_RULES_PATH} : « partitives » doit être une liste`);
  return list.map((p: Record<string, unknown>, i) => {
    const where = `${GRAMMAR_RULES_PATH} : partitives[${i}]`;
    if (typeof p.id !== 'string' || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(p.id)) throw new Error(`${where}.id invalide`);
    if (typeof p.ref !== 'string' || p.ref.trim() === '') throw new Error(`${where}.ref manquant`);
    const nouns = p.nouns;
    if (!Array.isArray(nouns) || nouns.length === 0 || nouns.some((n) => typeof n !== 'string' || !/^[\p{Ll}]+$/u.test(n))) {
      throw new Error(`${where}.nouns : liste de noms en minuscules, un mot chacun`);
    }
    if (new Set(nouns).size !== nouns.length) throw new Error(`${where}.nouns : doublon`);
    return { id: p.id, nouns: nouns as string[], ref: p.ref };
  });
}
