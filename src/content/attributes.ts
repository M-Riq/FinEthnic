/**
 * Attributs traduits (phase 2, mission §3.1) : `placeholder`, `title` et `aria-label`.
 *
 * Contrat §4 : rôles `placeholder`, `title` et `aria-label` du contexte. Chaque attribut est une cible
 * (`AttrSlot`, une par élément et par nom, toujours le même objet) que la chaîne traite comme un nœud texte :
 * scan, classement, évaluation, rendu par `createRenderer(ATTRIBUTE_ACCESS)` (seul `setAttribute` du même
 * attribut, valeur d'origine gardée en mémoire et remise à la désactivation).
 *
 * Exclusions (mêmes régions que les textes, `dom-guard`) : un attribut d'un élément exclu ou dans une région
 * exclue n'est pas lu. Seule différence : un champ de saisie (`input`, `textarea`, `select`) n'est pas lu pour
 * sa valeur, mais son `placeholder`, son `title` et son `aria-label` sont des libellés et le sont, sauf champ
 * caché. Un `title` en position « valeur » (cellule valeur, classe `amount`…) et tout écho d'une saisie restent
 * en français ; `placeholder` et `aria-label` sont des libellés par nature (WAI-ARIA).
 */
import type { TextRole } from '../language/contract';
import { isInExcludedRegion, isValuePosition, type SourceOf } from '../protection/dom-guard';
import type { ValueAccess } from './renderer';
import { classifyText, type EchoCheck, type TextKind } from './scanner';

export const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;
export type TranslatedAttribute = (typeof TRANSLATED_ATTRIBUTES)[number];

export const ATTRIBUTE_ROLES: Readonly<Record<TranslatedAttribute, TextRole>> = {
  placeholder: 'placeholder',
  title: 'title',
  'aria-label': 'aria-label',
};

export const isTranslatedAttribute = (name: string | null): name is TranslatedAttribute =>
  TRANSLATED_ATTRIBUTES.some((attribute) => attribute === name);

/** Un attribut d'un élément. Toujours le même objet pour un même couple (élément, nom) : clé de `Map`. */
export interface AttrSlot {
  readonly element: Element;
  readonly name: TranslatedAttribute;
}

export const ATTRIBUTE_ACCESS: ValueAccess<AttrSlot> = {
  read: (slot) => slot.element.getAttribute(slot.name) ?? '',
  write: (slot, value) => slot.element.setAttribute(slot.name, value),
};

const slots = new WeakMap<Element, Partial<Record<TranslatedAttribute, AttrSlot>>>();

export function slotOf(element: Element, name: TranslatedAttribute): AttrSlot {
  let bySlot = slots.get(element);
  if (!bySlot) slots.set(element, (bySlot = {}));
  return (bySlot[name] ??= Object.freeze({ element, name }));
}

const FIELD_SELECTOR = 'input, textarea, select';
const HIDDEN_FIELD_SELECTOR = '[hidden], [aria-hidden="true" i], input[type="hidden" i]';
/** `placeholder` n'a de sens que sur ces champs. */
const PLACEHOLDER_SELECTOR = 'input, textarea';

/** Vrai si les attributs de l'élément ne doivent pas être lus (voir l'en-tête). */
export function isAttributeExcluded(element: Element): boolean {
  if (element.matches(FIELD_SELECTOR)) {
    const parent = element.parentElement;
    return element.matches(HIDDEN_FIELD_SELECTOR) || parent === null || isInExcludedRegion(parent);
  }
  return isInExcludedRegion(element);
}

/**
 * Classe la valeur d'origine (`source`, en français) d'un attribut, comme un texte : `null` si elle est vide
 * ou sans lettre ni chiffre, `value` si c'est un écho de saisie ou un `title` en position valeur.
 */
export function classifyAttribute(slot: AttrSlot, source: string, isEcho?: EchoCheck, sourceOf?: SourceOf): TextKind | null {
  const kind = classifyText(source);
  if (kind !== 'candidate') return kind;
  if (isEcho?.(source) === true) return 'value';
  return slot.name === 'title' && isValuePosition(slot.element, sourceOf) ? 'value' : 'candidate';
}

function visitElement(element: Element, visit: (slot: AttrSlot) => void): void {
  if (isAttributeExcluded(element)) return;
  for (const name of TRANSLATED_ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    if (name === 'placeholder' && !element.matches(PLACEHOLDER_SELECTOR)) continue;
    visit(slotOf(element, name));
  }
}

const ELEMENT_NODE = 1;
const SHOW_ELEMENT = 0x1;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;

/**
 * Appelle `visit` pour chaque attribut traduit présent sous `root` (élément compris), dans l'ordre du document.
 * `deep: false` : seulement les attributs de `root` (mutation d'un attribut, sans relire tout le sous-arbre).
 */
export function scanAttributes(root: Node, visit: (slot: AttrSlot) => void, deep = true): void {
  if (root.nodeType !== ELEMENT_NODE) return;
  const element = root as Element;
  visitElement(element, visit);
  if (!deep || element.matches(FIELD_SELECTOR) || isInExcludedRegion(element)) return;
  const walker = element.ownerDocument.createTreeWalker(element, SHOW_ELEMENT, {
    // Une région exclue est sautée en entier ; un champ est lu (ses libellés), mais pas ce qu'il contient.
    acceptNode: (node) => (isInExcludedRegion(node) && !(node as Element).matches(FIELD_SELECTOR) ? FILTER_REJECT : FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) visitElement(node as Element, visit);
}
