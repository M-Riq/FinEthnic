import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CorpusEntry } from '../../src/engine/corpus';
import { createEngine, type EngineResources } from '../../src/engine/engine';
import { ETON_RULES } from '../../src/engine/eton';
import { INCOMPLETE_MARKER, type TextResult, type UnitResult } from '../../src/engine/select';
import { createEngineServer } from '../../scripts/lib/engine-server';
import { D7_ENTRIES, IGNORED } from './d7-fixture';
import { LEXICON } from './support';

const entry = (id: string, text: string, synonyms: string[] = [], definition: string | null = null): CorpusEntry => ({ id, text, synonyms, definition });

const RESOURCES: EngineResources = {
  corpus: [
    entry('ACT-001', 'Envoyer', [], 'Faire partir vers une autre personne.'),
    entry('ACT-003', 'Transférer', ['envoyer'], "Envoyer de l'argent à quelqu'un."),
    entry('ACT-004', 'Payer', [], "Donner de l'argent."),
    entry('VOC-039', 'Tarif', ['prix', 'argent']),
    entry('Q-1', 'Voulez-vous payer ?', ['Payer']),
  ],
  guards: ['Safinum', 'FCFA'],
  lexicon: LEXICON,
  d7: D7_ENTRIES,
  ignored: IGNORED,
  critical: ['ACT-001'],
};
const ENGINE = createEngine(RESOURCES);
const unit = (r: TextResult): UnitResult => r.units[0] as UnitResult;

describe('select — choix du candidat', () => {
  it('un synonyme complet l’emporte sur l’original absent de D7 et sur la définition incomplète', () => {
    const r = ENGINE.translate('Transférer');
    expect(r).toMatchObject({ status: 'SUCCESS', output: 'lóm', draft: null, marker: null });
    expect(unit(r).chosen).toMatchObject({ source: 'SYNONYM', text: 'envoyer', entryIds: ['ACT-003'] });
    expect(unit(r).alternatives.map((c) => c.source)).toEqual(['DEFINITION', 'ORIGINAL']);
  });

  it('entre deux candidats complets, celui sans mot ambigu passe avant l’ordre de D8 (M15)', () => {
    const u = unit(ENGINE.translate('Tarif'));
    expect(u.status).toBe('SUCCESS');
    expect(u.chosen?.text).toBe('argent');
    expect(u.output).toBe('mɔ̀ní');
    expect(u.reasons).toEqual([]);
    expect(u.alternatives[0]).toMatchObject({ text: 'prix', eton: { complete: true, ambiguous: ['prix'] } });
  });

  it('écarte un candidat qui perd un trait de l’original (une question devenue affirmation)', () => {
    const u = unit(ENGINE.translate('Voulez-vous payer ?'));
    expect(u.discarded).toEqual([{ text: 'Payer', source: 'SYNONYM', entryIds: ['Q-1'], lost: ['QUESTION', 'QUESTION:YES_NO'] }]);
    expect(u.chosen?.source).toBe('ORIGINAL');
    expect(u.status).toBe('PARTIAL');
  });
});

describe('select — statuts (M2, M4, M7)', () => {
  it('PARTIAL : brouillon avec ses manques et le marqueur ; le français reste dans le résultat', () => {
    const engine = createEngine({ ...RESOURCES, critical: [] });
    const r = engine.translate("Envoyer de l'argent");
    expect(r).toMatchObject({ status: 'PARTIAL', output: null, draft: 'lóm [de] mɔ̀ní', marker: INCOMPLETE_MARKER, text: "Envoyer de l'argent" });
    expect(unit(r)).toMatchObject({ reasons: ['GAPS'], match: 'PARTIAL', logged: true });
    expect(unit(r).chosen?.eton.gaps).toEqual([{ kind: 'WORD', fr: 'de', rejected: [] }]);
  });

  it('FALLBACK : entrée critique non rendue → français seul', () => {
    const r = ENGINE.translate("Envoyer de l'argent");
    expect(r).toMatchObject({ status: 'FALLBACK', output: null, draft: null, marker: null });
    expect(unit(r)).toMatchObject({ critical: ['ACT-001'], reasons: ['GAPS', 'CRITICAL_NOT_RENDERED'], output: null });
  });

  it('une entrée critique entièrement rendue reste SUCCESS', () => {
    expect(ENGINE.translate('Envoyer')).toMatchObject({ status: 'SUCCESS', output: 'lóm' });
  });

  it('FALLBACK : négation non rendue (le sens s’inverserait)', () => {
    const u = unit(ENGINE.translate('Ne payez pas.'));
    expect(u.status).toBe('FALLBACK');
    expect(u.reasons).toContain('NEGATION_NOT_RENDERED');
    expect(u.chosen?.eton.gaps.map((g) => (g.kind === 'RULE' ? g.rule.id : g.fr))).toContain(ETON_RULES.NEGATION_IMPERATIVE.id);
  });

  it('PENDING : texte sans rien de D8 que D7 ne rend pas entièrement → français seul, à journaliser (M4)', () => {
    const r = ENGINE.translate('Merci');
    expect(r).toMatchObject({ status: 'PENDING', output: null, draft: null, pending: ['Merci'] });
    expect(unit(r)).toMatchObject({ reasons: ['NOT_IN_D8'], logged: true, output: null });
  });

  it('SUCCESS : texte sans rien de D8 que D7 rend entièrement, journalisé quand même (M16)', () => {
    const r = ENGINE.translate('Viens ici !');
    expect(r).toMatchObject({ status: 'SUCCESS', output: 'zùgá mű !', pending: ['Viens ici !'] });
    expect(unit(r)).toMatchObject({ match: 'NONE', reasons: ['NOT_IN_D8'], logged: true });
  });

  it('PASSTHROUGH : rien à traduire, le texte reçu est rendu tel quel', () => {
    expect(ENGINE.translate('5 000 FCFA')).toMatchObject({ status: 'PASSTHROUGH', output: '5 000 FCFA', pending: [] });
  });

  it('texte de plusieurs phrases : une phrase en attente rend le texte PARTIAL, une FALLBACK le rend FALLBACK', () => {
    const mixed = ENGINE.translate('Envoyer. Merci.');
    expect(mixed.units.map((u) => u.status)).toEqual(['SUCCESS', 'PENDING']);
    expect(mixed).toMatchObject({ status: 'PARTIAL', output: null, draft: 'lóm. [Merci.]', marker: INCOMPLETE_MARKER });
    expect(ENGINE.translate('Envoyer. Ne payez pas.').status).toBe('FALLBACK');
  });
});

