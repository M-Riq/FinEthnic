// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeEngine } from '../../src/content/fake-engine';
import { frameSchedule, topmostRoots, watchMutations } from '../../src/content/observer';
import { startPipeline, type Pipeline } from '../../src/content/pipeline';
import type { TranslationEngine, TranslationRequest } from '../../src/language/contract';
import { loadFixture, manualFrames, recorder, showStep } from './support/page';

let running: Pipeline | null = null;
afterEach(() => {
  running?.stop();
  running = null;
});

function start(options: { engine?: TranslationEngine | null; budget?: number; step?: number } = {}) {
  loadFixture(document, options.step ?? 1);
  const frames = manualFrames();
  const log = recorder();
  const onUpdate = vi.fn();
  running = startPipeline({
    doc: document,
    engine: options.engine === undefined ? createFakeEngine() : options.engine,
    schedule: frames.schedule,
    logger: log.logger,
    onUpdate,
    ...(options.budget === undefined ? {} : { budget: options.budget }),
  });
  return { pipeline: running, frames, onUpdate, ...log };
}

/** Moteur espion : enregistre les requêtes et délègue au faux moteur. */
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

const textsByStatus = (pipeline: Pipeline) => {
  const map: Record<string, string[]> = {};
  for (const [node, entry] of pipeline.entries()) (map[entry.status ?? entry.kind] ??= []).push(node.data.trim());
  return map;
};

describe('observateur de mutations (P2.4)', () => {
  it('ne garde que les racines les plus hautes encore dans la portée', () => {
    document.body.innerHTML = '<div id="a"><p id="b"><span id="c"></span></p></div><p id="d"></p>';
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => document.getElementById(id)!);
    const outside = document.createElement('p');
    expect(topmostRoots([c!, d!, b!, outside], document.body)).toEqual([d, b]);
    expect(topmostRoots([c!, a!, c!], document.body)).toEqual([a]);
  });

  it('T-DET-03 — 50 nœuds ajoutés d’un coup donnent un seul lot', async () => {
    document.body.innerHTML = '<main></main>';
    const frames = manualFrames();
    const batches: Node[][] = [];
    const watcher = watchMutations(document.body, (roots) => batches.push(roots), frames.schedule);
    const main = document.querySelector('main')!;
    for (let i = 0; i < 50; i++) main.append(Object.assign(document.createElement('p'), { textContent: `Texte ${i}` }));
    expect(await frames.frames()).toBe(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(50);
    watcher.stop();
  });

  it('signale un retrait seul (lot vide) et plus rien après stop()', async () => {
    document.body.innerHTML = '<p>Texte</p>';
    const frames = manualFrames();
    const batches: Node[][] = [];
    const watcher = watchMutations(document.body, (roots) => batches.push(roots), frames.schedule);
    document.querySelector('p')!.remove();
    await frames.frames();
    expect(batches).toEqual([[]]);
    watcher.stop();
    document.body.append(document.createElement('p'));
    await frames.frames();
    expect(batches).toHaveLength(1);
  });
});

