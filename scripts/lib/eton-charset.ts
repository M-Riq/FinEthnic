/**
 * Contrôles de caractères (PROJECT_CONTEXT §3.7.4-4, tests T-LIB-07, T-DIC-01 et T-DIC-02).
 *
 * But : détecter les erreurs d'encodage et d'extraction, pas l'orthographe.
 * La liste blanche est PROVISOIRE : elle sera confirmée avec D7 et les locutrices (Q17).
 */

/** Lettres de base : alphabet latin complet + lettres spéciales de l'alphabet général des langues camerounaises. */
const BASE_LETTERS = new Set<string>([
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'ɛ', 'Ɛ', // U+025B, U+0190
  'ɔ', 'Ɔ', // U+0254, U+0186
  'ŋ', 'Ŋ', // U+014B, U+014A
  'ə', 'Ə', 'Ǝ', // U+0259, U+018F, U+018E
]);

/** Marques de ton autorisées (après décomposition NFD). */
const TONE_MARKS = new Set<string>([
  '\u0300', // grave
  '\u0301', // aigu
  '\u0302', // circonflexe
  '\u030C', // caron
  '\u0304', // macron
]);

const OTHER_ALLOWED = new Set<string>([
  ...'0123456789',
  ' ', '\u00A0', '\u202F', // espace, espaces insécables
  "'", '\u2019', '-', '.', ',', ';', ':', '!', '?', '«', '»', '(', ')', '"', '\u2026', '/',
]);

/** Confusions fréquentes, avec la correction suggérée. */
const KNOWN_CONFUSIONS = new Map<string, string>([
  ['\u03B5', 'ε grec (U+03B5) : utiliser ɛ (U+025B)'],
  ['\u0395', 'Ε grec (U+0395) : utiliser Ɛ (U+0190)'],
  ['\u03BF', 'ο grec (U+03BF) : utiliser o ou ɔ (U+0254)'],
  ['\u0275', 'ɵ (U+0275) : utiliser ɔ (U+0254) ?'],
  ['\uFFFD', 'caractère de remplacement (U+FFFD) : texte mal extrait'],
]);

/**
 * Séquences typiques d'un texte UTF-8 relu comme Latin-1 ou Windows-1252 :
 * « Ã© » pour « é », « Ã‰ » pour « É », « Ã‡ » pour « Ç », « Å“ » pour « œ », « Â« » pour « « », « â€™ » pour « ’ », « â‚¬ » pour « € ».
 * Les caractères après Ã, Â ou Å sont ceux des octets 0x80–0xBF en Latin-1 et en Windows-1252.
 */
const CP1252_HIGH = '\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122';
const MOJIBAKE = new RegExp(`[ÂÃ][\u0080-\u00BF${CP1252_HIGH}]|Å[\u0080-\u009F\u00B8${CP1252_HIGH}]|â[€‚]`, 'u');

/** Variables {nom} et marqueurs de test ⟦TEST⟧ / ⟦TEST:id⟧, ignorés par la liste blanche. */
const PLACEHOLDER = /\{[^{}]*\}/gu;
const TEST_MARKER = /⟦TEST(?::[^⟧]*)?⟧/gu;

const codePoint = (ch: string): string =>
  `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Problèmes valables pour tout texte (français, anglais ou Éton). */
export function checkTextEncoding(text: string): string[] {
  const issues: string[] = [];
  if (text.normalize('NFC') !== text) issues.push('texte non normalisé en NFC');
  if (text.includes('\uFFFD')) issues.push(KNOWN_CONFUSIONS.get('\uFFFD') as string);
  if (MOJIBAKE.test(text)) issues.push('séquence de mojibake (ex. « Ã© » au lieu de « é »)');
  return issues;
}

/** Problèmes propres à un texte Éton : caractères hors de la liste blanche. */
export function checkEtonCharacters(text: string): string[] {
  const issues = new Set<string>();
  const stripped = text.replace(PLACEHOLDER, ' ').replace(TEST_MARKER, ' ');
  // Chaque caractère est décomposé (NFD) pour contrôler séparément la lettre et ses tons,
  // mais le message cite le caractère tel qu'il est écrit (ex. « ç » plutôt que sa cédille seule).
  for (const ch of stripped.normalize('NFC')) {
    const allowed = [...ch.normalize('NFD')].every((p) => BASE_LETTERS.has(p) || TONE_MARKS.has(p) || OTHER_ALLOWED.has(p));
    if (!allowed) issues.add(KNOWN_CONFUSIONS.get(ch) ?? `caractère non autorisé pour l'Éton : ${codePoint(ch)} « ${ch} »`);
  }
  return [...issues];
}

/** Variables {nom} d'un texte, dans l'ordre d'apparition. */
export function extractVariables(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[0].slice(1, -1));
}
