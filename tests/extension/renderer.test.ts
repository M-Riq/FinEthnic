// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARK_NAMES } from '../../src/content/diagnostic';
import { createFakeEngine } from '../../src/content/fake-engine';
import { bilingual, createRenderer, decide, type DisplaySettings } from '../../src/content/renderer';
import { TOOLTIP_TAG, TOOLTIP_TITLES } from '../../src/content/tooltip';
import type { TranslationEngine, TranslationRequest, TranslationResult } from '../../src/language/contract';
import { fingerprint } from '../../src/protection/integrity';
import { launch, stopAll } from './support/content';
import { loadFixture } from './support/page';

afterEach(() => {
  stopAll();
  vi.restoreAllMocks();
});

const SHOW: DisplaySettings = { showUnverified: true, displayMode: 'replace' };

function result(fields: Partial<TranslationResult>): TranslationResult {
  return {
    status: 'NO_MATCH',
    output: null,
    unverifiedOutput: null,
    unverifiedKind: null,
    entryId: null,
    candidateIds: [],
    matchKind: null,
    detectedSourceLang: null,
    protectedSegments: [],
    reason: null,
    ...fields,
  };
}

/** Faux moteur, sauf pour les textes de `answers`. */
function scripted(answers: Readonly<Record<string, Partial<TranslationResult>>>): TranslationEngine {
  const fake = createFakeEngine();
  const translate = (request: TranslationRequest): TranslationResult => {
    const answer = answers[request.text];
    return answer ? result(answer) : fake.translate(request);
  };
  return { info: fake.info, translate, translateMany: (requests) => requests.map(translate) };
}

/** Nœuds texte non vides de la page, dans l'ordre du document. */
function textNodes(root: Node = document.body): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node as Text).data.trim() !== '') nodes.push(node as Text);
  return nodes;
}

/** Nœud texte dont le texte, sans espaces de bord, vaut `text` (à chercher avant la traduction). */
function textNode(text: string, nth = 0): Text {
  const node = textNodes().filter((candidate) => candidate.data.trim() === text)[nth];
  if (!node) throw new Error(`texte absent : ${text}`);
  return node;
}

/** Mutations observées sous `target`. */
function watch(target: Node = document.body) {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
  return {
    take(): MutationRecord[] {
      records.push(...observer.takeRecords());
      return records.splice(0);
    },
    stop: () => observer.disconnect(),
  };
}