describe('createEngine', () => {
  it('décrit ses ressources et n’applique que les règles de classe A', () => {
    expect(ENGINE.info()).toMatchObject({ d8Entries: 5, d7Entries: D7_ENTRIES.length, criticalEntries: 1 });
    expect(ENGINE.info().activeRules).toEqual(Object.values(ETON_RULES).filter((r) => r.ruleClass === 'A').map((r) => r.id));
  });

  it('garde les résultats en cache (sauf cacheSize 0)', () => {
    expect(ENGINE.translate('Tarif')).toBe(ENGINE.translate('Tarif'));
    const uncached = createEngine(RESOURCES, { cacheSize: 0 });
    expect(uncached.translate('Tarif')).not.toBe(uncached.translate('Tarif'));
    expect(uncached.translateMany(['Tarif', 'Envoyer']).map((r) => r.output)).toEqual(['mɔ̀ní', 'lóm']);
  });
});

describe('API HTTP locale (M3)', () => {
  const server = createEngineServer(ENGINE);
  let base = '';
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });
  const post = (body: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    fetch(`${base}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('POST /translate : un texte ou une liste, avec la requête du contrat (sourceLang, targetLang)', async () => {
    const one = await post({ text: 'Transférer', sourceLang: 'fr', targetLang: 'eto' });
    expect(one.status).toBe(200);
    expect(((await one.json()) as { result: TextResult }).result).toMatchObject({ status: 'SUCCESS', output: 'lóm' });
    const many = (await (await post({ texts: ['Envoyer', 'Merci'] })).json()) as { results: TextResult[] };
    expect(many.results.map((r) => r.status)).toEqual(['SUCCESS', 'PENDING']);
  });

  it('GET /info', async () => {
    const res = await fetch(`${base}/info`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ d8Entries: 5 });
  });

  it('refuse les requêtes invalides avec un code d’erreur', async () => {
    const error = async (res: Response): Promise<[number, string]> => [res.status, ((await res.json()) as { error: string }).error];
    expect(await error(await fetch(`${base}/translate`, { method: 'POST', body: '{' }))).toEqual([400, 'INVALID_JSON']);
    expect(await error(await post({ text: 'Payer', sourceLang: 'en' }))).toEqual([400, 'UNSUPPORTED_SOURCE_LANG']);
    expect(await error(await post({ text: 'Payer', targetLang: 'fr' }))).toEqual([400, 'UNSUPPORTED_TARGET_LANG']);
    expect(await error(await post({ text: 'Payer', texts: ['Payer'] }))).toEqual([400, 'INVALID_BODY']);
    expect(await error(await post({ texts: [1] }))).toEqual([400, 'INVALID_TEXT']);
    expect(await error(await fetch(`${base}/translate`))).toEqual([405, 'METHOD_NOT_ALLOWED']);
    expect(await error(await fetch(`${base}/autre`))).toEqual([404, 'NOT_FOUND']);
  });

  it('CORS ouvert seulement aux extensions Chrome et à localhost', async () => {
    const extension = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
    expect((await post({ text: 'Payer' }, { Origin: extension })).headers.get('access-control-allow-origin')).toBe(extension);
    expect((await post({ text: 'Payer' }, { Origin: 'https://exemple.com' })).headers.get('access-control-allow-origin')).toBeNull();
  });
});
