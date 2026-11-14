import { describe, expect, it, vi } from 'vitest';
import { createSettingsStore, DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage, flush } from './support/fake-storage';

describe('parseSettings', () => {
  it('donne les valeurs par défaut, dont showUnverified = true (Q9, contrat §5.4)', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}]) {
      expect(parseSettings(raw)).toEqual({
        enabled: true,
        displayMode: 'replace',
        diagnostic: false,
        showUnverified: true,
      });
    }
  });

  it('garde les champs valides et remplace chaque champ invalide par sa valeur par défaut', () => {
    expect(
      parseSettings({ enabled: false, displayMode: 'bilingual', diagnostic: 'oui', showUnverified: 0, extra: 1 }),
    ).toEqual({ enabled: false, displayMode: 'bilingual', diagnostic: false, showUnverified: true });
    expect(parseSettings({ displayMode: 'autre' }).displayMode).toBe('replace');
  });
});

describe('createSettingsStore', () => {
  it('lit les réglages enregistrés sous une seule clé', async () => {
    const fake = createFakeStorage({ [SETTINGS_KEY]: { enabled: false } });
    expect(await createSettingsStore(fake.storage).load()).toEqual({ ...DEFAULT_SETTINGS, enabled: false });
  });

  it('fusionne une modification avec l’état enregistré et la conserve pour le prochain chargement', async () => {
    const fake = createFakeStorage({ [SETTINGS_KEY]: { diagnostic: true } });
    const store = createSettingsStore(fake.storage);
    expect(await store.update({ enabled: false })).toEqual({ ...DEFAULT_SETTINGS, enabled: false, diagnostic: true });
    expect(await createSettingsStore(fake.storage).load()).toEqual({
      ...DEFAULT_SETTINGS,
      enabled: false,
      diagnostic: true,
    });
    expect([...fake.data.keys()]).toEqual([SETTINGS_KEY]);
  });

  it('traite les modifications simultanées l’une après l’autre, sans en perdre', async () => {
    const fake = createFakeStorage();
    const store = createSettingsStore(fake.storage);
    await Promise.all([store.update({ enabled: false }), store.update({ diagnostic: true }), store.update({ showUnverified: false })]);
    expect(await store.load()).toEqual({ enabled: false, displayMode: 'replace', diagnostic: true, showUnverified: false });
  });

  it('signale un échec d’écriture sans bloquer les modifications suivantes', async () => {
    const fake = createFakeStorage();
    const store = createSettingsStore(fake.storage);
    fake.failNextSet();
    await expect(store.update({ enabled: false })).rejects.toThrow('quota');
    expect((await store.update({ diagnostic: true })).enabled).toBe(true);
  });

  it('notifie seulement les changements de la clé de réglages dans la zone local, et se désabonne', async () => {
    const fake = createFakeStorage();
    const store = createSettingsStore(fake.storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    fake.emit({ [SETTINGS_KEY]: { newValue: { enabled: false } } }, 'sync');
    fake.emit({ autre: { newValue: 1 } });
    expect(listener).not.toHaveBeenCalled();

    await store.update({ enabled: false });
    await flush();
    expect(listener).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_SETTINGS, enabled: false });

    unsubscribe();
    expect(fake.listenerCount()).toBe(0);
  });

  it('revient aux valeurs par défaut si la clé est supprimée', () => {
    const fake = createFakeStorage();
    const listener = vi.fn();
    createSettingsStore(fake.storage).subscribe(listener);
    fake.emit({ [SETTINGS_KEY]: {} });
    expect(listener).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});
