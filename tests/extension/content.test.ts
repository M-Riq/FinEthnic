// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startContent, type ContentController, type PageDeps } from '../../src/content/controller';
import { DIAGNOSTIC_CLASSES, highlightName, type HighlightApi } from '../../src/content/diagnostic';
import { acceptEngine, provideEngine } from '../../src/content/engine-provider';
import { createFakeEngine } from '../../src/content/fake-engine';
import { createMessageListener } from '../../src/content/messaging';
import { CONTRACT_VERSION } from '../../src/language/contract';
import { createLogger } from '../../src/shared/logger';
import { DIAGNOSTIC_REQUEST, isDiagnosticSnapshot } from '../../src/shared/messages';
import { createSettingsStore, DEFAULT_SETTINGS, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage, flush } from './support/fake-storage';
import { d8Texts, loadFixture, manualFrames, recorder, showStep } from './support/page';

const controllers: ContentController[] = [];
afterEach(() => controllers.splice(0).forEach((controller) => controller.stop()));

/** Faux registre `CSS.highlights` : textes surlignés par nom. */
function fakeHighlights() {
  const registry = new Map<string, readonly Range[]>();
  const api: HighlightApi = { set: (name, ranges) => void registry.set(name, ranges), delete: (name) => void registry.delete(name) };
  const texts = (name: string) => (registry.get(name) ?? []).map((range) => range.toString());
  return { registry, api, texts };
}

async function launch(initial: Record<string, unknown> = {}, page: Partial<PageDeps> = {}) {
  const fake = createFakeStorage({ [SETTINGS_KEY]: initial });
  const log = recorder();
  const frames = manualFrames();
  const highlights = fakeHighlights();
  const controller = await startContent(createSettingsStore(fake.storage), log.logger, {
    doc: document,
    engine: createFakeEngine(),
    schedule: frames.schedule,
    highlights: highlights.api,
    ...page,
  });
  controllers.push(controller);
  const update = async (patch: Record<string, unknown>) => {
    await createSettingsStore(fake.storage).update(patch);
    await frames.frames();
  };
  return { controller, fake, frames, highlights, update, ...log };
}

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

describe('script de contenu : réglages (P1.5)', () => {
  it('lit les réglages au démarrage et suit leurs changements', async () => {
    loadFixture(document, 1);
    const { controller, fake, events } = await launch({ enabled: false }, { engine: null, highlights: null });

    expect(controller.settings.enabled).toBe(false);
    expect(events).toEqual([['content:start', { enabled: false, engine: false, fake: false }]]);

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
    loadFixture(document, 2);
    const { fake, frames, events } = await launch();
    fake.emit({ [SETTINGS_KEY]: { newValue: { diagnostic: true } } });
    showStep(document, 3);
    await frames.frames();
    expect(events.map(([name]) => name)).toEqual(
      expect.arrayContaining(['content:start', 'content:scan', 'content:evaluate', 'content:settings-changed']),
    );
    for (const [, data] of events) {
      for (const value of Object.values(data ?? {})) expect(['boolean', 'number']).toContain(typeof value);
    }
  });
});

