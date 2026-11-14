/**
 * Chaîne de traitement (P2, P5) : scan initial, observation des mutations, évaluation par le moteur,
 * compteurs, puis affichage par le rendu s'il est fourni (P5).
 *
 * Sans rendu, la chaîne est en lecture seule : rien n'est modifié dans la page. Avec rendu, seul `Text.data`
 * des textes traduits change (`renderer.ts`). Les textes suivis, leurs résultats et leurs originaux restent
 * en mémoire, dans cette chaîne et dans le rendu ; ils ne sont ni journalisés, ni rangés, ni transmis.
 *
 * Anti-boucle (5.3) : une mutation qui laisse notre écriture en place est ignorée ; un texte affiché en éton
 * n'est jamais soumis au moteur (c'est son original qui l'est), et un texte déjà évalué dont le texte n'a pas
 * changé (par exemple après notre propre restauration) n'est pas réévalué. Si l'application remplace un texte
 * traduit (5.4), le nouveau texte devient l'original et il est réévalué.
 *
 * Phase 2 (mission §3.1) :
 * - les attributs `placeholder`, `title` et `aria-label` (`attributes.ts`) sont des cibles comme les nœuds texte :
 *   mêmes règles de protection, d'anti-boucle et de restauration, rendu par un second `Renderer` (attributs) ;
 * - chaque texte à traduire reçoit une classe (`classification.ts`), comptée par le diagnostic.
 * `entries()` ne donne que les nœuds texte (surlignage, infobulle) ; `counts()` compte aussi les attributs.
 */
import type { TranslationEngine, TranslationRequest, TranslationResult, TranslationStatus } from '../language/contract';
import { isInExcludedRegion } from '../protection/dom-guard';
import type { Logger } from '../shared/logger';
import type { CountKey } from '../shared/messages';
import {
  ATTRIBUTE_ACCESS, ATTRIBUTE_ROLES, classifyAttribute, isAttributeExcluded, scanAttributes, type AttrSlot,
} from './attributes';
import { classifyPageText } from './classification';
import { contextOf, isLive, readPageContext, type PageContext, type Step } from './context';
import { countEntries, type Tracked } from './diagnostic';
import { watchMutations, type Schedule } from './observer';
import { createRenderer, decide, KEEP, type Decision, type DisplaySettings, type Renderer } from './renderer';
import { classifyText, scanTexts, type EchoCheck, type TextKind } from './scanner';

/** Cible d'une traduction : un nœud texte ou un attribut traduit. */
type Target = Text | AttrSlot;
const isSlot = (target: Target): target is AttrSlot => !('nodeType' in target);

/** Textes évalués au plus par trame ; le reste passe à la trame suivante. */
export const DEFAULT_BUDGET = 200;

const STATUSES: ReadonlySet<string> = new Set<TranslationStatus>([
  'APPROVED',
  'KNOWN_UNTRANSLATED',
  'PENDING_VALIDATION',
  'NO_MATCH',
  'AMBIGUOUS',
  'PROTECTED',
]);

/** Affichage des résultats (P5). */
export interface RenderTarget {
  renderer: Renderer;
  /** Options d'affichage en vigueur, relues à chaque écriture. */
  settings(): DisplaySettings;
}

export interface PipelineOptions {
  doc: Document;
  engine: TranslationEngine | null;
  schedule: Schedule;
  logger: Logger;
  budget?: number;
  /** Écho des valeurs saisies (P3.4) : un texte qui reprend une saisie n'est jamais soumis au moteur. */
  isEcho?: EchoCheck;
  /** Appelé après chaque lot (scan ou évaluation), par exemple pour mettre à jour le surlignage. */
  onUpdate?: () => void;
  /** Rendu des traductions (P5) ; sans rendu, la page n'est jamais modifiée. */
  render?: RenderTarget;
}

export interface Pipeline {
  /** Textes suivis encore présents dans la page. */
  entries(): Generator<readonly [Text, Tracked]>;
  counts(): Record<CountKey, number>;
  step(): Step | undefined;
  /** Réapplique les options d'affichage aux textes déjà évalués, sans les réévaluer (P5.10). */
  refresh(): void;
  /** Arrête la chaîne et rend à la page tous les textes d'origine. */
  stop(): void;
}

