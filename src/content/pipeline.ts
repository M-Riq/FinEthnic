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
 */
import type { TranslationEngine, TranslationRequest, TranslationResult, TranslationStatus } from '../language/contract';
import { isInExcludedRegion } from '../protection/dom-guard';
import type { Logger } from '../shared/logger';
import type { CountKey } from '../shared/messages';
import { contextOf, readPageContext, type PageContext, type Step } from './context';
import { countEntries, type Tracked } from './diagnostic';
import { watchMutations, type Schedule } from './observer';
import { decide, KEEP, type DisplaySettings, type Renderer } from './renderer';
import { classifyText, scanTexts, type EchoCheck, type TextKind } from './scanner';

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
  const budget = Math.max(1, options.budget ?? DEFAULT_BUDGET);
  const tracked = new Map<Text, Tracked>();
  const queue = new Set<Text>();
  let page: PageContext = {};
  let active = true;
  let drainScheduled = false;

  /** Texte d'origine : le français gardé par le rendu pour un texte affiché en éton, sinon le texte de la page. */
  const source = (node: Text): string => (renderer ? renderer.sourceOf(node) : node.data);

  const register = (node: Text, kind: TextKind): void => {
    tracked.set(node, { kind, status: null, unverifiedKind: null, result: null, evaluated: null, shown: null, refused: false });
    if (kind === 'candidate' && engine) queue.add(node);
    else queue.delete(node);
  };

  /** Affiche le dernier résultat d'un texte, ou remet son original. */
  const sync = (node: Text, entry: Tracked): void => {
    if (!render || !renderer) return;
    const current = source(node);
    // Un résultat ne s'applique qu'au texte évalué : si l'application l'a changé depuis, on garde l'original.
    const decision =
      entry.kind === 'candidate' && entry.result && entry.evaluated === current ? decide(current, entry.result, render.settings()) : KEEP;
    entry.refused = decision.action === 'refuse';
    if (decision.action === 'write') {
      renderer.write(node, decision.text, decision.display);
      entry.shown = decision.display;
    } else {
      renderer.restore(node);
      entry.shown = null;
    }
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
  };

  const evaluate = (): void => {
    if (!engine || queue.size === 0) return;
    const nodes: Text[] = [];
    for (const node of queue) {
      queue.delete(node);
      if (node.isConnected && tracked.has(node)) nodes.push(node);
      if (nodes.length >= budget) break;
    }
    const requests: TranslationRequest[] = nodes.map((node) => ({
      text: source(node),
      sourceLang: 'auto',
      targetLang: 'eto',
      context: contextOf(node, page),
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
      const entry = tracked.get(node);
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

  const process = (roots: readonly Node[]): void => {
    const previousStep = page.step;
    page = readPageContext(doc, renderer ? source : undefined);
    let candidates = 0;
    let numeric = 0;
    let values = 0;
    for (const root of roots) {
      scanTexts(
        root,
        (node, kind) => {
          if (renderer) {
            const ownership = renderer.ownership(node);
            // Notre propre écriture (5.3) : ni réévaluée, ni retraduite.
            if (ownership === 'ours') return;
            // L'application a remplacé notre écriture (5.4) : son texte devient l'original.
            if (ownership === 'changed') renderer.release(node);
            // Texte déjà évalué et inchangé (notre propre restauration, ou l'application qui remet le même
            // français) : son résultat est réappliqué, sans nouvelle évaluation.
            const entry = tracked.get(node);
            if (entry && entry.kind === kind && entry.result && entry.evaluated === node.data) {
              sync(node, entry);
              return;
            }
          }
          register(node, kind);
          if (kind === 'candidate') candidates++;
          else if (kind === 'value') values++;
          else numeric++;
        },
        options.isEcho,
        renderer ? source : undefined,
      );
    }
    forget();
    // L'étape ne sert qu'à départager : un changement d'étape fait réévaluer les textes déjà suivis.
    if (engine && page.step !== previousStep) {
      for (const [node, entry] of tracked) if (entry.kind === 'candidate') queue.add(node);
    }
    logger.event('content:scan', { roots: roots.length, candidates, numeric, values, tracked: tracked.size, step: page.step ?? 0 });
    evaluate();
    options.onUpdate?.();
  };

  const body = doc.body;
  if (body) process([body]);
  const watcher = body ? watchMutations(body, (roots) => active && process(roots), schedule) : null;

  function* entries(): Generator<readonly [Text, Tracked]> {
    for (const [node, entry] of tracked) if (node.isConnected) yield [node, entry] as const;
  }

  return {
    entries,
    counts: () => countEntries([...entries()].map(([, entry]) => entry)),
    step: () => page.step,
    refresh() {
      if (!active || !render) return;
      for (const [node, entry] of tracked) if (node.isConnected) sync(node, entry);
      options.onUpdate?.();
    },
    stop() {
      active = false;
      watcher?.stop();
      if (renderer) logger.event('content:restore', { restored: renderer.restoreAll() });
      tracked.clear();
      queue.clear();
    },
  };
}