describe('chaîne de lecture (P2.5–P2.8)', () => {
  it('scanne la page au démarrage et évalue chaque texte avec le contexte, sans texte dans le journal', () => {
    const spy = spyEngine();
    const { pipeline, named, events } = start({ engine: spy.engine });
    expect(pipeline.step()).toBe(1);
    const counts = pipeline.counts();
    expect(counts.waiting).toBe(0);
    expect(counts.numeric).toBe(0);
    expect(counts.approved + counts.unverified + counts.partial + counts.untranslated + counts.noMatch + counts.ambiguous + counts.protected).toBe(
      counts.candidates,
    );
    expect(textsByStatus(pipeline)['APPROVED']).toEqual(['Votre compte', 'Solde disponible']);
    expect(spy.requests.find((r) => r.text === 'Votre compte')).toEqual({
      text: 'Votre compte',
      sourceLang: 'auto',
      targetLang: 'eto',
      context: { role: 'heading', live: false, pageLang: 'fr', step: 1 },
    });
    // Valeurs protégées par leur position : 2 `dd` (solde, compte) et 4 dates dans des `<time>`.
    expect(counts.values).toBe(6);
    expect(named('content:scan')).toEqual([
      { roots: 1, candidates: counts.candidates, numeric: 0, values: 6, tracked: counts.candidates + 6, step: 1 },
    ]);
    for (const [, data] of events) for (const value of Object.values(data ?? {})) expect(typeof value).not.toBe('string');
  });

  it('T-DET-05 — suit un changement d’étape de l’application monopage', async () => {
    const { pipeline, frames, onUpdate } = start();
    onUpdate.mockClear();
    showStep(document, 2);
    await frames.frames();
    expect(pipeline.step()).toBe(2);
    expect(onUpdate).toHaveBeenCalled();
    const byStatus = textsByStatus(pipeline);
    expect(byStatus['AMBIGUOUS']).toEqual(['Retour']);
    expect(byStatus['KNOWN_UNTRANSLATED']).toEqual(['Total à débiter']);
    // Les textes de l'étape 1 retirés de la page sont oubliés.
    expect(Object.values(byStatus).flat()).not.toContain('Votre compte');
    expect([...pipeline.entries()].every(([node]) => node.isConnected)).toBe(true);
  });

  it('T-DET-06 — réévalue un texte modifié sur place', async () => {
    const { pipeline, frames } = start();
    const node = [...pipeline.entries()].find(([text]) => text.data === 'Bonjour')![0];
    expect(textsByStatus(pipeline)['NO_MATCH']).toContain('Bonjour');
    node.data = 'Frais de transfert';
    await frames.frames();
    expect([...pipeline.entries()].find(([text]) => text === node)?.[1].status).toBe('APPROVED');
  });

  it('oublie un texte masqué ou vidé, et lit une région qui réapparaît', async () => {
    const { pipeline, frames } = start({ step: 4 });
    const dl = document.querySelector('dl')!;
    const before = pipeline.counts().candidates;
    dl.hidden = true;
    await frames.frames();
    expect(pipeline.counts().candidates).toBeLessThan(before);
    expect(textsByStatus(pipeline)['PENDING_VALIDATION'] ?? []).not.toContain('Total débité');
    dl.hidden = false;
    await frames.frames();
    expect(pipeline.counts().candidates).toBe(before);
    document.querySelector('h1')!.firstChild!.textContent = '   ';
    await frames.frames();
    expect(pipeline.counts().candidates).toBe(before - 1);
  });

  it('réévalue les textes déjà suivis quand l’étape change', async () => {
    const spy = spyEngine();
    const { frames } = start({ engine: spy.engine, step: 4 });
    const stay = document.createElement('p');
    stay.textContent = 'Texte commun';
    document.body.prepend(stay);
    await frames.frames();
    spy.requests.length = 0;
    showStep(document, 5);
    await frames.frames();
    expect(spy.requests.find((r) => r.text === 'Texte commun')?.context?.step).toBe(5);
  });

  it('respecte le budget par trame et évalue le reste aux trames suivantes', async () => {
    const { pipeline, frames, named } = start({ budget: 5 });
    const total = pipeline.counts().candidates;
    expect(total).toBeGreaterThan(10);
    expect(pipeline.counts().waiting).toBe(total - 5);
    expect(named('content:evaluate')[0]).toEqual({ texts: 5, invalid: 0, remaining: total - 5 });
    expect(await frames.frames()).toBe(Math.ceil(total / 5) - 1);
    expect(pipeline.counts().waiting).toBe(0);
  });

  it('sans moteur : compte les textes sans les évaluer', () => {
    const { pipeline, named } = start({ engine: null });
    const counts = pipeline.counts();
    expect(counts.candidates).toBeGreaterThan(0);
    expect(counts.waiting).toBe(counts.candidates);
    expect(named('content:evaluate')).toEqual([]);
  });

  it('ignore un moteur qui échoue ou renvoie des résultats invalides', () => {
    const broken: TranslationEngine = {
      ...createFakeEngine(),
      translateMany: (requests) => requests.map((_, i) => (i === 0 ? ({ status: 'OK' } as never) : (undefined as never))),
    };
    const { pipeline, named } = start({ engine: broken });
    expect(pipeline.counts().waiting).toBe(pipeline.counts().candidates);
    expect(named('content:evaluate')[0]).toMatchObject({ invalid: pipeline.counts().candidates });

    running?.stop();
    const throwing: TranslationEngine = {
      ...createFakeEngine(),
      translateMany: () => {
        throw new Error('panne');
      },
    };
    expect(() => start({ engine: throwing })).not.toThrow();
  });

  it('s’arrête : plus aucun scan ni évaluation', async () => {
    const { pipeline, frames, named } = start({ budget: 5 });
    pipeline.stop();
    showStep(document, 2);
    expect(await frames.frames()).toBeLessThanOrEqual(1);
    expect(named('content:scan')).toHaveLength(1);
    expect(named('content:evaluate')).toHaveLength(1);
    expect([...pipeline.entries()]).toEqual([]);
  });

  it('T-DET-02 — détecte un nouveau texte en moins de 100 ms (trames du navigateur)', async () => {
    loadFixture(document, 1);
    const log = recorder();
    let detected: (() => void) | undefined;
    running = startPipeline({
      doc: document,
      engine: createFakeEngine(),
      schedule: frameSchedule(window),
      logger: log.logger,
      onUpdate: () => detected?.(),
    });
    const done = new Promise<void>((resolve) => (detected = resolve));
    const started = performance.now();
    showStep(document, 3);
    await done;
    expect(performance.now() - started).toBeLessThan(100);
    expect(running.step()).toBe(3);
  });
});