export function startPipeline(options: PipelineOptions): Pipeline {
  const { doc, engine, schedule, logger, render } = options;
  const renderer = render?.renderer ?? null;
  const attributeRenderer: Renderer<AttrSlot> | null = render ? createRenderer(ATTRIBUTE_ACCESS) : null;
  const budget = Math.max(1, options.budget ?? DEFAULT_BUDGET);
  const tracked = new Map<Text, Tracked>();
  const trackedAttributes = new Map<AttrSlot, Tracked>();
  const queue = new Set<Target>();
  let page: PageContext = {};
  let active = true;
  let drainScheduled = false;

  /** Valeur actuelle dans la page (texte du nœud ou de l'attribut). */
  const raw = (target: Target): string => (isSlot(target) ? ATTRIBUTE_ACCESS.read(target) : target.data);

  /** Texte d'origine : le français gardé par le rendu pour un texte affiché en éton, sinon le texte de la page. */
  const source = (target: Target): string => {
    if (isSlot(target)) return attributeRenderer ? attributeRenderer.sourceOf(target) : ATTRIBUTE_ACCESS.read(target);
    return renderer ? renderer.sourceOf(target) : target.data;
  };
  const textSource = (node: Text): string => source(node);

  const entryOf = (target: Target): Tracked | undefined => (isSlot(target) ? trackedAttributes.get(target) : tracked.get(target));
  const isConnected = (target: Target): boolean => (isSlot(target) ? target.element.isConnected : target.isConnected);

  const register = (target: Target, kind: TextKind): void => {
    const entry: Tracked = {
      kind, status: null, unverifiedKind: null, result: null, evaluated: null, shown: null, refused: false,
      textClass: kind === 'candidate' ? classifyPageText(source(target)).classe : null,
      attribute: isSlot(target),
    };
    if (isSlot(target)) trackedAttributes.set(target, entry);
    else tracked.set(target, entry);
    if (kind === 'candidate' && engine) queue.add(target);
    else queue.delete(target);
  };

  const show = <T>(target: T, rendering: Renderer<T>, decision: Decision, entry: Tracked): void => {
    if (decision.action === 'write') {
      rendering.write(target, decision.text, decision.display);
      entry.shown = decision.display;
    } else {
      rendering.restore(target);
      entry.shown = null;
    }
  };

  /** Affiche le dernier résultat d'un texte, ou remet son original. */
  const sync = (target: Target, entry: Tracked): void => {
    if (!render || !renderer || !attributeRenderer) return;
    const current = source(target);
    // Un résultat ne s'applique qu'au texte évalué : si l'application l'a changé depuis, on garde l'original.
    const decision =
      entry.kind === 'candidate' && entry.result && entry.evaluated === current ? decide(current, entry.result, render.settings()) : KEEP;
    entry.refused = decision.action === 'refuse';
    if (isSlot(target)) show(target, attributeRenderer, decision, entry);
    else show(target, renderer, decision, entry);
  };

  const forget = (): void => {
    for (const node of tracked.keys()) {
      if (!node.isConnected || isInExcludedRegion(node) || classifyText(source(node)) === null) {
        // Un texte retiré ou exclu revient en français : un nœud remis plus tard dans la page ne garde pas l'éton.
        renderer?.restore(node);
        tracked.delete(node);
        queue.delete(node);
      }
    }
    for (const slot of trackedAttributes.keys()) {
      const { element, name } = slot;
      if (!element.isConnected || !element.hasAttribute(name) || isAttributeExcluded(element) || classifyText(source(slot)) === null) {
        attributeRenderer?.restore(slot);
        trackedAttributes.delete(slot);
        queue.delete(slot);
      }
    }
  };

  const evaluate = (): void => {
    if (!engine || queue.size === 0) return;
    const nodes: Target[] = [];
    for (const node of queue) {
      queue.delete(node);
      if (isConnected(node) && entryOf(node)) nodes.push(node);
      if (nodes.length >= budget) break;
    }
    const requests: TranslationRequest[] = nodes.map((node) => ({
      text: source(node),
      sourceLang: 'auto',
      targetLang: 'eto',
      context: isSlot(node) ? { role: ATTRIBUTE_ROLES[node.name], live: isLive(node.element), ...page } : contextOf(node, page),
    }));
    let results: readonly TranslationResult[] = [];
    try {
      results = engine.translateMany(requests);
    } catch {
      results = [];
    }
    // Lot incomplet : la correspondance entre requêtes et résultats n'est plus sûre, tout le lot est écarté.
    const aligned = results.length === nodes.length;
    let invalid = 0;
    let shown = 0;
    let refused = 0;
    nodes.forEach((node, i) => {
      const result = aligned ? results[i] : undefined;
      const entry = entryOf(node);
      if (!entry) return;
      if (result && STATUSES.has(result.status)) {
        entry.status = result.status;
        entry.unverifiedKind = result.status === 'PENDING_VALIDATION' ? result.unverifiedKind : null;
        entry.result = result;
        entry.evaluated = requests[i]?.text ?? null;
      } else {
        invalid++;
      }
      sync(node, entry);
      if (entry.shown) shown++;
      if (entry.refused) refused++;
    });
    logger.event('content:evaluate', { texts: nodes.length, invalid, remaining: queue.size });
    if (render) logger.event('content:render', { texts: nodes.length, shown, refused });
    if (queue.size > 0 && !drainScheduled) {
      drainScheduled = true;
      schedule(drain);
    }
  };

  const drain = (): void => {
    drainScheduled = false;
    if (!active) return;
    evaluate();
    options.onUpdate?.();
  };

  const process = (roots: readonly Node[], attributeTargets: readonly Element[] = []): void => {
    const previousStep = page.step;
    const sourceOf = renderer ? textSource : undefined;
    page = readPageContext(doc, sourceOf);
    let candidates = 0;
    let numeric = 0;
    let values = 0;
    const visit = (target: Target, kind: TextKind): void => {
      const rendering = isSlot(target) ? attributeRenderer : renderer;
      if (rendering) {
        const ownership = isSlot(target) ? attributeRenderer?.ownership(target) : renderer?.ownership(target);
        // Notre propre écriture (5.3) : ni réévaluée, ni retraduite.
        if (ownership === 'ours') return;
        // L'application a remplacé notre écriture (5.4) : son texte devient l'original.
        if (ownership === 'changed') {
          if (isSlot(target)) attributeRenderer?.release(target);
          else renderer?.release(target);
        }
        // Texte déjà évalué et inchangé (notre propre restauration, ou l'application qui remet le même
        // français) : son résultat est réappliqué, sans nouvelle évaluation.
        const entry = entryOf(target);
        if (entry && entry.kind === kind && entry.result && entry.evaluated === raw(target)) {
          sync(target, entry);
          return;
        }
      }
      register(target, kind);
      if (kind === 'candidate') candidates++;
      else if (kind === 'value') values++;
      else numeric++;
    };
    const visitAttribute = (slot: AttrSlot): void => {
      // Une valeur que nous avons écrite est classée sur son original (français).
      const kind = classifyAttribute(slot, source(slot), options.isEcho, sourceOf);
      if (kind) visit(slot, kind);
    };
    for (const root of roots) {
      scanTexts(root, visit, options.isEcho, sourceOf);
      scanAttributes(root, visitAttribute);
    }
    for (const element of attributeTargets) scanAttributes(element, visitAttribute, false);
    forget();
    // L'étape ne sert qu'à départager : un changement d'étape fait réévaluer les textes déjà suivis.
    if (engine && page.step !== previousStep) {
      for (const [node, entry] of tracked) if (entry.kind === 'candidate') queue.add(node);
      for (const [slot, entry] of trackedAttributes) if (entry.kind === 'candidate') queue.add(slot);
    }
    logger.event('content:scan', {
      roots: roots.length, candidates, numeric, values, tracked: tracked.size, attributes: trackedAttributes.size, step: page.step ?? 0,
    });
    evaluate();
    options.onUpdate?.();
  };

  const body = doc.body;
  if (body) process([body]);
  const watcher = body ? watchMutations(body, (roots, attributeTargets) => active && process(roots, attributeTargets), schedule) : null;

  function* entries(): Generator<readonly [Text, Tracked]> {
    for (const [node, entry] of tracked) if (node.isConnected) yield [node, entry] as const;
  }

  return {
    entries,
    counts: () => countEntries([
      ...[...entries()].map(([, entry]) => entry),
      ...[...trackedAttributes].filter(([slot]) => slot.element.isConnected).map(([, entry]) => entry),
    ]),
    step: () => page.step,
    refresh() {
      if (!active || !render) return;
      for (const [node, entry] of tracked) if (node.isConnected) sync(node, entry);
      for (const [slot, entry] of trackedAttributes) if (slot.element.isConnected) sync(slot, entry);
      options.onUpdate?.();
    },
    stop() {
      active = false;
      watcher?.stop();
      if (renderer) logger.event('content:restore', { restored: renderer.restoreAll(), attributes: attributeRenderer?.restoreAll() ?? 0 });
      tracked.clear();
      trackedAttributes.clear();
      queue.clear();
    },
  };
}
