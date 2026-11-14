/**
 * Cycle de vie du script de contenu.
 *
 * P2 (lecture seule) : quand la traduction est activée, la page est scannée puis observée, chaque texte
 * est évalué par le moteur fourni (faux moteur en développement) et compté par statut. Le mode
 * diagnostic surligne les textes sans toucher au DOM. Rien n'est écrit dans la page avant P5.
 */
import type { TranslationEngine } from '../language/contract';
import type { Logger } from '../shared/logger';
import { COUNT_KEYS, DIAGNOSTIC_RESULT, type DiagnosticSnapshot, type EngineKind } from '../shared/messages';
import type { Settings, SettingsStore } from '../shared/settings';
import { clearHighlights, paintHighlights, type HighlightApi } from './diagnostic';
import type { Schedule } from './observer';
import { startPipeline, type Pipeline } from './pipeline';

export interface PageDeps {
  doc: Document;
  engine: TranslationEngine | null;
  schedule: Schedule;
  /** Registre `CSS.highlights`, ou `null` s'il n'est pas pris en charge. */
  highlights: HighlightApi | null;
  budget?: number;
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
  let stopped = false;
  const engine = engineKind(page.engine);
  logger.event('content:start', { enabled: settings.enabled, engine: engine !== 'none', fake: engine === 'fake' });

  const paint = (): void => {
    if (page.highlights && pipeline && settings.diagnostic) paintHighlights(page.highlights, pipeline.entries());
  };

  const apply = (): void => {
    if (settings.enabled && !pipeline) {
      pipeline = startPipeline({
        doc: page.doc,
        engine: page.engine,
        schedule: page.schedule,
        logger,
        onUpdate: paint,
        ...(page.budget === undefined ? {} : { budget: page.budget }),
      });
    } else if (!settings.enabled && pipeline) {
      pipeline.stop();
      pipeline = null;
    }
    if (pipeline && settings.diagnostic) paint();
    else if (page.highlights) clearHighlights(page.highlights);
  };

  apply();
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
      pipeline?.stop();
      pipeline = null;
      if (page.highlights) clearHighlights(page.highlights);
    },
  };
}
