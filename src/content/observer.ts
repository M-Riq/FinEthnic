/**
 * Observateur de mutations (P2.4, P2.5) : signale les parties de la page à relire, regroupées par trame.
 *
 * L'application de test est monopage (Q2) : un changement d'étape n'est visible que par mutation.
 * Les nœuds ajoutés et les textes modifiés sont accumulés, puis livrés en **un seul lot** par trame
 * (`requestAnimationFrame` par défaut). Un nœud dont un ancêtre est déjà dans le lot n'est pas répété,
 * et un nœud retiré de la page entre-temps est ignoré.
 */

/** Programme un rappel (une trame plus tard par défaut ; remplaçable dans les tests). */
export type Schedule = (callback: () => void) => void;

export function frameSchedule(win: Window): Schedule {
  return (callback) => {
    win.requestAnimationFrame(() => callback());
  };
}

/** Attributs qui font entrer ou sortir un sous-arbre des régions exclues (`dom-guard`). */
export const WATCHED_ATTRIBUTES = ['hidden', 'aria-hidden', 'contenteditable'] as const;

export interface MutationWatcher {
  /** Arrête l'observation ; les mutations en attente sont abandonnées. */
  stop(): void;
}

/** Garde les racines connectées sous `scope`, sans celles dont un ancêtre est déjà retenu. Ordre conservé. */
export function topmostRoots(nodes: Iterable<Node>, scope: Node): Node[] {
  const set = new Set(nodes);
  const roots: Node[] = [];
  for (const node of set) {
    if (!scope.contains(node)) continue;
    let covered = false;
    for (let parent = node.parentNode; parent && parent !== scope.parentNode; parent = parent.parentNode) {
      if (set.has(parent)) {
        covered = true;
        break;
      }
    }
    if (!covered) roots.push(node);
  }
  return roots;
}

export function watchMutations(scope: Node, onBatch: (roots: Node[]) => void, schedule: Schedule): MutationWatcher {
  const win = scope.ownerDocument?.defaultView;
  if (!win) throw new Error('watchMutations : nœud hors fenêtre');
  const dirty = new Set<Node>();
  let changed = false;
  let scheduled = false;
  let active = true;

  // Un retrait seul donne aussi un lot (vide) : il permet d'oublier les textes retirés.
  const collect = (records: readonly MutationRecord[]): void => {
    for (const record of records) {
      changed = true;
      if (record.type === 'childList') record.addedNodes.forEach((node) => dirty.add(node));
      else dirty.add(record.target);
    }
  };

  const run = (): void => {
    scheduled = false;
    if (!active) return;
    collect(observer.takeRecords());
    const roots = topmostRoots(dirty, scope);
    dirty.clear();
    if (changed) {
      changed = false;
      onBatch(roots);
    }
  };

  const observer = new win.MutationObserver((records) => {
    collect(records);
    if (changed && !scheduled) {
      scheduled = true;
      schedule(run);
    }
  });
  observer.observe(scope, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...WATCHED_ATTRIBUTES],
  });

  return {
    stop() {
      active = false;
      observer.disconnect();
      dirty.clear();
      changed = false;
    },
  };
}
