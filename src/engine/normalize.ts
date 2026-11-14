/**
 * Normalisation et découpage d'un texte reçu de l'extension (moteur, PR 1).
 *
 * - Le texte original est gardé tel quel. Les espaces de début et de fin sont mis à part pour pouvoir
 *   être restitués.
 * - Le texte normalisé est en NFC. Les suites d'espaces (y compris U+00A0 et U+202F) deviennent une
 *   seule espace, ou un saut de ligne si la suite en contenait un. Les apostrophes sont unifiées en '.
 *   Les accents et la casse ne sont jamais modifiés (ROADMAP BM5.1).
 * - Les valeurs protégées sont reconnues avant les mots et ne seront jamais traduites : variables
 *   {…}, montants, nombres, noms protégés (marques, devises), URL et adresses e-mail.
 * - Les élisions sont détachées (« l'opération » → « l' » + « opération »). Les pronoms liés par un
 *   trait d'union aussi (« Connectez-vous » → « Connectez » + « vous »).
 *
 * Module pur, sans dépendance à Node : il doit pouvoir tourner dans l'extension.
 */
import { ELIDED, ENCLITIC_OBJECTS, ENCLITIC_SUBJECTS, LEXICALIZED_HYPHENATED } from './french';

export type TokenKind = 'word' | 'variable' | 'amount' | 'number' | 'guard' | 'url' | 'email' | 'punct';

export interface Token {
  kind: TokenKind;
  /** Texte du jeton, tel qu'il apparaît dans `NormalizedText.text`. */
  text: string;
  /** Clé de recherche : minuscules (fr). Accents conservés. */
  key: string;
  /** Position dans `NormalizedText.text` : `text.slice(start, end) === token.text`. */
  start: number;
  end: number;
  /** Pronom rattaché au mot précédent par un trait d'union (« vous » dans « Connectez-vous »). */
  enclitic?: true;
}

export interface NormalizedText {
  /** Texte exact reçu. */
  original: string;
  /** Espaces de début et de fin de l'original, à restituer autour de la traduction. */
  leading: string;
  trailing: string;
  /** Texte normalisé (voir l'en-tête du module). */
  text: string;
  tokens: Token[];
}

export interface NormalizeOptions {
  /** Noms protégés (marques, codes de devise), jamais traduits. Comparaison sans tenir compte de la casse. */
  guards?: readonly string[];
}

const CURRENCY = String.raw`(?:FCFA|F CFA|XAF|EUR|USD|€|\$)`;
const NUMBER = String.raw`\+?\d+(?:[ .,/:h-]\d+)*`;
const WORD = String.raw`\p{L}[\p{L}\p{M}\p{N}]*(?:[-'][\p{L}\p{M}\p{N}]+)*'?`;
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

function tokenPattern(guards: readonly string[]): RegExp {
  const guard = [...guards]
    .map((g) => g.normalize('NFC').replace(/\s+/gu, ' ').trim())
    .filter((g) => g !== '')
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
  const parts = [
    String.raw`(?<variable>\{[^{}\n]*\})`,
    String.raw`(?<url>(?:https?://|www\.)\S+)`,
    String.raw`(?<email>[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,})`,
    String.raw`(?<amount>${NUMBER} ?${CURRENCY}(?![\p{L}\p{N}]))`,
    String.raw`(?<number>${NUMBER})`,
    ...(guard ? [String.raw`(?<guard>(?<![\p{L}\p{M}\p{N}])(?:${guard})(?![\p{L}\p{M}\p{N}]))`] : []),
    String.raw`(?<word>${WORD})`,
    String.raw`(?<punct>\.{3}|[?!]+|\S)`,
  ];
  return new RegExp(parts.join('|'), 'giu');
}

const key = (text: string): string => text.toLocaleLowerCase('fr');

function make(kind: TokenKind, text: string, start: number, enclitic = false): Token {
  return { kind, text, key: key(text), start, end: start + text.length, ...(enclitic ? { enclitic: true as const } : {}) };
}

/** Découpe un mot : élision en tête, pronoms rattachés par un trait d'union en fin. */
function splitWord(text: string, start: number): Token[] {
  const lower = key(text);
  const apostrophe = lower.indexOf("'");
  if (apostrophe > 0 && apostrophe < lower.length - 1 && ELIDED.has(lower.slice(0, apostrophe + 1))) {
    const head = text.slice(0, apostrophe + 1);
    return [make('word', head, start), ...splitWord(text.slice(apostrophe + 1), start + head.length)];
  }
  if (LEXICALIZED_HYPHENATED.has(lower) || !lower.includes('-')) return [make('word', text, start)];

  const parts = text.split('-');
  const tail: string[] = [];
  while (parts.length > 1) {
    const last = key(parts[parts.length - 1] as string);
    const isPronoun = ENCLITIC_SUBJECTS.has(last) || ENCLITIC_OBJECTS.has(last);
    // « a-t-il » : le « t » de liaison n'est détaché que devant un pronom sujet.
    const isLiaison = last === 't' && tail.length > 0;
    if (!isPronoun && !isLiaison) break;
    tail.unshift(parts.pop() as string);
  }
  if (tail.length === 0) return [make('word', text, start)];
  const host = parts.join('-');
  const tokens = [make('word', host, start)];
  let offset = start + host.length;
  for (const part of tail) {
    offset += 1; // trait d'union
    if (key(part) !== 't') tokens.push(make('word', part, offset, true));
    offset += part.length;
  }
  return tokens;
}

/** Normalise `input` et le découpe en jetons. Ne lève jamais d'exception. */
export function normalize(input: string, options: NormalizeOptions = {}): NormalizedText {
  const leading = /^\s*/u.exec(input)?.[0] ?? '';
  const trailing = input.length > leading.length ? (/\s*$/u.exec(input)?.[0] ?? '') : '';
  const text = input
    .slice(leading.length, input.length - trailing.length)
    .normalize('NFC')
    .replace(/[\s\u00A0\u202F]+/gu, (ws) => (ws.includes('\n') ? '\n' : ' '))
    .replace(/[’ʼ‘]/gu, "'");

  const tokens: Token[] = [];
  for (const m of text.matchAll(tokenPattern(options.guards ?? []))) {
    const groups = m.groups ?? {};
    const kind = (Object.keys(groups) as TokenKind[]).find((k) => groups[k] !== undefined) ?? 'punct';
    let value = m[0];
    if (kind === 'url') {
      // La ponctuation finale (« …/aide. ») n'appartient pas à l'URL.
      const trimmed = value.replace(/[.,;:!?)»]+$/u, '');
      tokens.push(make('url', trimmed, m.index));
      for (let i = trimmed.length; i < value.length; i++) tokens.push(make('punct', value.charAt(i), m.index + i));
      continue;
    }
    if (kind === 'word') {
      // Apostrophe finale isolée (« l' opération ») : gardée seulement si c'est une élision connue.
      if (value.endsWith("'") && !ELIDED.has(key(value))) {
        value = value.slice(0, -1);
        tokens.push(...splitWord(value, m.index), make('punct', "'", m.index + value.length));
        continue;
      }
      tokens.push(...splitWord(value, m.index));
      continue;
    }
    tokens.push(make(kind, value, m.index));
  }
  return { original: input, leading, trailing, text, tokens };
}
