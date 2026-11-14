/**
 * Passage des ressources de langue au moteur (src/engine/d7.ts, src/engine/eton.ts).
 *
 * D7 est lu dans sa conversion JSON versionnée (data/language-resources/d7/d7.json, `npm run convert-d7`,
 * Q17 révisée le 2026-11-14) ; à défaut, dans l'ancien import hors Git raw/dictionary.json. Les deux donnent
 * les mêmes entrées (même découpage des clés françaises, buildD7Dictionary). Les mots ignorés viennent de
 * grammar-rules.json (règle validée en BM3.6), comme les partitifs supprimés après un verbe (M21), les
 * connectifs (M26) et les possessifs (M31).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { D7Entry } from '../../src/engine/d7';
import type { AdjectiveRule, Connective, IgnoredWords, Partitive, Possessive } from '../../src/engine/eton';
import type { Dictionary } from './cascade';
import { rowsFromJson, type D7Json } from './d7-convert';
import { buildD7Dictionary } from './d7-import';

export const D7_JSON_PATH = 'data/language-resources/d7/d7.json';
export const DICTIONARY_PATH = 'data/language-resources/raw/dictionary.json';
export const GRAMMAR_RULES_PATH = 'data/language-resources/grammar-rules.json';

/** Dictionnaire de la cascade construit depuis le JSON versionné de D7, ou null s'il est absent. */
export function readD7Dictionary(root: string): Dictionary | null {
  const path = join(root, D7_JSON_PATH);
  if (!existsSync(path)) return null;
  const json = JSON.parse(readFileSync(path, 'utf8')) as D7Json;
  return buildD7Dictionary(rowsFromJson(json), `D7 — ${json.source.title} (${json.source.authors.join(' & ')}, ${json.source.year}), ${D7_JSON_PATH}`).dictionary;
}

/** Entrées de D7, ou null si ni le JSON versionné ni l'import hors Git ne sont présents. */
export function readD7Entries(root: string): D7Entry[] | null {
  let dictionary = readD7Dictionary(root);
  if (!dictionary) {
    const path = join(root, DICTIONARY_PATH);
    if (!existsSync(path)) return null;
    dictionary = JSON.parse(readFileSync(path, 'utf8')) as Dictionary;
  }
  return dictionary.entries.map(({ fr, eto, category, gloss, ref, nounClass }) =>
    ({ fr, eto, category, gloss, ref, ...(nounClass ? { nounClass } : {}) }));
}

