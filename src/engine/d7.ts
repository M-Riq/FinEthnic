/**
 * Index du dictionnaire D7 (Français → Éton) pour le moteur (MOT4).
 *
 * D7 est une œuvre publiée, gardée hors de Git (Q17) : l'appelant fournit ses entrées (produites par
 * `npm run import-dictionary` dans data/language-resources/raw/). Ce module ne contient aucune forme
 * éton.
 *
 * Choix entre plusieurs formes (M6) : d'abord une catégorie de D7 qui correspond à la catégorie du mot
 * français, puis la forme la plus courte, puis l'ordre de D7. Les autres formes sont rendues comme
 * alternatives, avec leur référence.
 *
 * Module pur, sans dépendance à Node.
 */
import { normalize } from './normalize';

/** Entrée de D7 telle que produite par l'import (scripts/lib/d7-import.ts). */
export interface D7Entry {
  /** Clé française (« envoyer », « pour rien »). */
  fr: string;
  /** Forme éton de citation, telle que dans D7. */
  eto: string;
  /** NOM, VERBE, ADJ, AUX, ADV, PREP, PRON, NUM, IDEO, INTERJ, SUB, PART. */
  category: string;
  /** Traduction française complète de l'entrée. */
  gloss: string;
  /** « D7 p. 238 (lexique n° 2716) ». */
  ref: string;
}

export interface D7Index {
  readonly size: number;
  readonly maxWords: number;
  /** Entrées d'une clé (mots séparés par une espace, minuscules, apostrophe droite). */
  get(key: string): readonly D7Entry[];
}

export interface D7Choice {
  entry: D7Entry;
  alternatives: D7Entry[];
}

/** Clé d'un texte français : mots du découpage du moteur, séparés par une espace. */
export function frenchKey(text: string): string {
  return normalize(text).tokens.map((t) => t.key).join(' ');
}

export function buildD7Index(entries: readonly D7Entry[]): D7Index {
  const byKey = new Map<string, D7Entry[]>();
  let maxWords = 1;
  for (const entry of entries) {
    const key = frenchKey(entry.fr);
    if (key === '') continue;
    const list = byKey.get(key) ?? [];
    if (!list.some((e) => e.eto === entry.eto && e.category === entry.category)) list.push(entry);
    byKey.set(key, list);
    maxWords = Math.max(maxWords, key.split(' ').length);
  }
  return { size: byKey.size, maxWords, get: (key) => byKey.get(key) ?? [] };
}

/**
 * Forme liée (« -áŋ » combien, « -pə̀ » quel) : un radical qui exige un préfixe d'accord que D7 ne
 * documente pas. Elle n'est jamais écrite seule.
 */
export const isBoundForm = (eto: string): boolean => /^-|-$/u.test(eto.trim());

/** Choix déterministe (M6) parmi les entrées d'une clé. `preferred` : catégories D7 attendues. */
export function chooseEntry(entries: readonly D7Entry[], preferred: ReadonlySet<string>): D7Choice | null {
  if (entries.length === 0) return null;
  const ranked = entries
    .map((entry, order) => ({ entry, order }))
    .sort((a, b) =>
      Number(preferred.has(b.entry.category)) - Number(preferred.has(a.entry.category))
      || Number(isBoundForm(a.entry.eto)) - Number(isBoundForm(b.entry.eto))
      || [...a.entry.eto].length - [...b.entry.eto].length
      || a.order - b.order)
    .map((r) => r.entry);
  return { entry: ranked[0] as D7Entry, alternatives: ranked.slice(1) };
}

export interface D7Sense {
  /** Nombre de sens numérotés de l'entrée (« 1) signe, preuve 2) symbole » : 2). */
  senses: number;
  /** Précision entre parenthèses qui suit le mot dans la glose (« langue (organe) » : « organe »). */
  qualifier: string | null;
}

/**
 * Sens d'une entrée pour une clé française. D7 regroupe plusieurs sens par entrée : le moteur ne peut
 * pas vérifier lequel correspond au texte, il le signale.
 */
export function senseOf(entry: D7Entry, key: string): D7Sense {
  const gloss = entry.gloss.replace(/[’‘]/gu, "'");
  const senses = Math.max(1, (gloss.match(/(?:^|\s)\d+\)/gu) ?? []).length);
  const lower = gloss.toLocaleLowerCase('fr');
  const at = lower.indexOf(key);
  const after = at < 0 ? '' : gloss.slice(at + key.length);
  const qualifier = /^\s*\(([^)]*)\)/u.exec(after)?.[1]?.trim() ?? null;
  return { senses, qualifier };
}
