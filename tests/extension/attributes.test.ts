// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanAttributes, slotOf, type AttrSlot } from '../../src/content/attributes';
import { createFakeEngine } from '../../src/content/fake-engine';
import { startPipeline, type Pipeline } from '../../src/content/pipeline';
import { createRenderer, type DisplaySettings } from '../../src/content/renderer';
import type { TranslationEngine, TranslationRequest } from '../../src/language/contract';
import { manualFrames, recorder } from './support/page';

const FAKE = '\u27E6FAKE\u27E7 ';
const SHOW: DisplaySettings = { showUnverified: true, displayMode: 'replace' };

/** Page sans la fixture D8 (qui n'a aucun attribut) : un formulaire avec des libellés en attribut. */
const PAGE = `
  <main data-step="2">
    <label>Montant <input id="field" placeholder="Montant" title="Frais" aria-label="Montant"></label>
    <button id="go" title="Continuer" aria-label="Continuer">Continuer</button>
    <div id="note" placeholder="Continuer" title="Frais de transfert"></div>
    <div hidden><button id="hidden-region" title="Continuer"></button></div>
    <input id="hidden-field" type="hidden" placeholder="Montant" title="Frais">
    <input id="masked" hidden placeholder="Montant">
    <svg aria-label="Continuer"></svg>
    <dl><dt>Solde</dt><dd id="balance" title="Frais">125 000 FCFA</dd></dl>
    <span id="number" title="125 000"></span>
    <span id="amount" title="Frais"></span>
  </main>`;

const names = (slots: AttrSlot[]) => slots.map((slot) => `${slot.element.id || slot.element.tagName.toLowerCase()}@${slot.name}`);

function spyEngine() {
  const fake = createFakeEngine();
  const requests: TranslationRequest[] = [];
  const engine: TranslationEngine = {
    info: fake.info,
    translate: fake.translate,
    translateMany: (batch) => {
      requests.push(...batch);
      return fake.translateMany(batch);
    },
  };
  return { engine, requests };
}

let running: Pipeline | null = null;
afterEach(() => {
  running?.stop();
  running = null;
});

async function start(html = PAGE) {
  document.body.innerHTML = html;
  const frames = manualFrames();
  const log = recorder();
  const { engine, requests } = spyEngine();
  const onUpdate = vi.fn();
  running = startPipeline({
    doc: document,
    engine,
    schedule: frames.schedule,
    logger: log.logger,
    onUpdate,
    render: { renderer: createRenderer(), settings: () => SHOW },
  });
  await frames.frames();
  return { pipeline: running, frames, requests, ...log };
}

const attr = (id: string, name: string) => document.getElementById(id)!.getAttribute(name);

describe('lecture des attributs (phase 2, §3.1)', () => {
  it('lit placeholder, title et aria-label, sauf régions et champs cachés', () => {
    document.body.innerHTML = PAGE;
    const seen: AttrSlot[] = [];
    scanAttributes(document.body, (slot) => seen.push(slot));
    expect(names(seen)).toEqual([
      'field@placeholder',
      'field@title',
      'field@aria-label',
      'go@title',
      'go@aria-label',
      'note@title',
      'balance@title',
      'number@title',
      'amount@title',
    ]);
  });

  it('donne toujours la même cible pour un même attribut', () => {
    document.body.innerHTML = PAGE;
    const input = document.getElementById('field')!;
    expect(slotOf(input, 'title')).toBe(slotOf(input, 'title'));
    expect(slotOf(input, 'title')).not.toBe(slotOf(input, 'placeholder'));
  });

  it('ne relit que l’élément quand deep vaut false', () => {
    document.body.innerHTML = PAGE;
    const seen: AttrSlot[] = [];
    scanAttributes(document.querySelector('main')!, (slot) => seen.push(slot), false);
    expect(seen).toEqual([]);
  });
});

describe('traduction des attributs dans la chaîne (phase 2, §3.1 et §3.6)', () => {
  it('traduit les libellés en attribut, avec leur rôle, et protège les valeurs', async () => {
    const { pipeline, requests } = await start();
    const byText = requests.filter((request) => request.context?.role === 'title').map((request) => request.text);
    expect(byText).toEqual(['Frais', 'Continuer', 'Frais de transfert']);
    expect(requests.find((request) => request.context?.role === 'placeholder')?.text).toBe('Montant');
    expect(requests.filter((request) => request.context?.role === 'aria-label').map((request) => request.text)).toEqual(['Montant', 'Continuer']);

    expect(attr('field', 'placeholder')).toBe(`${FAKE}Montant`);
    expect(attr('go', 'title')).toBe(`${FAKE}Continuer`);
    expect(attr('go', 'aria-label')).toBe(`${FAKE}Continuer`);
    expect(document.getElementById('go')!.textContent).toBe(`${FAKE}Continuer`);
    // Valeur (dd), nombre et élément au nom de valeur (id « amount ») : jamais soumis au moteur ni modifiés.
    expect(attr('balance', 'title')).toBe('Frais');
    expect(attr('number', 'title')).toBe('125 000');
    expect(attr('amount', 'title')).toBe('Frais');
    // Régions exclues, champ caché, placeholder hors champ : intacts.
    expect(attr('hidden-region', 'title')).toBe('Continuer');
    expect(attr('hidden-field', 'placeholder')).toBe('Montant');
    expect(attr('note', 'placeholder')).toBe('Continuer');

    const counts = pipeline.counts();
    expect(counts.attributes).toBe(9);
    // Valeurs : le texte du dd, son title et le title de #amount.
    expect(counts.values).toBe(3);
    expect(counts.numeric).toBe(1);
    expect(counts.mot).toBe(counts.candidates);
  });

  it('ne réévalue pas ses propres écritures (pas de boucle)', async () => {
    const { frames, requests } = await start();
    const before = requests.length;
    expect(await frames.frames()).toBe(0);
    expect(requests.length).toBe(before);
  });

  it('réévalue un attribut changé par l’application, et seulement lui', async () => {
    const { frames, requests } = await start();
    const before = requests.length;
    document.getElementById('go')!.setAttribute('title', 'Frais de transfert');
    await frames.frames();
    expect(requests.slice(before).map((request) => request.text)).toEqual(['Frais de transfert']);
    expect(attr('go', 'title')).toBe(`${FAKE}Frais de transfert`);
    expect(attr('go', 'aria-label')).toBe(`${FAKE}Continuer`);
  });

  it('traduit les attributs d’un élément injecté par la SPA', async () => {
    const { frames } = await start();
    const button = Object.assign(document.createElement('button'), { title: 'Nouveau transfert' });
    document.querySelector('main')!.append(button);
    await frames.frames();
    expect(button.getAttribute('title')).toBe(`${FAKE}Nouveau transfert`);
  });

  it('rend le français à un attribut qui passe dans une région exclue', async () => {
    const { frames } = await start();
    const go = document.getElementById('go')!;
    go.setAttribute('aria-hidden', 'true');
    await frames.frames();
    expect(go.getAttribute('title')).toBe('Continuer');
  });

  it('rend tous les attributs d’origine à la désactivation', async () => {
    const { pipeline, named } = await start();
    pipeline.stop();
    running = null;
    expect(attr('field', 'placeholder')).toBe('Montant');
    expect(attr('field', 'title')).toBe('Frais');
    expect(attr('go', 'title')).toBe('Continuer');
    expect(attr('go', 'aria-label')).toBe('Continuer');
    // Textes rendus : « Montant » (libellé) et « Continuer » (bouton).
    expect(named('content:restore')).toEqual([{ restored: 2, attributes: 6 }]);
  });
});