interface GrammarRulesFile {
  ignoredWords?: { words: string[]; ref: string }[];
  partitives?: unknown;
  connectives?: unknown;
  possessives?: unknown;
  adjectives?: unknown;
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

/** Connectifs « de » entre deux noms, par classe du premier nom (M26). Lève une erreur lisible si la section est mal formée. */
export function readConnectives(root: string): Connective[] {
  const data = JSON.parse(readFileSync(join(root, GRAMMAR_RULES_PATH), 'utf8')) as GrammarRulesFile;
  const list = data.connectives ?? [];
  if (!Array.isArray(list)) throw new Error(`${GRAMMAR_RULES_PATH} : « connectives » doit être une liste`);
  return list.map((c: Record<string, unknown>, i) => {
    const where = `${GRAMMAR_RULES_PATH} : connectives[${i}]`;
    if (typeof c.id !== 'string' || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(c.id)) throw new Error(`${where}.id invalide`);
    if (typeof c.ref !== 'string' || c.ref.trim() === '') throw new Error(`${where}.ref manquant`);
    const words = c.words;
    if (!Array.isArray(words) || words.length === 0 || words.some((w) => typeof w !== 'string' || !/^[\p{Ll}']+$/u.test(w))) {
      throw new Error(`${where}.words : liste de mots en minuscules`);
    }
    const forms = c.forms;
    if (typeof forms !== 'object' || forms === null || Array.isArray(forms) || Object.keys(forms).length === 0
      || Object.values(forms).some((f) => typeof f !== 'string' || f.trim() === '' || /\s/u.test(f))) {
      throw new Error(`${where}.forms : une forme éton (un mot) par classe nominale`);
    }
    return { id: c.id, words: words as string[], forms: { ...(forms as Record<string, string>) }, ref: c.ref };
  });
}

const CLASSES: ReadonlySet<string> = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

function classForms(value: unknown, where: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.entries(value).some(([c, f]) => !CLASSES.has(c) || typeof f !== 'string' || f.trim() === '' || /\s/u.test(f))) {
    throw new Error(`${where} : une forme éton (un mot) par classe nominale, de « 1 » à « 10 »`);
  }
  return { ...(value as Record<string, string>) };
}

/** Possessifs après le nom, par personne, classe du nom et ton final du nom (M31). Lève une erreur lisible si la section est mal formée. */
export function readPossessives(root: string): Possessive[] {
  const data = JSON.parse(readFileSync(join(root, GRAMMAR_RULES_PATH), 'utf8')) as GrammarRulesFile;
  const list = data.possessives ?? [];
  if (!Array.isArray(list)) throw new Error(`${GRAMMAR_RULES_PATH} : « possessives » doit être une liste`);
  return list.map((p: Record<string, unknown>, i) => {
    const where = `${GRAMMAR_RULES_PATH} : possessives[${i}]`;
    if (typeof p.id !== 'string' || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(p.id)) throw new Error(`${where}.id invalide`);
    if (typeof p.ref !== 'string' || p.ref.trim() === '') throw new Error(`${where}.ref manquant`);
    if (!Array.isArray(p.persons) || p.persons.length === 0) throw new Error(`${where}.persons : liste non vide`);
    const seen = new Set<string>();
    const persons = p.persons.map((x: Record<string, unknown>, k) => {
      const at = `${where}.persons[${k}]`;
      const words = x.words;
      if (!Array.isArray(words) || words.length === 0 || words.some((w) => typeof w !== 'string' || !/^\p{Ll}+$/u.test(w) || seen.has(w))) {
        throw new Error(`${at}.words : mots en minuscules, chacun dans une seule personne`);
      }
      for (const w of words as string[]) seen.add(w);
      return { words: words as string[], afterLow: classForms(x.afterLow, `${at}.afterLow`), afterHigh: classForms(x.afterHigh, `${at}.afterHigh`) };
    });
    return { id: p.id, persons, ref: p.ref };
  });
}

/** Noms adjectivaux en tête, suivis du connectif de leur classe (M33). Lève une erreur lisible si la section est mal formée. */
export function readAdjectives(root: string): AdjectiveRule[] {
  const data = JSON.parse(readFileSync(join(root, GRAMMAR_RULES_PATH), 'utf8')) as GrammarRulesFile;
  const list = data.adjectives ?? [];
  if (!Array.isArray(list)) throw new Error(`${GRAMMAR_RULES_PATH} : « adjectives » doit être une liste`);
  return list.map((a: Record<string, unknown>, i) => {
    const where = `${GRAMMAR_RULES_PATH} : adjectives[${i}]`;
    if (typeof a.id !== 'string' || !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(a.id)) throw new Error(`${where}.id invalide`);
    if (typeof a.ref !== 'string' || a.ref.trim() === '') throw new Error(`${where}.ref manquant`);
    const excluded = a.excluded ?? [];
    if (!Array.isArray(excluded) || excluded.some((x: Record<string, unknown>) => typeof x?.eto !== 'string' || /\s/u.test(x.eto) || x.eto === ''
      || typeof x.reason !== 'string' || x.reason.trim() === '')) {
      throw new Error(`${where}.excluded : liste de { eto (un mot), reason }`);
    }
    return { id: a.id, forms: classForms(a.forms, `${where}.forms`), excluded: excluded.map((x: { eto: string }) => x.eto.normalize('NFC')), ref: a.ref };
  });
}