function setBody(html: string): void {
  document.body.innerHTML = `<main id="app">${html}</main>`;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('décision d’affichage (P5.6, P5.8, P5.9)', () => {
  it('affiche output si APPROVED, unverifiedOutput si PENDING_VALIDATION et l’option active', () => {
    expect(decide('Frais', result({ status: 'APPROVED', output: 'Mbo' }), SHOW)).toEqual({ action: 'write', text: 'Mbo', display: 'approved' });
    const pending = result({ status: 'PENDING_VALIDATION', unverifiedOutput: 'Mbo', unverifiedKind: 'complete' });
    expect(decide('Frais', pending, SHOW)).toEqual({ action: 'write', text: 'Mbo', display: 'unverified' });
    // Phase 4 : un brouillon incomplet, ou de nature inconnue (contrat §2-1), n'est jamais affiché.
    expect(decide('Frais', { ...pending, unverifiedKind: 'partial' }, SHOW)).toEqual({ action: 'keep' });
    expect(decide('Frais', { ...pending, unverifiedKind: null }, SHOW)).toEqual({ action: 'keep' });
    expect(decide('Frais', pending, { ...SHOW, showUnverified: false })).toEqual({ action: 'keep' });
  });

  it.each(['KNOWN_UNTRANSLATED', 'NO_MATCH', 'AMBIGUOUS', 'PROTECTED'] as const)('garde le français pour %s, même avec un texte', (status) => {
    expect(decide('Frais', result({ status, output: 'Mbo', unverifiedOutput: 'Mbo' }), SHOW)).toEqual({ action: 'keep' });
  });

  it('garde le français si le texte est absent, vide ou n’est pas une chaîne', () => {
    for (const output of [null, '', '   ', 42 as unknown as string]) {
      expect(decide('Frais', result({ status: 'APPROVED', output }), SHOW)).toEqual({ action: 'keep' });
    }
  });

  it('refuse une écriture qui altère une valeur, ou un segment absent de l’original', () => {
    expect(decide('Frais : 0 FCFA', result({ status: 'APPROVED', output: 'Mbo : 1 FCFA' }), SHOW)).toEqual({
      action: 'refuse',
      failure: 'digits-changed',
    });
    expect(decide('Bonjour', result({ status: 'APPROVED', output: 'Mbolo Amina', protectedSegments: ['Amina'] }), SHOW)).toEqual({
      action: 'refuse',
      failure: 'engine-segment-unknown',
    });
  });

  it('mode bilingue : la traduction intacte, puis le français entre parenthèses, espaces de bord gardés', () => {
    expect(decide(' Frais ', result({ status: 'APPROVED', output: ' Mbo ' }), { ...SHOW, displayMode: 'bilingual' })).toEqual({
      action: 'write',
      text: ' Mbo (Frais) ',
      display: 'approved',
    });
    expect(bilingual('Safinum', 'Safinum')).toBe('Safinum');
    expect(bilingual('  ', 'Mbo')).toBe('Mbo');
  });
});

describe('rendu : écriture et restauration de Text.data (P5.1, P5.2, P5.4)', () => {
  it('écrit, rend l’original, et ne touche pas un texte remplacé par l’application', () => {
    const node = document.createTextNode(' Frais ');
    const renderer = createRenderer();
    expect(renderer.ownership(node)).toBeNull();

    renderer.write(node, ' Mbo ', 'approved');
    expect(node.data).toBe(' Mbo ');
    expect(renderer.ownership(node)).toBe('ours');
    expect(renderer.sourceOf(node)).toBe(' Frais ');
    expect([...renderer.entries()]).toEqual([[node, { original: ' Frais ', text: ' Mbo ', display: 'approved' }]]);

    // Réécriture : l'original reste celui de la page.
    renderer.write(node, ' Mbo (Frais) ', 'approved');
    expect(renderer.sourceOf(node)).toBe(' Frais ');
    expect(renderer.restore(node)).toBe(true);
    expect(node.data).toBe(' Frais ');
    expect(renderer.ownership(node)).toBeNull();

    renderer.write(node, ' Mbo ', 'approved');
    node.data = 'Montant';
    expect(renderer.ownership(node)).toBe('changed');
    expect(renderer.sourceOf(node)).toBe('Montant');
    expect([...renderer.entries()]).toEqual([]);
    expect(renderer.restoreAll()).toBe(0);
    expect(node.data).toBe('Montant');
  });

  it('reprend le texte de l’application comme original, et n’écrit pas une valeur identique', () => {
    document.body.replaceChildren(document.createTextNode('Frais'));
    const node = document.body.firstChild as Text;
    const renderer = createRenderer();
    renderer.write(node, 'Mbo', 'approved');
    node.data = 'Montant';
    renderer.write(node, 'Nkol', 'unverified');
    expect(renderer.sourceOf(node)).toBe('Montant');

    const mutations = watch();
    renderer.write(node, 'Nkol', 'unverified');
    expect(mutations.take()).toEqual([]);
    expect(renderer.restoreAll()).toBe(1);
    expect(node.data).toBe('Montant');
    mutations.stop();
  });
});

describe('affichage dans la page (T-TRA, faux moteur)', () => {
  it('T-TRA-01 — remplace une traduction validée, dans le même nœud texte', async () => {
    loadFixture(document, 2);
    const title = textNode('Frais de transfert');
    const next = textNode('Continuer');
    const { controller } = await launch();
    expect(title.isConnected).toBe(true);
    expect(title.data).toBe('⟦FAKE⟧ Frais de transfert');
    expect(next.data).toBe('⟦FAKE⟧ Continuer');
    expect(controller.snapshot().counts).toMatchObject({ approved: 3, displayed: 4, displayedUnverified: 1, refused: 0 });
  });

  it('T-TRA-02 — garde le français sans traduction et le compte « à traduire »', async () => {
    loadFixture(document, 4);
    const summary = textNode('Récapitulatif');
    const { controller } = await launch();
    expect(summary.data).toBe('Récapitulatif');
    expect(controller.snapshot().counts.untranslated).toBe(2);
  });

  it('T-TRA-03 — affiche une traduction non vérifiée avec son marqueur, sans nœud ni attribut ajouté dans la page', async () => {
    loadFixture(document, 4);
    const amount = textNode('Montant');
    const mutations = watch();
    const { controller, highlights } = await launch();
    expect(amount.data).toBe('⟦FAKE⟧ Montant');
    expect(highlights.texts(MARK_NAMES.unverified)).toContain('⟦FAKE⟧ Montant');
    expect(highlights.texts(MARK_NAMES.unverified)).not.toContain('⟦FAKE⟧ Frais');
    expect(controller.snapshot().counts).toMatchObject({ unverified: 4, displayedUnverified: 4 });

    // Le français au survol : l'infobulle est hors de <body>.
    amount.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector(TOOLTIP_TAG)?.parentNode).toBe(document.documentElement);
    expect(mutations.take().every((record) => record.type === 'characterData')).toBe(true);
    mutations.stop();
  });

  it('T-TRA-04 — réinjecte les valeurs à l’identique, et refuse une sortie qui en altère une', async () => {
    const sentence = 'Votre transfert de 25 000 FCFA vers Jean-Paul Mbarga a été effectué.';
    const altered = 'Le virement de 25 000 FCFA à Jean-Paul Mbarga est fait.';
    const segments = ['25 000', 'FCFA', 'Jean-Paul Mbarga'];
    setBody(`<p>${sentence}</p><p>${altered}</p>`);
    const ok = textNode(sentence);
    const ko = textNode(altered);
    const { controller } = await launch(
      {},
      {
        engine: scripted({
          [sentence]: { status: 'APPROVED', output: '⟦TEST⟧ 25 000 FCFA → Jean-Paul Mbarga ⟦TEST⟧.', protectedSegments: segments },
          [altered]: { status: 'APPROVED', output: '⟦TEST⟧ 25 000 FCFA → Jean-Paul Mbaga ⟦TEST⟧.', protectedSegments: segments },
        }),
      },
    );
    expect(ok.data).toBe('⟦TEST⟧ 25 000 FCFA → Jean-Paul Mbarga ⟦TEST⟧.');
    expect(ko.data).toBe(altered);
    expect(controller.snapshot().counts).toMatchObject({ displayed: 1, refused: 1 });
  });

  it('T-TRA-05 — ne traduit pas une phrase seulement proche d’une entrée', async () => {
    setBody('<p>Votre paiement a été envoyé avec succès.</p>');
    const near = textNode('Votre paiement a été envoyé avec succès.');
    const mutations = watch();
    const { controller } = await launch();
    expect(near.data).toBe('Votre paiement a été envoyé avec succès.');
    expect(controller.snapshot().counts).toMatchObject({ noMatch: 1, displayed: 0 });
    expect(mutations.take()).toEqual([]);
    mutations.stop();
  });

  it('T-TRA-06 — traduit le libellé d’un texte composé, « : 0 FCFA » intact', async () => {
    setBody('<p>Frais : 0 FCFA</p>');
    const node = textNode('Frais : 0 FCFA');
    await launch();
    expect(node.data).toBe('⟦FAKE⟧ Frais : 0 FCFA');
  });

  it('T-TRA-07 — anti-boucle : aucune mutation ni évaluation après l’affichage', async () => {
    loadFixture(document, 4);
    const { frames, named } = await launch({ diagnostic: true });
    await frames.frames();
    const evaluations = named('content:evaluate').length;
    const mutations = watch(document);
    for (let i = 0; i < 20; i++) await frames.frame();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mutations.take()).toEqual([]);
    expect(frames.pending()).toBe(0);
    expect(named('content:evaluate')).toHaveLength(evaluations);
    mutations.stop();
  });

  it('T-TRA-08 — retraduit sans boucle un texte que l’application remet en français ou remplace', async () => {
    loadFixture(document, 4);
    const fees = textNode('Frais');
    const { frames, controller } = await launch();
    expect(fees.data).toBe('⟦FAKE⟧ Frais');

    fees.data = 'Frais';
    expect(await frames.frames()).toBeLessThan(5);
    expect(fees.data).toBe('⟦FAKE⟧ Frais');

    // Un autre texte : il devient l'original.
    fees.data = 'Montant';
    await frames.frames();
    expect(fees.data).toBe('⟦FAKE⟧ Montant');

    // Un nouveau nœud à la place de l'ancien (rendu de framework).
    const dt = fees.parentElement!;
    dt.replaceChildren(document.createTextNode('Frais'));
    await frames.frames();
    expect(dt.textContent).toBe('⟦FAKE⟧ Frais');
    expect(controller.snapshot().counts.refused).toBe(0);

    // À l'arrêt, le dernier texte de l'application est rendu.
    controller.stop();
    expect(dt.textContent).toBe('Frais');
  });

  it('T-TRA-09 — option « non vérifiées » : original rendu à l’identique, puis marqueur de nouveau', async () => {
    loadFixture(document, 4);
    const amount = textNode('Montant');
    const fees = textNode('Frais');
    const { controller, highlights, update, named } = await launch();
    const evaluations = named('content:evaluate').length;
    expect(amount.data).toBe('⟦FAKE⟧ Montant');

    await update({ showUnverified: false });
    expect(amount.isConnected).toBe(true);
    expect(amount.data).toBe('Montant');
    expect(fees.data).toBe('⟦FAKE⟧ Frais');
    expect(highlights.registry.has(MARK_NAMES.unverified)).toBe(false);
    expect(controller.snapshot().counts).toMatchObject({ unverified: 4, displayedUnverified: 0, displayed: 1 });

    await update({ showUnverified: true });
    expect(amount.data).toBe('⟦FAKE⟧ Montant');
    expect(highlights.texts(MARK_NAMES.unverified)).toContain('⟦FAKE⟧ Montant');
    expect(fees.data).toBe('⟦FAKE⟧ Frais');
    // Les options s'appliquent sans réévaluer.
    expect(named('content:evaluate')).toHaveLength(evaluations);
  });

  it.each([4, 5])('T-NAV-0%i — libellés validés traduits, valeurs identiques', async (step) => {
    loadFixture(document, step);
    const values = [...document.querySelectorAll('dd')].map((dd) => dd.textContent);
    const before = fingerprint(textNodes().map((node) => node.data));
    const { controller } = await launch();
    expect([...document.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(values);
    expect(fingerprint(textNodes().map((node) => node.data))).toBe(before);
    expect(textNodes().filter((node) => node.data.startsWith('⟦FAKE⟧')).length).toBe(controller.snapshot().counts.displayed);
    expect(controller.snapshot().counts.approved).toBeGreaterThan(0);
    expect(controller.snapshot().counts.refused).toBe(0);
  });
});

describe('restauration et options (P5.2, P5.10)', () => {
  it('rend à la désactivation les mêmes nœuds texte avec leur texte d’origine', async () => {
    loadFixture(document, 2);
    const nodes = textNodes();
    const texts = nodes.map((node) => node.data);
    const html = document.body.innerHTML;
    const { update, named } = await launch();
    expect(document.body.innerHTML).not.toBe(html);

    await update({ enabled: false });
    expect(textNodes()).toEqual(nodes);
    expect(nodes.map((node) => node.data)).toEqual(texts);
    expect(document.body.innerHTML).toBe(html);
    expect(named('content:restore')).toEqual([{ restored: 4, attributes: 0 }]);

    await update({ enabled: true });
    expect(textNode('⟦FAKE⟧ Continuer')).toBe(nodes[texts.indexOf('Continuer')]);
  });

  it('passe en mode bilingue et revient, sans réévaluer', async () => {
    loadFixture(document, 4);
    const fees = textNode('Frais');
    const { update, named, highlights } = await launch();
    const evaluations = named('content:evaluate').length;
    await update({ displayMode: 'bilingual' });
    expect(fees.data).toBe('⟦FAKE⟧ Frais (Frais)');
    expect(highlights.texts(MARK_NAMES.unverified)).toContain('⟦FAKE⟧ Montant (Montant)');
    await update({ displayMode: 'replace' });
    expect(fees.data).toBe('⟦FAKE⟧ Frais');
    expect(named('content:evaluate')).toHaveLength(evaluations);
  });

  it('mode bilingue : la valeur qui suit un libellé « : » traduit reste une valeur, jamais soumise', async () => {
    setBody('<p><span>Motif :</span><span id="second">Loyer</span></p>');
    const engine = scripted({ 'Motif :': { status: 'APPROVED', output: 'Ndzala :' }, Facture: { status: 'APPROVED', output: 'Kalara' } });
    const asked: string[] = [];
    const translateMany = (requests: readonly TranslationRequest[]) => {
      asked.push(...requests.map((request) => request.text));
      return engine.translateMany(requests);
    };
    const { frames } = await launch({ displayMode: 'bilingual' }, { engine: { ...engine, translateMany } });
    expect(textNode('Ndzala : (Motif :)')).toBeDefined();

    document.getElementById('second')!.textContent = 'Facture';
    await frames.frames();
    expect(document.getElementById('second')!.textContent).toBe('Facture');
    expect(asked).not.toContain('Facture');
    expect(asked).not.toContain('Loyer');
  });

  it('reconnaît l’étape par le titre d’origine, même traduit', async () => {
    loadFixture(document, 2);
    const { controller, frames } = await launch();
    expect(textNode('⟦FAKE⟧ Frais de transfert').parentElement!.tagName).toBe('H1');
    document.getElementById('app')!.append(Object.assign(document.createElement('p'), { textContent: 'Continuer' }));
    await frames.frames();
    expect(controller.snapshot().step).toBe(2);
  });

  it('rend le français d’un texte retiré de la page', async () => {
    loadFixture(document, 4);
    const fees = textNode('Frais');
    const { frames } = await launch();
    fees.parentElement!.remove();
    await frames.frames();
    expect(fees.data).toBe('Frais');
  });

  it('n’écrit rien si le moteur renvoie un lot incomplet', async () => {
    loadFixture(document, 2);
    const html = document.body.innerHTML;
    const fake = createFakeEngine();
    const { controller, named } = await launch({}, { engine: { ...fake, translateMany: (requests) => fake.translateMany(requests).slice(1) } });
    expect(document.body.innerHTML).toBe(html);
    expect(controller.snapshot().counts.displayed).toBe(0);
    expect(named('content:evaluate')[0]).toMatchObject({ invalid: controller.snapshot().counts.candidates });
  });
});

describe('infobulle du français (P5.5)', () => {
  /** Capture la racine fantôme fermée de l'infobulle. */
  function shadowRoots() {
    const spy = vi.spyOn(Element.prototype, 'attachShadow');
    return () => spy.mock.results.map((entry) => entry.value as ShadowRoot);
  }

  it('montre le français au survol, la nature la moins sûre en titre, et se ferme avec Échap', async () => {
    loadFixture(document, 4);
    const roots = shadowRoots();
    const fees = textNode('Frais').parentElement!;
    const amount = textNode('Montant').parentElement!;
    await launch();

    fees.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const host = document.querySelector<HTMLElement>(TOOLTIP_TAG)!;
    expect(document.body.contains(host)).toBe(false);
    expect(host.style.getPropertyValue('position')).toBe('fixed');
    const box = roots().at(-1)!.querySelector('[role="tooltip"]')!;
    expect(box.firstElementChild!.textContent).toBe(TOOLTIP_TITLES.approved);
    const line = box.lastElementChild as HTMLElement;
    expect([line.textContent, line.lang]).toEqual(['Frais', 'fr']);

    amount.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelectorAll(TOOLTIP_TAG)).toHaveLength(1);
    expect(roots().at(-1)!.querySelector('[role="tooltip"]')!.firstElementChild!.textContent).toBe(TOOLTIP_TITLES.unverified);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector(TOOLTIP_TAG)).toBeNull();
    amount.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector(TOOLTIP_TAG)).toBeNull();

    // Un texte resté en français n'a pas d'infobulle.
    textNode('Récapitulatif').parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(document.querySelector(TOOLTIP_TAG)).toBeNull();
  });

  it('montre au focus le français des textes descendants, et disparaît avec le focus et à l’arrêt', async () => {
    loadFixture(document, 4);
    const roots = shadowRoots();
    const button = textNode('Confirmer le transfert').parentElement as HTMLButtonElement;
    const { controller } = await launch();

    button.focus();
    expect(roots().at(-1)!.querySelector('[lang="fr"]')!.textContent).toBe('Confirmer le transfert');
    button.blur();
    expect(document.querySelector(TOOLTIP_TAG)).toBeNull();

    button.focus();
    expect(document.querySelector(TOOLTIP_TAG)).not.toBeNull();
    controller.stop();
    expect(document.querySelector(TOOLTIP_TAG)).toBeNull();
    expect(button.textContent).toBe('Confirmer le transfert');
    await settle();
  });
});
