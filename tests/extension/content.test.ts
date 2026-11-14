import { describe, expect, it, vi } from 'vitest';
import { startContent } from '../../src/content/controller';
import { createLogger, type LogData, type LogEvent } from '../../src/shared/logger';
import { createSettingsStore, DEFAULT_SETTINGS, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage, flush } from './support/fake-storage';

const recorder = () => {
  const events: Array<[LogEvent, LogData | undefined]> = [];
  return { events, logger: { event: (name: LogEvent, data?: LogData) => void events.push([name, data]) } };
};

describe('journal sans données (P1.6)', () => {
  it('n’écrit rien hors construction de développement', () => {
    const sink = vi.fn();
    createLogger('content', { sink }).event('content:start', { enabled: true });
    expect(sink).not.toHaveBeenCalled();
  });

  it('écrit le nom de l’événement et des compteurs quand il est actif', () => {
    const sink = vi.fn();
    createLogger('popup', { enabled: true, sink }).event('popup:open', { enabled: false, count: 2 });
    expect(sink).toHaveBeenCalledExactlyOnceWith('[FinEthnic:popup] popup:open', { enabled: false, count: 2 });
  });

  it('refuse toute chaîne au niveau des types (aucun texte de page)', () => {
    const logger = createLogger('content', { sink: () => undefined });
    // @ts-expect-error — une chaîne pourrait contenir du texte de la page.
    logger.event('content:start', { text: 'Solde' });
    // @ts-expect-error — seuls les événements connus sont acceptés.
    logger.event('Solde disponible');
  });
});

describe('script de contenu P1 (sans lecture de la page)', () => {
  it('lit les réglages au démarrage et suit leurs changements', async () => {
    const fake = createFakeStorage({ [SETTINGS_KEY]: { enabled: false } });
    const { events, logger } = recorder();
    const controller = await startContent(createSettingsStore(fake.storage), logger);

    expect(controller.settings.enabled).toBe(false);
    expect(events).toEqual([['content:start', { enabled: false }]]);

    await createSettingsStore(fake.storage).update({ enabled: true, displayMode: 'bilingual' });
    await flush();
    expect(controller.settings).toEqual({ ...DEFAULT_SETTINGS, displayMode: 'bilingual' });
    expect(events[1]).toEqual([
      'content:settings-changed',
      { enabled: true, bilingual: true, diagnostic: false, showUnverified: true },
    ]);

    controller.stop();
    expect(fake.listenerCount()).toBe(0);
  });

  it('ne journalise que des booléens et des nombres', async () => {
    const fake = createFakeStorage();
    const { events, logger } = recorder();
    await startContent(createSettingsStore(fake.storage), logger);
    fake.emit({ [SETTINGS_KEY]: { newValue: { diagnostic: true } } });
    for (const [, data] of events) {
      for (const value of Object.values(data ?? {})) expect(['boolean', 'number']).toContain(typeof value);
    }
  });
});
