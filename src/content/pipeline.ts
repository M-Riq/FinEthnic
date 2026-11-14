/**
 * Chaîne de lecture (P2) : scan initial, observation des mutations, évaluation par le moteur, compteurs.
 *
 * Lecture seule : aucun nœud, attribut ni texte de la page n'est modifié. Les textes suivis et leur statut
 * restent en mémoire, dans cette chaîne ; ils ne sont ni journalisés, ni rangés, ni transmis.
 */
import type { TranslationEngine, TranslationRequest, TranslationResult, TranslationStatus } from '../language/contract';
import { isInExcludedRegion } from '../protection/dom-guard';
import type { Logger } from '../shared/logger';
import type { CountKey } from '../shared/messages';
import { contextOf, readPageContext, type PageContext, type Step } from './context';
import { countEntries, type Tracked } from './diagnostic';
import { watchMutations, type Schedule } from './observer';
import { classifyText, scanTexts, type TextKind } from './scanner';

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

export interface PipelineOptions {
  doc: Document;
  engine: TranslationEngine | null;
  schedule: Schedule;
  logger: Logger;
  budget?: number;
  /** Appelé après chaque lot (scan ou évaluation), par exemple pour mettre à jour le surlignage. */
  onUpdate?: () => void;
}

export interface Pipeline {
  /** Textes suivis encore présents dans la page. */
  entries(): Generator<readonly [Text, Tracked]>;
  counts(): Record<CountKey, number>;
  step(): Step | undefined;
  stop(): void;
}

export function startPipeline(options: PipelineOptions): Pipeline {
  const { doc, engine, schedule, logger } = options;
  const budget = Math.max(1, options.budget ?? DEFAULT_BUDGET);
  const tracked = new Map<Text, Tracked>();
  const queue = new Set<Text>();
  let page: PageContext = {};
  let active = true;
  let drainScheduled = false;

  const register = (node: Text, kind: TextKind): void => {
    tracked.set(node, { kind, status: null, unverifiedKind: null });
    if (kind === 'candidate' && engine) queue.add(node);
    else queue.delete(node);
  };

  const forget = (): void => {
    for (const node of tracked.keys()) {
      if (!node.isConnected || isInExcludedRegion(node) || classifyText(node.data) === null) {
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
      text: node.data,
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
    let invalid = 0;
    nodes.forEach((node, i) => {
      const result = results[i];
      const entry = tracked.get(node);
      if (!entry) return;
      if (result && STATUSES.has(result.status)) {
        entry.status = result.status;
        entry.unverifiedKind = result.status === 'PENDING_VALIDATION' ? result.unverifiedKind : null;
      } else {
        invalid++;
      }
    });
    logger.event('content:evaluate', { texts: nodes.length, invalid, remaining: queue.size });
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
    page = readPageContext(doc);
    let candidates = 0;
    let numeric = 0;
    for (const root of roots) {
      scanTexts(root, (node, kind) => {
        register(node, kind);
        if (kind === 'candidate') candidates++;
        else numeric++;
      });
    }
    forget();
    // L'étape ne sert qu'à départager : un changement d'étape fait réévaluer les textes déjà suivis.
    if (engine && page.step !== previousStep) {
      for (const [node, entry] of tracked) if (entry.kind === 'candidate') queue.add(node);
    }
    logger.event('content:scan', { roots: roots.length, candidates, numeric, tracked: tracked.size, step: page.step ?? 0 });
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
    stop() {
      active = false;
      watcher?.stop();
      tracked.clear();
      queue.clear();
    },
  };
}
