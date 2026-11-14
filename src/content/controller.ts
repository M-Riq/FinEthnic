/**
 * Cycle de vie du script de contenu.
 *
 * P1 : aucune lecture ni modification de la page. Le script lit les réglages, puis suit leurs
 * changements (popup ⇄ page) et les consigne dans le journal, sans aucun contenu de page.
 */
import type { Logger } from '../shared/logger';
import type { Settings, SettingsStore } from '../shared/settings';

export interface ContentController {
  readonly settings: Settings;
  stop(): void;
}

export async function startContent(store: SettingsStore, logger: Logger): Promise<ContentController> {
  let settings = await store.load();
  logger.event('content:start', { enabled: settings.enabled });
  const unsubscribe = store.subscribe((next) => {
    settings = next;
    logger.event('content:settings-changed', {
      enabled: next.enabled,
      bilingual: next.displayMode === 'bilingual',
      diagnostic: next.diagnostic,
      showUnverified: next.showUnverified,
    });
  });
  return {
    get settings() {
      return settings;
    },
    stop: unsubscribe,
  };
}
