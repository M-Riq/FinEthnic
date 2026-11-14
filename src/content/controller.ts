/**
 * Cycle de vie du script de contenu.
 *
 * P2 : quand la traduction est activée, la page est scannée puis observée, chaque texte est évalué par
 * le moteur fourni (faux moteur en développement) et compté par statut. Le mode diagnostic surligne les
 * textes sans toucher au DOM.
 * P3 : les textes en position « valeur » et les échos de saisie ne sont jamais soumis au moteur.
 * P5 : les traductions affichables sont écrites dans la page (`renderer.ts`), les non vérifiées portent un
 * marqueur, et le français s'affiche au survol et au focus (`tooltip.ts`). Désactiver la traduction rend
 * à la page tous ses textes d'origine ; changer une option d'affichage s'applique sans réévaluer.
 * Phase 4 : les textes évalués sont proposés à la couche corpus (D8 enrichi, `corpus-sync.ts`) ; quand le
 * moteur apprend de nouvelles entrées, les textes pas encore traduits entièrement sont réévalués.
 */
import type { Lexicon } from '../engine/lexicon';
import type { TranslationEngine } from '../language/contract';
import { createEchoGuard, type EchoGuard } from '../protection/echo';
import type { Logger } from '../shared/logger';
import { COUNT_KEYS, DIAGNOSTIC_RESULT, type DiagnosticSnapshot, type EngineKind } from '../shared/messages';
import type { Settings, SettingsStore } from '../shared/settings';
import type { PageCorpus } from './corpus-sync';
import { clearHighlights, clearMarks, paintHighlights, paintMarks, type HighlightApi } from './diagnostic';
import type { Schedule } from './observer';
import { startPipeline, type Pipeline } from './pipeline';
import { createRenderer, type Renderer } from './renderer';
import { createTooltip, type Tooltip, type TooltipItem } from './tooltip';

export interface PageDeps {
  doc: Document;
  engine: TranslationEngine | null;
  schedule: Schedule;
  /** Registre `CSS.highlights`, ou `null` s'il n'est pas pris en charge. */
  highlights: HighlightApi | null;
  budget?: number;
  /** Lexique français du moteur (classification des textes). */
  lexicon?: Lexicon;
  /** Couche corpus D8 (enrichissement local), ou `null` sans vrai moteur. */
  corpus?: PageCorpus | null;
}

export interface ContentController {
  readonly settings: Settings;
  /** Compteurs du diagnostic, sans aucun texte de la page. */
  snapshot(): DiagnosticSnapshot;
  /**
   * Relit d'abord les réglages enregistrés : le popup peut enregistrer un réglage puis demander les compteurs
   * avant que `storage.onChanged` n'arrive dans la page.
   */
  freshSnapshot(): Promise<DiagnosticSnapshot>;
  stop(): void;
}

function engineKind(engine: TranslationEngine | null): EngineKind {
  try {
    return engine ? engine.info().engineId : 'none';
  } catch {
    return 'none';
  }
}

export async function startContent(store: SettingsStore, logger: Logger, page: PageDeps): Promise<ContentController> {
  let settings = await store.load();
  let pipeline: Pipeline | null = null;
  let echo: EchoGuard | null = null;
  let renderer: Renderer | null = null;
  let tooltip: Tooltip | null = null;
  let stopped = false;
  /** Options d'affichage appliquées à la page, pour ne réafficher que si elles changent. */
  let shownWith = { showUnverified: settings.showUnverified, displayMode: settings.displayMode };
  const engine = engineKind(page.engine);
  logger.event('content:start', { enabled: settings.enabled, engine: engine !== 'none', fake: engine === 'fake' });

  const paint = (): void => {
    if (!page.highlights || !pipeline) return;
    paintMarks(page.highlights, pipeline.entries());
    if (settings.diagnostic) paintHighlights(page.highlights, pipeline.entries());
  };

  /** Textes affichés en éton sous un élément, pour l'infobulle. */
  const describe = (target: Element, deep: boolean): TooltipItem[] => {
    const items: TooltipItem[] = [];
    if (!renderer) return items;
    for (const [node, written] of renderer.entries()) {
      if (deep ? target.contains(node) : node.parentNode === target) items.push(written);
    }
    return items;
  };

  const halt = (): void => {
    tooltip?.stop();
    tooltip = null;
    pipeline?.stop();
    pipeline = null;
    renderer = null;
    echo?.stop();
    echo = null;
    if (page.highlights) clearMarks(page.highlights);
  };

  const apply = (): void => {
    const display = { showUnverified: settings.showUnverified, displayMode: settings.displayMode };
    const displayChanged = display.showUnverified !== shownWith.showUnverified || display.displayMode !== shownWith.displayMode;
    shownWith = display;
    if (settings.enabled && !pipeline) {
      echo = createEchoGuard(page.doc);
      const current = createRenderer();
      renderer = current;
      pipeline = startPipeline({
        doc: page.doc,
        engine: page.engine,
        schedule: page.schedule,
        logger,
        isEcho: echo.isEcho,
        onUpdate: paint,
        render: { renderer: current, settings: () => shownWith },
        ...(page.budget === undefined ? {} : { budget: page.budget }),
        ...(page.lexicon ? { lexicon: page.lexicon } : {}),
        ...(page.corpus ? { onEvaluated: page.corpus.offer } : {}),
      });
      tooltip = createTooltip(page.doc, describe);
    } else if (!settings.enabled && pipeline) {
      halt();
    } else if (pipeline && displayChanged) {
      pipeline.refresh();
    }
    // Sans chaîne de lecture (traduction désactivée), aucun surlignage ne doit rester dans la page.
    if ((!settings.diagnostic || !pipeline) && page.highlights) clearHighlights(page.highlights);
    paint();
  };

  apply();
  const unlearn = page.corpus?.subscribe(() => pipeline?.reevaluate()) ?? (() => undefined);
  const unsubscribe = store.subscribe((next) => {
    settings = next;
    logger.event('content:settings-changed', {
      enabled: next.enabled,
      bilingual: next.displayMode === 'bilingual',
      diagnostic: next.diagnostic,
      showUnverified: next.showUnverified,
    });
    apply();
  });

  const snapshot = (): DiagnosticSnapshot => ({
    type: DIAGNOSTIC_RESULT,
    enabled: settings.enabled,
    engine,
    step: pipeline?.step() ?? 0,
    counts: pipeline ? pipeline.counts() : (Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as DiagnosticSnapshot['counts']),
  });

  return {
    get settings() {
      return settings;
    },
    snapshot,
    async freshSnapshot() {
      const latest = await store.load().catch(() => settings);
      const changed = (Object.keys(latest) as Array<keyof Settings>).some((key) => latest[key] !== settings[key]);
      if (!stopped && changed) {
        settings = latest;
        apply();
      }
      return snapshot();
    },
    stop() {
      stopped = true;
      unsubscribe();
      unlearn();
      halt();
      if (page.highlights) clearHighlights(page.highlights);
    },
  };
}
