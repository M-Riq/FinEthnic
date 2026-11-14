// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { initPopup, type RequestDiagnostic } from '../../src/popup/popup';
import type { Logger } from '../../src/shared/logger';
import { COUNT_KEYS, DIAGNOSTIC_RESULT, type DiagnosticSnapshot } from '../../src/shared/messages';
import { createSettingsStore, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage, flush } from './support/fake-storage';
import { recorder } from './support/page';

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

describe('popup — rapport de diagnostic (P2.6)', () => {
  const snapshot = (patch: Partial<DiagnosticSnapshot> = {}): DiagnosticSnapshot => ({
    type: DIAGNOSTIC_RESULT,
    enabled: true,
    engine: 'fake',
    step: 2,
    counts: { candidates: 12, numeric: 3, waiting: 0, approved: 4, unverified: 2, partial: 1, untranslated: 1, noMatch: 2, ambiguous: 1, protected: 1 },
    ...patch,
  });

  async function openReport(initial: Record<string, unknown>, request: RequestDiagnostic) {
    const doc = new DOMParser().parseFromString(HTML, 'text/html');
    const fake = createFakeStorage({ [SETTINGS_KEY]: initial });
    const log = recorder();
    await initPopup(doc, createSettingsStore(fake.storage), log.logger, request);
    await flush();
    const cell = (key: string) => doc.querySelector(`[data-count="${key}"], [data-field="${key}"]`)?.textContent;
    return {
      doc,
      fake,
      cell,
      named: log.named,
      report: doc.getElementById('report')!,
      status: doc.getElementById('report-status')!,
      counts: doc.getElementById('report-counts')!,
      toggle: doc.querySelector<HTMLButtonElement>('#diagnostic')!,
      refresh: doc.querySelector<HTMLButtonElement>('#report-refresh')!,
    };
  }

  it('propose un second interrupteur et un tableau pour chaque compteur', () => {
    const doc = new DOMParser().parseFromString(HTML, 'text/html');
    const toggle = doc.querySelectorAll('button[role="switch"]')[1]!;
    expect(toggle.id).toBe('diagnostic');
    expect(toggle.textContent?.trim()).toBe('Mode diagnostic');
    expect(doc.getElementById('report')!.hidden).toBe(true);
    expect(doc.getElementById('report-status')!.getAttribute('role')).toBe('status');
    for (const key of COUNT_KEYS) expect(doc.querySelectorAll(`#report-counts [data-count="${key}"]`)).toHaveLength(1);
  });

  it('reste masqué et silencieux hors mode diagnostic', async () => {
    const request = vi.fn(async () => snapshot());
    const { report } = await openReport({}, request);
    expect(report.hidden).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('affiche les compteurs de la page quand le mode est activé', async () => {
    const request = vi.fn(async () => snapshot());
    const { report, toggle, status, counts, cell, named } = await openReport({}, request);
    toggle.click();
    await flush();
    expect(report.hidden).toBe(false);
    expect(request).toHaveBeenCalledOnce();
    expect(counts.hidden).toBe(false);
    expect(status.textContent).toBe('12 texte(s) à traduire détecté(s) dans la page.');
    expect(cell('approved')).toBe('4');
    expect(cell('numeric')).toBe('3');
    expect(cell('step')).toBe('2 sur 5');
    expect(cell('engine')).toBe('faux moteur de test');
    expect(named('popup:diagnostic')).toEqual([{ available: true }]);
  });

  it.each([
    ['aucune réponse', () => Promise.reject(new Error('Could not establish connection'))],
    ['réponse nulle', async () => null],
    ['réponse invalide', async () => ({ ...snapshot(), counts: { approved: -1 } })],
  ])('signale un diagnostic indisponible (%s)', async (_, request) => {
    const { status, counts, named } = await openReport({ diagnostic: true }, request);
    expect(status.textContent).toMatch(/^Diagnostic indisponible dans cet onglet/);
    expect(counts.hidden).toBe(true);
    expect(named('popup:diagnostic')).toEqual([{ available: false }]);
  });

  it('indique une traduction désactivée et une étape inconnue', async () => {
    const disabled = await openReport({ diagnostic: true }, async () => snapshot({ enabled: false }));
    expect(disabled.status.textContent).toBe("La traduction est désactivée : la page n'est pas analysée.");
    expect(disabled.counts.hidden).toBe(true);

    const unknown = await openReport({ diagnostic: true }, async () => snapshot({ step: 0, engine: 'none' }));
    expect(unknown.cell('step')).toBe('inconnue');
    expect(unknown.cell('engine')).toBe('aucun (version sans moteur)');
  });

  it('relit la page sur demande, une seule fois à la fois, et quand la traduction change', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const request = vi.fn(() => new Promise<unknown>((resolve) => (answer = resolve)));
    const { refresh, fake, cell } = await openReport({ diagnostic: true }, request);
    answer(snapshot());
    await flush();

    refresh.click();
    expect(refresh.getAttribute('aria-busy')).toBe('true');
    refresh.click();
    answer(snapshot({ counts: { ...snapshot().counts, approved: 7 } }));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(cell('approved')).toBe('7');
    expect(refresh.hasAttribute('aria-busy')).toBe(false);

    fake.emit({ [SETTINGS_KEY]: { newValue: { diagnostic: true, enabled: false } } });
    expect(request).toHaveBeenCalledTimes(3);
  });
});
