/**
 * Garde DOM (P2.2, P3.2 à P3.4) : ce que l'extension ne lit pas, et ce qu'elle lit sans jamais le traduire.
 *
 * 1. Régions exclues (`EXCLUDED_SELECTOR`) : code, scripts, contenus masqués, médias et champs de saisie,
 *    avec tous leurs descendants. `select` et `option` restent exclus tant que Q8 n'est pas tranchée.
 * 2. Positions « valeur » (`isValuePosition`) : le texte est lu (compté par le diagnostic) mais jamais soumis
 *    au moteur. La position prime sur toute correspondance lexicale (P3.4) : « Gratuit » ou « Succès » dans
 *    une cellule valeur restent en français (sur-protection acceptée, sous-protection interdite).
 *    - éléments de valeur : `dd`, `output`, `time`, `data`, `meter`, `progress`, `[role=timer|marquee]`,
 *      liens `tel:`, `mailto:` et `sms:` ;
 *    - paires libellé/valeur (P3.3) : 2ᵉ cellule d'une ligne de deux cellules (`tr`, `[role=row]`), et
 *      2ᵉ de deux éléments frères quand le 1ᵉʳ finit par « : » (« Bénéficiaire : » / « Jean-Paul Mbarga ») ;
 *    - attributs ou classes indicatifs (`amount`, `balance`, `name`, `ref`…) : ils ne font qu'ajouter une
 *      exclusion, jamais en retirer une. Ils sont lus sur le parent du texte et ses ancêtres en ligne, jusqu'au
 *      premier bloc compris, pour qu'une classe posée sur une carte entière ne bloque pas son titre.
 *    Les régions `aria-live` ne sont pas exclues en bloc : leurs messages peuvent être traduits, et les valeurs
 *    qu'ils contiennent sont protégées une à une par `patterns.ts` et le contrôle d'intégrité (P3.5).
 * Structure réelle du site à confirmer en P2.0 (Q20) ; ces règles sont des hypothèses prudentes.
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

/** Éléments dont tout le contenu est une valeur. */
export const VALUE_SELECTOR = [
  'dd',
  'output',
  'time',
  'data',
  'meter',
  'progress',
  '[role="timer" i]',
  '[role="marquee" i]',
  'a[href^="tel:" i]',
  'a[href^="mailto:" i]',
  'a[href^="sms:" i]',
].join(', ');

const CELL_SELECTOR = 'td, th, [role="cell" i], [role="gridcell" i], [role="rowheader" i]';

/** Mots indicatifs d'une valeur dans `class`, `id`, `name`, `itemprop` ou `data-testid`. */
export const INDICATIVE_WORDS: ReadonlySet<string> = new Set([
  'amount',
  'montant',
  'balance',
  'solde',
  'price',
  'prix',
  'currency',
  'devise',
  'name',
  'nom',
  'holder',
  'titulaire',
  'ref',
  'reference',
  'iban',
  'phone',
  'tel',
  'telephone',
  'msisdn',
  'email',
  'value',
  'valeur',
]);

const INDICATIVE_ATTRIBUTES = ['class', 'id', 'name', 'itemprop', 'data-testid'] as const;

/** Éléments de bloc : la recherche des indices s'arrête au premier rencontré (inclus). */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'CAPTION', 'DD', 'DETAILS', 'DIALOG', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HTML',
  'LI', 'MAIN', 'NAV', 'OL', 'P', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);

/** Découpe une valeur d'attribut en mots : espaces, `-`, `_`, `.` et casse chameau (`userName` → user, name). */
export function indicativeTokens(value: string): string[] {
  return value
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function hasIndicativeHint(element: Element): boolean {
  return INDICATIVE_ATTRIBUTES.some((name) => {
    const value = element.getAttribute(name);
    return value !== null && indicativeTokens(value).some((token) => INDICATIVE_WORDS.has(token));
  });
}

/** Vrai si la cellule est la seconde d'une ligne qui en compte exactement deux. */
function isSecondOfTwoCells(cell: Element): boolean {
  const row = cell.parentElement;
  if (!row) return false;
  const cells = [...row.children].filter((child) => child.matches(CELL_SELECTOR));
  return cells.length === 2 && cells[1] === cell;
}

/** Vrai si l'élément est le second de deux frères et que le premier finit par « : » (libellé). */
function isValueAfterColonLabel(element: Element): boolean {
  const parent = element.parentElement;
  if (!parent || parent.children.length !== 2 || parent.lastElementChild !== element) return false;
  const label = parent.firstElementChild?.textContent ?? '';
  return /:\s*$/u.test(label);
}

/**
 * Vrai si le texte est en position « valeur » (voir l'en-tête) : il ne doit jamais être soumis au moteur,
 * quelle que soit sa ressemblance avec un libellé de la bibliothèque.
 */
export function isValuePosition(node: Node): boolean {
  const parent = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (!parent) return false;
  if (parent.closest(VALUE_SELECTOR)) return true;
  const cell = parent.closest(CELL_SELECTOR);
  if (cell && isSecondOfTwoCells(cell)) return true;
  for (let element: Element | null = parent; element; element = element.parentElement) {
    if (hasIndicativeHint(element) || isValueAfterColonLabel(element)) return true;
    if (BLOCK_TAGS.has(element.tagName.toUpperCase())) break;
  }
  return false;
}
