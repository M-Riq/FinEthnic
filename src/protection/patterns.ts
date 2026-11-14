/**
 * Motifs protégés (P3.1, Q14) : valeurs d'un texte qui ne doivent jamais être modifiées.
 *
 * Module PUR : aucune dépendance au DOM, à `chrome.*`, au réseau ni à l'horloge ; aucune journalisation.
 * Il sert à l'extension (intégrité avant écriture, P3.5) et au moteur, qui le reçoit par injection
 * (`createContractEngine(resources, { detectProtected })`, contrat §8, Q14 révisée).
 *
 * Règle d'or : sur-protection tolérée, sous-protection interdite. Tout chiffre de la page est dans un segment.
 *
 * Découpage, aligné sur le contrat (§12) : un montant et sa devise sont deux segments (`"5 000"`, `"FCFA"`) ;
 * une date, une heure, un téléphone, un compte ou une référence forment un seul segment. Des segments qui se
 * chevauchent ou se touchent sont fusionnés.
 *
 * Faux positifs connus et acceptés (sur-protection) :
 * - tout nombre isolé (« Étape 1 sur 5 » : « 1 » et « 5 ») ;
 * - deux lettres capitales suivies de chiffres (« OK 5 ») : lu comme un numéro de compte ;
 * - un jour suivi d'un mot qui est aussi un mois (« 2 mai ») ;
 * - un nom de domaine écrit dans une phrase (« safinum.cm »).
 */
import type { ProtectedDetector } from '../language/contract';

/** Espace normale, insécable (U+00A0) ou fine insécable (U+202F). */
const SP = '[ \\u00A0\\u202F]';
/** Signe d'un montant : plus, trait d'union-moins ou moins (U+2212). */
const SIGN = '[+\\-\\u2212]';
/** Début de jeton : ni lettre ni chiffre juste avant. */
const START = '(?<![\\p{L}\\p{N}])';
/** Fin de jeton : ni lettre ni chiffre juste après. */
const END = '(?![\\p{L}\\p{N}])';

const FR_MONTHS =
  'janv(?:ier|\\.)?|f[ée]vr(?:ier|\\.)?|mars|avr(?:il|\\.)?|mai|juin|juil(?:let|\\.)?|ao[ûu]t|sept(?:embre|\\.)?|oct(?:obre|\\.)?|nov(?:embre|\\.)?|d[ée]c(?:embre|\\.)?';
const EN_MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan\\.?|feb\\.?|mar\\.?|apr\\.?|jun\\.?|jul\\.?|aug\\.?|sept?\\.?|oct\\.?|nov\\.?|dec\\.?';