describe('script de contenu : lecture de la page et diagnostic (P2)', () => {
  it('n’analyse pas la page tant que la traduction est désactivée', async () => {
    loadFixture(document, 1);
    const { controller, named, update } = await launch({ enabled: false });
    expect(named('content:scan')).toEqual([]);
    expect(controller.snapshot()).toMatchObject({ enabled: false, engine: 'fake', step: 0, counts: { candidates: 0 } });

    await update({ enabled: true });
    expect(named('content:scan')).toHaveLength(1);
    expect(controller.snapshot()).toMatchObject({ enabled: true, step: 1 });
    expect(controller.snapshot().counts.candidates).toBeGreaterThan(0);

    await update({ enabled: false });
    expect(controller.snapshot().counts.candidates).toBe(0);
  });

  it('surligne chaque catégorie en mode diagnostic, sans les espaces de bord', async () => {
    loadFixture(document, 4);
    const { highlights, update } = await launch({ diagnostic: true });
    expect(highlights.texts('finethnic-approved')).toEqual(['Frais']);
    expect(highlights.texts('finethnic-unverified')).toEqual(['Montant', 'Total débité', 'Bénéficiaire', 'Confirmer le transfert']);
    expect(highlights.texts('finethnic-untranslated')).toEqual(['Récapitulatif', 'Référence']);
    expect(highlights.texts('finethnic-numeric')).toEqual(['+237 6 99 12 34 56']);
    expect(highlights.texts('finethnic-protected')).toEqual(expect.arrayContaining(['25 000 FCFA', 'SAF-2026-OTCUQ3']));
    expect(highlights.texts('finethnic-no-match')).toContain('Jean-Paul Mbarga');
    expect(highlights.registry.has('finethnic-partial')).toBe(false);

    // Le surlignage suit la page monopage, puis disparaît avec le mode diagnostic.
    showStep(document, 1);
    await update({});
    expect(highlights.texts('finethnic-partial')).toEqual(['Consultez votre solde', 'Effectuer un transfert']);
    await update({ diagnostic: false });
    expect(highlights.registry.size).toBe(0);
  });

  it('T-PRO-12 — ne modifie jamais la page (aucune mutation, HTML identique)', async () => {
    loadFixture(document, 4);
    const before = document.documentElement.outerHTML;
    const records: MutationRecord[] = [];
    const watcher = new MutationObserver((list) => records.push(...list));
    watcher.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

    const { controller, update } = await launch({ diagnostic: true });
    await update({ diagnostic: false });
    await update({ diagnostic: true, enabled: false });
    await update({ enabled: true });
    controller.stop();
    await flush();

    records.push(...watcher.takeRecords());
    watcher.disconnect();
    expect(records).toEqual([]);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('fournit un instantané fait seulement de compteurs', async () => {
    loadFixture(document, 5);
    const { controller } = await launch();
    const snapshot = controller.snapshot();
    expect(isDiagnosticSnapshot(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({ enabled: true, engine: 'fake', step: 5 });
    const serialized = JSON.stringify(snapshot);
    for (const { text } of d8Texts(5)) expect(serialized).not.toContain(text);
  });

  it('fonctionne sans moteur ni surlignage (version de production actuelle)', async () => {
    loadFixture(document, 2);
    const { controller } = await launch({ diagnostic: true }, { engine: null, highlights: null });
    const { counts, engine } = controller.snapshot();
    expect(engine).toBe('none');
    expect(counts.waiting).toBe(counts.candidates);
  });
});

describe('messages du popup (P2.6)', () => {
  const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

  it('répond aux seules demandes de diagnostic de l’extension', async () => {
    loadFixture(document, 1);
    const { controller } = await launch();
    const listener = createMessageListener(Promise.resolve(controller), EXTENSION_ID);
    const sendResponse = vi.fn();

    expect(listener({ type: DIAGNOSTIC_REQUEST }, { id: 'autre-extension' }, sendResponse)).toBe(false);
    expect(listener({ type: DIAGNOSTIC_REQUEST }, {}, sendResponse)).toBe(false);
    expect(listener({ type: 'autre' }, { id: EXTENSION_ID }, sendResponse)).toBe(false);
    expect(listener('finethnic:diagnostic', { id: EXTENSION_ID }, sendResponse)).toBe(false);
    await flush();
    expect(sendResponse).not.toHaveBeenCalled();

    expect(listener({ type: DIAGNOSTIC_REQUEST }, { id: EXTENSION_ID }, sendResponse)).toBe(true);
    await flush();
    expect(sendResponse).toHaveBeenCalledExactlyOnceWith(controller.snapshot());
  });

  it('répond selon les réglages enregistrés, même avant leur notification', async () => {
    loadFixture(document, 1);
    const { controller, fake } = await launch();
    const listener = createMessageListener(Promise.resolve(controller), EXTENSION_ID);
    const sendResponse = vi.fn();
    // Le popup a enregistré « désactivé », mais storage.onChanged n'est pas encore arrivé dans la page.
    fake.data.set(SETTINGS_KEY, { ...DEFAULT_SETTINGS, enabled: false });
    listener({ type: DIAGNOSTIC_REQUEST }, { id: EXTENSION_ID }, sendResponse);
    await flush();
    expect(sendResponse).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ enabled: false, step: 0 }));
    expect(controller.settings.enabled).toBe(false);
  });

  it('répond null si le script de contenu n’a pas pu démarrer', async () => {
    const listener = createMessageListener(Promise.reject(new Error('stockage')), EXTENSION_ID);
    const sendResponse = vi.fn();
    expect(listener({ type: DIAGNOSTIC_REQUEST }, { id: EXTENSION_ID }, sendResponse)).toBe(true);
    await flush();
    expect(sendResponse).toHaveBeenCalledExactlyOnceWith(null);
  });
});

describe('choix du moteur (P2.8)', () => {
  it('refuse un moteur d’une autre version du contrat ou défaillant (T-CON-07)', () => {
    const fake = createFakeEngine();
    expect(acceptEngine(fake)).toBe(fake);
    expect(acceptEngine({ ...fake, info: () => ({ ...fake.info(), contractVersion: '0.3.0' }) })).toBeNull();
    expect(
      acceptEngine({
        ...fake,
        info: () => {
          throw new Error('panne');
        },
      }),
    ).toBeNull();
    expect(fake.info().contractVersion).toBe(CONTRACT_VERSION);
  });

  it('ne fournit aucun moteur hors construction de développement', () => {
    expect(provideEngine()).toBeNull();
  });
});

describe('styles du diagnostic', () => {
  const read = (file: string) => readFileSync(path.join(import.meta.dirname, '../..', file), 'utf8');

  it('chaque catégorie a un style dans la page et une légende dans le popup', () => {
    const css = read('src/content/content.css');
    const legend = read('src/popup/popup.html');
    for (const cls of DIAGNOSTIC_CLASSES) {
      const name = highlightName(cls);
      expect(css).toContain(`::highlight(${name})`);
      expect(legend).toContain(`key-${name.replace('finethnic-', '')}`);
      expect(legend).toContain(`data-count="${cls}"`);
    }
  });
});
