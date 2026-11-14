/**
 * Scanner DOM en lecture seule (P2.1, P2.3, P3.3, P3.4).
 *
 * Parcourt les nœuds texte d'une racine avec un `TreeWalker`, sans entrer dans les régions exclues
 * par `dom-guard`, et classe chaque texte non vide. Rien n'est écrit dans la page.
 * Les racines fantômes (shadow DOM) et les iframes ne sont pas parcourues (à vérifier en Q20).
 */
import { isExcludedElement, isInExcludedRegion, isValuePosition } from '../protection/dom-guard';

/**
 * - `candidate` : texte avec au moins une lettre, à soumettre au moteur ;
 * - `numeric-like` : chiffres sans lettre (montant, téléphone, date…), jamais soumis ;
 * - `value` : texte avec des lettres en position « valeur » (cellule valeur, écho de saisie…), jamais soumis.
 */
export type TextKind = 'candidate' | 'numeric-like' | 'value';

/** Vrai si le texte reprend une valeur saisie par l'utilisateur (P3.4, `protection/echo.ts`). */
export type EchoCheck = (text: string) => boolean;

/** Classe un texte ; `null` si le texte est vide, blanc ou fait seulement de ponctuation et de symboles. */
export function classifyText(text: string): TextKind | null {
  if (/\p{L}/u.test(text)) return 'candidate';
  if (/\p{Nd}/u.test(text)) return 'numeric-like';
  return null;
}

/** Classe un nœud texte : comme `classifyText`, puis un texte avec des lettres en position « valeur » devient `value`. */
export function classifyNode(node: Text, isEcho?: EchoCheck): TextKind | null {
  const kind = classifyText(node.data);
  if (kind !== 'candidate') return kind;
  return isValuePosition(node) || isEcho?.(node.data) === true ? 'value' : 'candidate';
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const SHOW_ELEMENT = 0x1;
const SHOW_TEXT = 0x4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;
const FILTER_SKIP = 3;

/**
 * Appelle `visit` pour chaque nœud texte classé sous `root` (ou pour `root` s'il est un nœud texte),
 * dans l'ordre du document. Une racine située dans une région exclue ne donne rien.
 */
export function scanTexts(root: Node, visit: (node: Text, kind: TextKind) => void, isEcho?: EchoCheck): void {
  if ((root.nodeType !== ELEMENT_NODE && root.nodeType !== TEXT_NODE) || isInExcludedRegion(root)) return;
  if (root.nodeType === TEXT_NODE) {
    const kind = classifyNode(root as Text, isEcho);
    if (kind) visit(root as Text, kind);
    return;
  }
  const doc = root.ownerDocument;
  if (!doc) return;
  const walker = doc.createTreeWalker(root, SHOW_ELEMENT | SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeType === ELEMENT_NODE ? (isExcludedElement(node as Element) ? FILTER_REJECT : FILTER_SKIP) : FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const kind = classifyNode(node as Text, isEcho);
    if (kind) visit(node as Text, kind);
  }
}
