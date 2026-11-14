/**
 * Contexte d'un texte (P2.8, contrat §6) : seulement des énumérations et des booléens, jamais de texte voisin.
 *
 * - `role` : nature du texte, déduite de l'élément sémantique le plus proche ;
 * - `live` : texte dans une région aria-live, une alerte, un statut ou une boîte de dialogue ;
 * - `pageLang` : valeur brute de `<html lang>` ;
 * - `step` : étape SAFINUM, déduite du seul titre visible de l'étape, sinon absente (Q20, jamais de l'URL).
 */
import type { TextRole, TranslationContext } from '../language/contract';
import { isInExcludedRegion } from '../protection/dom-guard';

export type Step = NonNullable<TranslationContext['step']>;

/** Correspondances dans l'ordre : le premier sélecteur vérifié par l'élément sémantique le plus proche gagne. */
const ROLES: ReadonlyArray<readonly [string, TextRole]> = [
  ['h1, h2, h3, h4, h5, h6, [role="heading"]', 'heading'],
  ['button, [role="button"], summary', 'button'],
  ['a[href], [role="link"]', 'link'],
  ['option, [role="option"]', 'option'],
  ['[role="status"], output', 'status'],
  ['[role="alert"], [role="alertdialog"], p', 'message'],
  ['label, legend, dt, th, caption, [role="columnheader"], [role="rowheader"]', 'label'],
];
const ROLE_SELECTOR = ROLES.map(([selector]) => selector).join(', ');

const LIVE_SELECTOR = [
  '[aria-live]:not([aria-live="off" i])',
  '[role="alert"]',
  '[role="status"]',
  '[role="log"]',
  '[role="alertdialog"]',
  '[role="dialog"]',
  'dialog',
  'output',
].join(', ');

export function roleOf(element: Element | null): TextRole {
  const semantic = element?.closest(ROLE_SELECTOR);
  if (!semantic) return 'unknown';
  return ROLES.find(([selector]) => semantic.matches(selector))?.[1] ?? 'unknown';
}

export function isLive(element: Element | null): boolean {
  return element?.closest(LIVE_SELECTOR) != null;
}

export function pageLangOf(doc: Document): string | undefined {
  const lang = doc.documentElement.getAttribute('lang');
  return lang ? lang : undefined;
}

/**
 * Titres des étapes (premier texte de chaque page D8). Hypothèse à confirmer sur le DOM réel (P2.0, Q20) :
 * le titre de l'étape est le seul titre de niveau 1 visible.
 */
const STEP_TITLES: ReadonlyMap<string, Step> = new Map([
  ['Votre compte', 1],
  ['Frais de transfert', 2],
  ['Bénéficiaire', 3],
  ['Récapitulatif', 4],
  ['Transfert effectué', 5],
]);

/** Étape affichée, ou `undefined` si aucun titre d'étape n'est visible ou s'ils désignent des étapes différentes. */
export function detectStep(doc: Document): Step | undefined {
  const found = new Set<Step>();
  for (const heading of doc.querySelectorAll('h1, [role="heading"][aria-level="1"]')) {
    if (isInExcludedRegion(heading)) continue;
    const step = STEP_TITLES.get((heading.textContent ?? '').replace(/\s+/gu, ' ').trim());
    if (step) found.add(step);
  }
  return found.size === 1 ? [...found][0] : undefined;
}

export interface PageContext {
  pageLang?: string;
  step?: Step;
}

export function readPageContext(doc: Document): PageContext {
  const page: PageContext = {};
  const pageLang = pageLangOf(doc);
  const step = detectStep(doc);
  if (pageLang !== undefined) page.pageLang = pageLang;
  if (step !== undefined) page.step = step;
  return page;
}

export function contextOf(node: Text, page: PageContext): TranslationContext {
  const parent = node.parentElement;
  return { role: roleOf(parent), live: isLive(parent), ...page };
}