/** Ponctuation de bord retirée d'un jeton (parenthèses, guillemets, point final…), jamais un chiffre. */
const LEADING_PUNCT = /^[\p{Ps}\p{Pi}"'«]+/u;
const TRAILING_PUNCT = /[\p{Pe}\p{Pf}"'».,;!?…]+$/u;

interface Pattern {
  regex: RegExp;
  /** Retire la ponctuation de bord du segment trouvé. */
  trim?: boolean;
}

const PATTERNS: readonly Pattern[] = [
  // E-mail.
  { regex: /(?<![\p{L}\p{N}._%+\-])[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)+/gu, trim: true },
  // URL avec schéma ou « www. ».
  { regex: /(?:\bhttps?:\/\/|(?<![\p{L}\p{N}.])www\.)[^\s<>"«»]+/giu, trim: true },
  // Nom de domaine courant sans schéma (« safinum.cm », « exemple.com/aide »).
  {
    regex: new RegExp(
      `(?<![\\p{L}\\p{N}@.\\-])(?:[a-z0-9](?:[a-z0-9\\-]*[a-z0-9])?\\.)+(?:cm|com|net|org|fr|io|app|info|africa)${END}(?:\\/[^\\s<>"«»]*)?`,
      'giu',
    ),
    trim: true,
  },
  // Noms de marque (D5 §4.3) : « Safinum Pay » d'un seul tenant, sinon « Safinum ».
  { regex: new RegExp(`${START}safinum(?:${SP}+pay)?${END}`, 'giu') },
  // Devises.
  { regex: new RegExp(`${START}(?:F${SP}?CFA|XAF|CFA)${END}`, 'giu') },
  // Téléphone international (« +237 6 99 12 34 56 », « (+237) 699… », « 00237… »).
  { regex: /(?:\((?:\+|00)\p{Nd}{1,3}\)|(?<![\p{L}\p{N}+(])(?:\+|00)\p{Nd}{1,3})(?:[ \u00A0\u202F.\-]?\p{Nd}{1,4})+/gu },
  // Compte ou IBAN (« CM 001 2345 6789 01 », « CM21 1000 5… ») : groupes séparés par une espace.
  { regex: new RegExp(`${START}[A-Z]{2}${SP}?\\p{Nd}+(?:${SP}[A-Z0-9]+)*${END}`, 'gu') },
  // Référence (« SAF-2026-OTCUQ3 ») : capitales, puis groupes séparés par des tirets, dont un au moins chiffré.
  { regex: new RegExp(`${START}[A-Z]{2,}(?:-[A-Z0-9]+)*-\\p{Nd}[A-Z0-9]*(?:-[A-Z0-9]+)*${END}`, 'gu') },
  // Dates : « 05/11/2026 », « 2026-11-05 », « 05 nov. 2026 », « 1er novembre », « Nov 5, 2026 », « novembre 2026 ».
  { regex: /(?<![\p{N}])\p{Nd}{1,4}[/.\-]\p{Nd}{1,2}[/.\-]\p{Nd}{1,4}(?![\p{N}])/gu },
  {
    regex: new RegExp(`${START}(?:1er|\\p{Nd}{1,2})${SP}+(?:${FR_MONTHS}|${EN_MONTHS})(?:${SP}+\\p{Nd}{4})?(?![\\p{L}\\p{N}])`, 'giu'),
  },
  { regex: new RegExp(`${START}(?:${EN_MONTHS})${SP}+\\p{Nd}{1,2}(?:,?${SP}+\\p{Nd}{4})?${END}`, 'giu') },
  { regex: new RegExp(`${START}(?:${FR_MONTHS}|${EN_MONTHS})${SP}+\\p{Nd}{4}${END}`, 'giu') },
  // Heures : « 14:30 », « 14:30:05 », « 14h30 », « 14 h 30 », « 9h ».
  {
    regex: new RegExp(
      `(?<![\\p{N}])\\p{Nd}{1,2}(?::\\p{Nd}{2}(?::\\p{Nd}{2})?|${SP}?[hH]${SP}?\\p{Nd}{2}|${SP}?[hH](?![\\p{L}]))(?![\\p{N}])`,
      'gu',
    ),
  },
  // Pourcentage : le nombre et le signe % ensemble.
  { regex: new RegExp(`${START}${SIGN}?\\p{Nd}+(?:[.,]\\p{Nd}+)?${SP}?%`, 'gu') },
  // Montant ou nombre : groupes de trois chiffres séparés par une espace, décimales « , » ou « . », signe.
  { regex: new RegExp(`${START}${SIGN}?\\p{Nd}{1,3}(?:${SP}\\p{Nd}{3})+(?:[.,]\\p{Nd}+)?(?![\\p{N}])`, 'gu') },
  { regex: new RegExp(`${START}${SIGN}?\\p{Nd}+(?:[.,]\\p{Nd}+)*(?![\\p{N}])`, 'gu') },
  // Filet de sécurité : tout jeton (sans espace ni « : ») qui contient un chiffre.
  { regex: /(?<![^\s:])[^\s:]*\p{Nd}[^\s:]*/gu, trim: true },
];

export interface Span {
  start: number;
  end: number;
}

/** Bornes du segment trouvé, sans la ponctuation de bord si `trim`. */
function bounds(match: RegExpExecArray, trim: boolean): Span {
  let start = match.index;
  let end = start + match[0].length;
  if (trim) {
    start += LEADING_PUNCT.exec(match[0])?.[0].length ?? 0;
    const tail = TRAILING_PUNCT.exec(match[0].slice(start - match.index));
    if (tail) end -= tail[0].length;
  }
  return { start, end };
}

/** Plages protégées de `text`, triées et sans chevauchement (les plages qui se touchent sont fusionnées). */
export function protectedSpans(text: string): Span[] {
  if (typeof text !== 'string' || text === '') return [];
  const spans: Span[] = [];
  for (const { regex, trim = false } of PATTERNS) {
    regex.lastIndex = 0;
    for (let m = regex.exec(text); m; m = regex.exec(text)) {
      const span = bounds(m, trim);
      if (span.end > span.start) spans.push(span);
      if (m[0] === '') regex.lastIndex++;
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * Segments protégés de `text`, dans l'ordre du texte (contrat `ProtectedDetector`). Chaque segment est une
 * sous-chaîne exacte de `text` ; la recherche successive de chaque segment avec `indexOf` les retrouve tous.
 */
export const detectProtected: ProtectedDetector = (text) => protectedSpans(text).map(({ start, end }) => text.slice(start, end));
