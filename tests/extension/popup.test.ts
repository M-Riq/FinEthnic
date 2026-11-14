// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initPopup } from '../../src/popup/popup';
import type { Logger } from '../../src/shared/logger';
import { createSettingsStore, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage, flush } from './support/fake-storage';

// Sous jsdom, un `URL` n'est pas accepté par `node:fs` : on passe par un chemin de fichier.
const HTML = readFileSync(path.join(import.meta.dirname, '../../src/popup/popup.html'), 'utf8');
const silent: Logger = { event: () => undefined };

async function open(initial: Record<string, unknown> = {}) {
  const doc = new DOMParser().parseFromString(HTML, 'text/html');
  const fake = createFakeStorage(initial);
  const detach = await initPopup(doc, createSettingsStore(fake.storage), silent);
  const button = doc.querySelector<HTMLButtonElement>('#enabled')!;
  const state = doc.getElementById('enabled-state')!;
  const error = doc.getElementById('error')!;
  return { doc, fake, detach, button, state, error };
}

describe('popup — structure accessible (P1.4)', () => {
  const doc = new DOMParser().parseFromString(HTML, 'text/html');

  it('est en français et sans script en ligne (CSP MV3)', () => {
    expect(doc.documentElement.lang).toBe('fr');
    for (const script of doc.querySelectorAll('script')) {
      expect(script.getAttribute('src')).toBe('popup.js');
      expect(script.textContent).toBe('');
    }
    expect(HTML).not.toMatch(/\son[a-z]+\s*=/i);
    expect(HTML).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
  });

  it('expose un interrupteur nommé, natif au clavier, dont l’état est annoncé', () => {
    const button = doc.querySelector('button[role="switch"]')!;
    expect(button.id).toBe('enabled');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent?.trim()).toBe('Traduction en éton');
    expect(doc.getElementById(button.getAttribute('aria-describedby')!)?.getAttribute('aria-live')).toBe('polite');
    // Jamais `disabled` : un bouton désactivé perd le focus clavier (constaté dans Chrome).
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('popup — comportement', () => {
  it('affiche l’état enregistré (activé par défaut)', async () => {
    const { button, state } = await open();
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(state.textContent).toBe(state.dataset['on']);
  });

  it('affiche un état désactivé enregistré', async () => {
    const { button, state } = await open({ [SETTINGS_KEY]: { enabled: false } });
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(state.textContent).toBe(state.dataset['off']);
  });

  it('bascule et enregistre l’état à chaque activation', async () => {
    const { button, fake } = await open();
    button.click();
    await flush();
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(fake.data.get(SETTINGS_KEY)).toMatchObject({ enabled: false });

    button.click();
    await flush();
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(fake.data.get(SETTINGS_KEY)).toMatchObject({ enabled: true });
  });

  it('reste focalisable pendant l’enregistrement et ignore une activation en double', async () => {
    const { button, fake } = await open();
    button.click();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    await flush();
    expect(fake.setCalls()).toBe(1);
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('garde l’état précédent et affiche une alerte si l’écriture échoue', async () => {
    const { button, error, fake } = await open();
    fake.failNextSet();
    button.click();
    await flush();
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(error.hidden).toBe(false);

    button.click();
    await flush();
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(error.hidden).toBe(true);
  });

  it('suit un changement fait ailleurs, puis s’en détache', async () => {
    const { button, fake, detach } = await open();
    fake.emit({ [SETTINGS_KEY]: { newValue: { enabled: false } } });
    expect(button.getAttribute('aria-checked')).toBe('false');
    detach();
    expect(fake.listenerCount()).toBe(0);
  });
});
