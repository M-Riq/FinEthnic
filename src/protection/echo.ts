/**
 * Écho de saisie (P3.4) : une valeur saisie à l'étape 3 (motif, note…) peut être réaffichée à l'étape 4.
 * Un texte de la page identique à une valeur saisie est protégé, même s'il ressemble à un libellé
 * (« Facture ») : la position de valeur prime sur toute correspondance lexicale.
 *
 * Valeurs relevées : celles des champs présents au démarrage, celles validées (`change`) ou en cours de
 * saisie (`input`), et celles de tous les champs au moment d'un `click` ou d'un `submit`. Ces deux
 * événements sont écoutés en phase de capture, donc avant que l'application monopage ne change d'étape et
 * ne retire les champs : une valeur préremplie ou une option choisie par défaut est ainsi relevée aussi.
 *
 * Confidentialité (P3.6) : seules des empreintes (hachage) des valeurs sont gardées, en mémoire, dans une
 * liste bornée ; rien n'est journalisé, rangé ni transmis. Les mots de passe ne sont jamais lus.
 */
import { hashText } from './integrity';

/** Nombre maximal d'empreintes gardées (les plus anciennes sont oubliées). */
export const MAX_ECHOES = 200;

/** Champs dont la valeur n'est jamais lue. */
const FIELD_SELECTOR = 'input, textarea, select';

const SKIPPED_TYPES: ReadonlySet<string> = new Set([
  'password',
  'hidden',
  'checkbox',
  'radio',
  'file',
  'submit',
  'button',
  'reset',
  'image',
  'color',
  'range',
]);

/** Forme comparée : espaces de bord retirées, espaces internes réduites à une seule. */
const normalizeEcho = (text: string): string => text.replace(/\s+/gu, ' ').trim();

/** Une valeur sans lettre est déjà protégée par `patterns.ts` ; une seule lettre ne suffit pas. */
const worthKeeping = (value: string): boolean => value.length >= 2 && /\p{L}/u.test(value);

export interface EchoGuard {
  /** Vrai si `text` (ou sa partie après « : ») reprend une valeur saisie. */
  isEcho(text: string): boolean;
  stop(): void;
}

/** Valeurs saisies d'un champ : texte libre, ou libellé et valeur des options choisies d'une liste. */
function fieldValues(field: Element): string[] {
  const tag = field.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return [(field as HTMLTextAreaElement).value];
  if (tag === 'SELECT') {
    return [...(field as HTMLSelectElement).selectedOptions].flatMap((option) => [option.text, option.value]);
  }
  if (tag === 'INPUT') {
    const input = field as HTMLInputElement;
    return SKIPPED_TYPES.has(input.type.toLowerCase()) ? [] : [input.value];
  }
  return [];
}

function hashesOf(field: Element): string[] {
  return fieldValues(field)
    .map(normalizeEcho)
    .filter(worthKeeping)
    .map((value) => hashText(value));
}

/** Ajoute à la fin d'un ensemble borné (les plus anciens éléments sont oubliés). */
function pushBounded<T>(set: Set<T>, value: T): void {
  set.delete(value);
  set.add(value);
  if (set.size > MAX_ECHOES) set.delete(set.values().next().value as T);
}

export function createEchoGuard(doc: Document): EchoGuard {
  /** Valeurs validées (`change`) ou présentes au démarrage. */
  const committed = new Set<string>();
  /** Dernière valeur en cours de saisie de chaque champ (`input`) : les débuts de saisie ne s'accumulent pas. */
  const typing = new Map<Element, string[]>();

  const commit = (field: Element): void => {
    for (const hash of hashesOf(field)) pushBounded(committed, hash);
    typing.delete(field);
  };

  const commitAll = (): void => {
    for (const field of doc.querySelectorAll(FIELD_SELECTOR)) commit(field);
  };
  commitAll();

  const fieldOf = (event: Event): Element | null => {
    const target = event.target as Node | null;
    return target && target.nodeType === 1 ? (target as Element) : null;
  };
  const onChange = (event: Event): void => {
    const field = fieldOf(event);
    if (field) commit(field);
  };
  const onInput = (event: Event): void => {
    const field = fieldOf(event);
    if (!field) return;
    typing.delete(field);
    typing.set(field, hashesOf(field));
    if (typing.size > MAX_ECHOES) typing.delete(typing.keys().next().value as Element);
  };
  const listeners: ReadonlyArray<readonly [string, (event: Event) => void]> = [
    ['change', onChange],
    ['input', onInput],
    ['click', commitAll],
    ['submit', commitAll],
  ];
  for (const [type, listener] of listeners) doc.addEventListener(type, listener, { capture: true, passive: true });

  const has = (value: string): boolean => {
    if (!worthKeeping(value)) return false;
    const hash = hashText(value);
    if (committed.has(hash)) return true;
    for (const hashes of typing.values()) if (hashes.includes(hash)) return true;
    return false;
  };

  return {
    isEcho(text) {
      if (committed.size === 0 && typing.size === 0) return false;
      const value = normalizeEcho(text);
      if (has(value)) return true;
      const colon = value.lastIndexOf(':');
      return colon >= 0 && has(value.slice(colon + 1).trim());
    },
    stop() {
      for (const [type, listener] of listeners) doc.removeEventListener(type, listener, { capture: true });
      committed.clear();
      typing.clear();
    },
  };
}
