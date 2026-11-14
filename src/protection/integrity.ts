/**
 * Intégrité des valeurs protégées (P3.5) : défense en profondeur, en plus du contrôle I5 du moteur.
 *
 * - `checkIntegrity` : avant chaque écriture, les valeurs protégées du texte d'origine doivent se retrouver,
 *   octet par octet et avec la même multiplicité, dans le texte à écrire ; sinon l'écriture est refusée.
 * - `fingerprint` : empreinte (hachage) des valeurs protégées d'un ensemble de textes, indépendante de leur
 *   ordre : sert à comparer une page avant traduction, traduite et restaurée (tests de P5).
 *
 * Pur : aucune dépendance au DOM ni à `chrome.*`. Les résultats ne contiennent jamais de texte de la page.
 */
import type { ProtectedDetector } from '../language/contract';
import { detectProtected } from './patterns';

/** Raison d'un refus (sans aucun texte de la page). */
export type IntegrityFailure =
  /** Le multiensemble des valeurs protégées diffère entre l'original et le texte à écrire. */
  | 'protected-changed'
  /** Un segment signalé par le moteur (`protectedSegments`) manque dans le texte à écrire (I5). */
  | 'engine-segment-missing'
  /** Un segment signalé par le moteur ne figure pas dans le texte d'origine : résultat incohérent (P5.8). */
  | 'engine-segment-unknown'
  /** Les chiffres diffèrent (I5 : même multiensemble de chiffres). */
  | 'digits-changed';

/** Hachage non cryptographique 53 bits (cyrb53), en hexadécimal : sert d'empreinte en mémoire seulement. */
export function hashText(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const sorted = (values: Iterable<string>): string[] => [...values].sort();

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i]);

const digitsOf = (text: string): string[] => sorted(text.match(/\p{Nd}/gu) ?? []);

function occurrences(text: string, segment: string): number {
  let count = 0;
  for (let i = text.indexOf(segment); i >= 0; i = text.indexOf(segment, i + segment.length)) count++;
  return count;
}

/**
 * Vérifie qu'écrire `written` à la place de `source` ne modifie aucune valeur protégée.
 * `engineSegments` : `protectedSegments` renvoyé par le moteur pour `source`.
 * Renvoie `null` si l'écriture est sûre, sinon la raison du refus.
 */
export function checkIntegrity(
  source: string,
  written: string,
  engineSegments: readonly string[] = [],
  detect: ProtectedDetector = detectProtected,
): IntegrityFailure | null {
  if (!sameList(digitsOf(source), digitsOf(written))) return 'digits-changed';
  if (!sameList(sorted(detect(source)), sorted(detect(written)))) return 'protected-changed';
  const expected = new Map<string, number>();
  for (const segment of engineSegments) {
    if (typeof segment === 'string' && segment !== '') expected.set(segment, (expected.get(segment) ?? 0) + 1);
  }
  for (const [segment, count] of expected) {
    if (occurrences(source, segment) < count) return 'engine-segment-unknown';
    if (occurrences(written, segment) < count) return 'engine-segment-missing';
  }
  return null;
}

/**
 * Empreinte des valeurs protégées de `texts`, indépendante de leur ordre. Deux ensembles de textes qui
 * contiennent les mêmes valeurs protégées (même multiplicité) ont la même empreinte.
 */
export function fingerprint(texts: Iterable<string>, detect: ProtectedDetector = detectProtected): string {
  const tokens: string[] = [];
  for (const text of texts) tokens.push(...detect(text));
  return hashText(sorted(tokens).join('\u0000'));
}
