/**
 * Infobulle du texte original (P5.5, Q3 a ; contrat §5.4-3) : au survol ou au focus d'un élément dont un texte
 * est affiché en éton, le français et la nature de la traduction s'affichent à côté.
 *
 * - Rien n'est ajouté dans le DOM de l'application : l'hôte de l'infobulle est placé hors de `<body>`
 *   (dernier enfant de `<html>`), avec une racine fantôme **fermée**, et seulement tant qu'elle est visible.
 * - Styles posés par le CSSOM (`element.style`) : ni `<style>`, ni attribut `style`, donc compatibles
 *   avec une politique CSP stricte de la page.
 * - Contenu écrit avec `textContent` (jamais `innerHTML`) ; il disparaît avec l'infobulle, rien n'est gardé.
 * - Échap ferme l'infobulle ; elle se ferme aussi au défilement, quand le pointeur quitte la fenêtre ou
 *   quand le focus part (WCAG 1.4.13). Les lecteurs d'écran ne la lisent pas : le mode bilingue (Q3 b) est
 *   l'option accessible pour eux.
 */
import type { Display } from './renderer';

export interface TooltipItem {
  readonly original: string;
  readonly display: Display;
}

/**
 * Textes affichés en éton sous `target` : ses nœuds texte directs (survol, `deep` faux) ou tous ses
 * descendants (focus, `deep` vrai).
 */
export type Describe = (target: Element, deep: boolean) => readonly TooltipItem[];

export interface Tooltip {
  /** Vrai tant que l'infobulle est affichée. */
  visible(): boolean;
  stop(): void;
}

/** Nom de l'élément hôte : un nom d'élément personnalisé accepte `attachShadow` sans être défini. */
export const TOOLTIP_TAG = 'finethnic-tooltip';

/** Textes au plus dans une infobulle. */
const MAX_ITEMS = 5;

export const TOOLTIP_TITLES: Readonly<Record<Display, string>> = {
  approved: 'Traduction validée. En français :',
  unverified: 'Traduction automatique, pas encore vérifiée par une locutrice. En français :',
  partial: 'Brouillon incomplet, non vérifié : les mots entre crochets sont restés en français. En français :',
};

/** La nature la moins sûre l'emporte : brouillon, puis non vérifiée, puis validée. */
const RANK: Readonly<Record<Display, number>> = { approved: 0, unverified: 1, partial: 2 };

type Origin = 'hover' | 'focus';

const isElement = (value: EventTarget | null): value is Element =>
  typeof value === 'object' && value !== null && (value as Node).nodeType === 1;

function setStyle(element: HTMLElement, style: Readonly<Record<string, string>>): void {
  for (const [property, value] of Object.entries(style)) element.style.setProperty(property, value);
}

export function createTooltip(doc: Document, describe: Describe): Tooltip {
  const win = doc.defaultView;
  let host: HTMLElement | null = null;
  let origin: Origin | null = null;
  let target: Element | null = null;
  /** Élément dont l'infobulle a été fermée par Échap : elle ne revient pas tant qu'on y reste. */
  let dismissed: Element | null = null;

  const hide = (): void => {
    host?.remove();
    host = null;
    origin = null;
    target = null;
  };

  const show = (element: Element, items: readonly TooltipItem[], from: Origin): void => {
    if (host && target === element && origin === from) return;
    hide();
    const display = items.reduce<Display>((worst, item) => (RANK[item.display] > RANK[worst] ? item.display : worst), 'approved');
    const box = doc.createElement('div');
    box.setAttribute('role', 'tooltip');
    setStyle(box, {
      'max-width': '22rem',
      padding: '0.5rem 0.75rem',
      border: '2px solid #1f2937',
      'border-radius': '0.375rem',
      background: '#ffffff',
      color: '#111827',
      font: '14px/1.4 system-ui, sans-serif',
      'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.25)',
      'white-space': 'normal',
      'overflow-wrap': 'anywhere',
    });
    const title = doc.createElement('p');
    title.textContent = TOOLTIP_TITLES[display];
    setStyle(title, { margin: '0 0 0.25rem', 'font-weight': '600' });
    box.append(title);
    for (const item of items.slice(0, MAX_ITEMS)) {
      const line = doc.createElement('p');
      line.lang = 'fr';
      line.textContent = item.original.trim();
      setStyle(line, { margin: '0' });
      box.append(line);
    }

    const next = doc.createElement(TOOLTIP_TAG);
    setStyle(next, { all: 'initial', position: 'fixed', 'z-index': '2147483647', 'pointer-events': 'none' });
    const rect = element.getBoundingClientRect();
    const height = win?.innerHeight ?? 0;
    const width = win?.innerWidth ?? 0;
    const below = rect.bottom + 6;
    // Sous l'élément, ou au-dessus s'il est en bas de la fenêtre.
    if (height > 0 && below > height * 0.75) setStyle(next, { bottom: `${Math.max(0, height - rect.top + 6)}px` });
    else setStyle(next, { top: `${Math.max(0, below)}px` });
    setStyle(next, { left: `${Math.max(0, Math.min(rect.left, width > 0 ? width - 320 : rect.left))}px` });
    next.attachShadow({ mode: 'closed' }).append(box);
    doc.documentElement.append(next);
    host = next;
    origin = from;
    target = element;
  };

  const offer = (element: Element, from: Origin): void => {
    if (element === dismissed) return;
    const items = describe(element, from === 'focus');
    if (items.length > 0) show(element, items, from);
    else if (origin === from) hide();
  };

  const onMouseOver = (event: Event): void => {
    if (!isElement(event.target) || event.target === host) return;
    if (event.target !== dismissed) dismissed = null;
    offer(event.target, 'hover');
  };
  const onMouseOut = (event: Event): void => {
    // Le pointeur quitte la fenêtre.
    if ((event as MouseEvent).relatedTarget === null && origin === 'hover') hide();
  };
  const onFocusIn = (event: Event): void => {
    if (!isElement(event.target)) return;
    dismissed = null;
    offer(event.target, 'focus');
  };
  const onFocusOut = (): void => {
    if (origin === 'focus') hide();
  };
  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key === 'Escape' && host) {
      dismissed = target;
      hide();
    }
  };
  const onScroll = (): void => {
    if (host) hide();
  };

  const listeners: ReadonlyArray<readonly [EventTarget, string, (event: Event) => void]> = [
    [doc, 'mouseover', onMouseOver],
    [doc, 'mouseout', onMouseOut],
    [doc, 'focusin', onFocusIn],
    [doc, 'focusout', onFocusOut],
    [doc, 'keydown', onKeyDown],
    [doc, 'scroll', onScroll],
  ];
  for (const [where, type, listener] of listeners) where.addEventListener(type, listener, { capture: true, passive: true });

  return {
    visible: () => host !== null,
    stop() {
      for (const [where, type, listener] of listeners) where.removeEventListener(type, listener, { capture: true });
      hide();
      dismissed = null;
    },
  };
}
