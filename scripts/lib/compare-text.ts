/**
 * Normalisation servant UNIQUEMENT à comparer deux textes français (import, rapport de doublons).
 * Elle ne réécrit jamais une source : casse, espaces (dont U+00A0 et U+202F), apostrophes et
 * ponctuation finale sont neutralisés, les accents sont conservés (PROJECT_CONTEXT §3.3, ROADMAP §8.1).
 */
export function comparisonKey(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\s\u00A0\u202F]+/gu, ' ')
    .replace(/[’ʼ]/gu, "'")
    .trim()
    .replace(/[\s.:;!?…]+$/u, '')
    .toLocaleLowerCase('fr');
}

/** Mots d'un texte (lettres, chiffres, apostrophes internes), après normalisation de comparaison. */
export function words(text: string): string[] {
  return comparisonKey(text).match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
}

/** Découpe un texte en phrases (après . ! ? ou …), sans rien perdre : `parts.join(' ')` redonne le texte. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s(?=\S)/u);
}

/** Vrai si `token` apparaît comme mot entier dans `text` (pas comme morceau d'un autre mot, ni suivi d'un diacritique). */
export function containsWord(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, 'u').test(text);
}

/** Libellé d'un gabarit « Libellé : {variable}… » (ex. « Total débité » pour MSG-038), sinon null. */
export function templateLabel(text: string): string | null {
  return /^(.+?) : \{/u.exec(text)?.[1] ?? null;
}
