/**
 * Garde DOM, version initiale (P2.2) : régions de la page que l'extension ne lit ni ne modifie jamais.
 *
 * Code, scripts, contenus masqués, médias et champs de saisie sont exclus avec tous leurs descendants.
 * `select` et `option` restent exclus tant que Q8 n'est pas tranchée (par défaut, on ne touche à rien).
 * P3 complète ce module (paires libellé/valeur, cellules « valeur », liens tel:/mailto:, etc.).
 */

export const EXCLUDED_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'code',
  'pre',
  'kbd',
  'samp',
  'svg',
  'math',
  'iframe',
  'object',
  'embed',
  'canvas',
  'video',
  'audio',
  'input',
  'textarea',
  'select',
  'option',
  '[contenteditable]:not([contenteditable="false" i])',
  '[hidden]',
  '[aria-hidden="true" i]',
].join(', ');

/** Vrai si l'élément lui-même ouvre une région exclue. */
export function isExcludedElement(element: Element): boolean {
  return element.matches(EXCLUDED_SELECTOR);
}

/** Vrai si le nœud est dans une région exclue (lui-même ou un ancêtre), ou hors de tout élément. */
export function isInExcludedRegion(node: Node): boolean {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  return element === null || element.closest(EXCLUDED_SELECTOR) !== null;
}
