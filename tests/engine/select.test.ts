import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CorpusEntry } from '../../src/engine/corpus';
import { createEngine, type EngineResources } from '../../src/engine/engine';
import { ETON_RULES } from '../../src/engine/eton';
import { INCOMPLETE_MARKER, onlyFrenchKept, type TextResult, type UnitResult } from '../../src/engine/select';
import {
  KEPT_FRENCH_PATH, readKeptFrench, readWrongSenses, SENSE_REVIEW_PATH, SYNONYM_ADDITIONS_PATH, withSynonymAdditions,
} from '../../scripts/lib/engine-load';
import { createEngineServer } from '../../scripts/lib/engine-server';
import { GRAMMAR_RULES_PATH, readConnectives, readPartitives } from '../../scripts/lib/engine-d7';
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

describe('select — contrôle du sens (M18)', () => {
  const REJETER = entry('ACT-022', 'Rejeter', ['mettre de côté', 'refuser'], 'Ne pas accepter une demande.');
  const LIN = { entryId: 'ACT-022', fr: 'mettre de côté', eto: 'lìŋ', ref: 'D7 p. 173 (lexique n° 1606)', reason: 'lìŋ veut dire épargner' };
  const withEntries = (corpus: CorpusEntry[], wrongSenses: EngineResources['wrongSenses'] = []): ReturnType<typeof createEngine> =>
    createEngine({ ...RESOURCES, corpus, critical: [], wrongSenses });

  it('« Rejeter » : préfère le synonyme confirmé bɛ̀n (refuser) à lìŋ, qui veut d’abord dire « épargner »', () => {
    const u = unit(withEntries([REJETER]).translate('Rejeter'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'bɛ̀n', reasons: [] });
    expect(u.chosen).toMatchObject({ source: 'SYNONYM', text: 'refuser', unconfirmed: [] });
    expect(u.alternatives.find((c) => c.text === 'mettre de côté')).toMatchObject({ eton: { complete: true }, unconfirmed: ['mettre de côté'] });
  });

  it('un sens second confirmé par l’entrée de D8 n’est pas signalé', () => {
    const u = unit(withEntries([entry('X-1', 'Économiser', ['mettre de côté'], "Épargner de l'argent.")]).translate('Économiser'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'lìŋ', reasons: [] });
  });

  it('sans autre candidat complet, le signal ne bloque pas : SUCCESS avec SENSE_UNCONFIRMED', () => {
    const u = unit(withEntries([entry('X-2', 'Écarter', ['mettre de côté'])]).translate('Écarter'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'lìŋ', reasons: ['SENSE_UNCONFIRMED'] });
  });

  it('sens faux relevé : le synonyme est écarté, la définition prend le relais', () => {
    const wrong = { ...LIN, entryId: 'X-2' };
    const u = unit(withEntries([entry('X-2', 'Écarter', ['mettre de côté'], 'Refuser.')], [wrong]).translate('Écarter'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'bɛ̀n.' });
    expect(u.chosen?.source).toBe('DEFINITION');
    expect(u.excluded.map((c) => c.text)).toEqual(['mettre de côté']);
  });

  it('sens faux relevé et rien d’autre : le texte reste en français (FALLBACK, WRONG_SENSE)', () => {
    const r = withEntries([entry('X-3', 'Mettre de côté')], [{ ...LIN, entryId: 'X-3' }]).translate('Mettre de côté');
    expect(r).toMatchObject({ status: 'FALLBACK', output: null, draft: null });
    expect(unit(r)).toMatchObject({ reasons: ['WRONG_SENSE'], chosen: null, output: null });
    expect(unit(r).excluded.map((c) => c.eton.eto)).toEqual(['lìŋ']);
  });

  it('sense-review.json : refuse une entrée de D8 inconnue ou un champ manquant', () => {
    const root = mkdtempSync(join(tmpdir(), 'finethnic-sense-'));
    const write = (wrongSenses: unknown[]): void => {
      mkdirSync(join(root, 'data/language-resources'), { recursive: true });
      writeFileSync(join(root, SENSE_REVIEW_PATH), JSON.stringify({ wrongSenses }));
    };
    try {
      write([LIN]);
      expect(readWrongSenses(root, new Set(['ACT-022']))).toEqual([LIN]);
      expect(() => readWrongSenses(root, new Set(['ACT-001']))).toThrow(/entrée de D8 inconnue ACT-022/u);
      write([{ ...LIN, reason: '' }]);
      expect(() => readWrongSenses(root, new Set(['ACT-022']))).toThrow(/wrongSenses\[0\]\.reason manquant/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('d8-synonym-additions.json : ajoute le synonyme validé après ceux de D8, refuse un texte changé ou un doublon', () => {
    const root = mkdtempSync(join(tmpdir(), 'finethnic-syn-'));
    const add = { entryId: 'VOC-039', text: 'Tarif', synonym: 'coût', reason: 'r', ref: 'M22', decidedBy: 'responsable', date: '2026-11-15' };
    const write = (additions: unknown[]): void => {
      mkdirSync(join(root, 'data/language-resources'), { recursive: true });
      writeFileSync(join(root, SYNONYM_ADDITIONS_PATH), JSON.stringify({ additions }));
    };
    try {
      write([add]);
      const corpus = withSynonymAdditions(root, RESOURCES.corpus);
      expect(corpus.find((e) => e.id === 'VOC-039')?.synonyms).toEqual(['prix', 'argent', 'coût']);
      expect(RESOURCES.corpus.find((e) => e.id === 'VOC-039')?.synonyms).toEqual(['prix', 'argent']);
      write([{ ...add, text: 'Tarifs' }]);
      expect(() => withSynonymAdditions(root, RESOURCES.corpus)).toThrow(/le texte de VOC-039 est « Tarif »/u);
      write([{ ...add, synonym: 'Prix' }]);
      expect(() => withSynonymAdditions(root, RESOURCES.corpus)).toThrow(/déjà un synonyme de VOC-039/u);
      write([{ ...add, entryId: 'X-9' }]);
      expect(() => withSynonymAdditions(root, RESOURCES.corpus)).toThrow(/entrée de D8 inconnue X-9/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('un sens faux relevé ne concerne que son entrée de D8', () => {
    const u = unit(withEntries([entry('X-2', 'Écarter', ['mettre de côté'])], [LIN]).translate('Écarter'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'lìŋ', excluded: [] });
  });
});

describe('select — termes français gardés (M20)', () => {
  const withKept = (corpus: CorpusEntry[]): ReturnType<typeof createEngine> =>
    createEngine({ ...RESOURCES, corpus, critical: [], keptFrench: ['reçu'] });

  it('un candidat entièrement en éton passe avant un candidat qui garde du français', () => {
    const u = unit(withKept([entry('X-4', 'Expédier le bordereau', ['envoyer le reçu', "envoyer l'argent"])]).translate('Expédier le bordereau'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'lóm mɔ̀ní', reasons: [] });
    expect(u.alternatives[0]).toMatchObject({ text: 'envoyer le reçu', eton: { complete: true, kept: ['reçu'] } });
  });

  it('sinon SUCCESS avec le signal FRENCH_KEPT', () => {
    const u = unit(withKept([entry('X-5', 'Expédier le bordereau', ['envoyer le reçu'])]).translate('Expédier le bordereau'));
    expect(u).toMatchObject({ status: 'SUCCESS', output: 'lóm reçu', reasons: ['FRENCH_KEPT'] });
  });

  it('un terme gardé seul reste non traduit, signalé ONLY_FRENCH_KEPT pour être compté à part (M25)', () => {
    const engine = withKept([entry('X-6', 'Le reçu', []), entry('X-7', 'Le reçu du bordereau', [])]);
    const alone = engine.translate('Le reçu');
    expect(alone).toMatchObject({ status: 'PARTIAL', output: null });
    expect(alone.units[0]?.reasons).toContain('ONLY_FRENCH_KEPT');
    expect(onlyFrenchKept(alone)).toBe(true);
    const missing = engine.translate('Le reçu du bordereau');
    expect(missing.status).not.toBe('SUCCESS');
    expect(missing.units[0]?.reasons).not.toContain('ONLY_FRENCH_KEPT');
    expect(onlyFrenchKept(missing)).toBe(false);
  });

  it('kept-french-terms.json : refuse un terme en double ou à la fois gardé et exclu', () => {
    const root = mkdtempSync(join(tmpdir(), 'finethnic-kept-'));
    const write = (data: unknown): void => {
      mkdirSync(join(root, 'data/language-resources'), { recursive: true });
      writeFileSync(join(root, KEPT_FRENCH_PATH), JSON.stringify(data));
    };
    try {
      write({ groups: [{ terms: ['compte', ' mot de passe '] }], excluded: [{ fr: 'case' }] });
      expect(readKeptFrench(root)).toEqual(['compte', 'mot de passe']);
      write({ groups: [{ terms: ['compte'] }, { terms: ['Compte'] }] });
      expect(() => readKeptFrench(root)).toThrow(/terme en double « Compte »/u);
      write({ groups: [{ terms: ['case'] }], excluded: [{ fr: 'case' }] });
      expect(() => readKeptFrench(root)).toThrow(/à la fois gardé et exclu/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('readPartitives (M21)', () => {
  it('lit la section facultative et refuse un nom en double ou mal écrit', () => {
    const root = mkdtempSync(join(tmpdir(), 'finethnic-part-'));
    const write = (data: unknown): void => {
      mkdirSync(join(root, 'data/language-resources'), { recursive: true });
      writeFileSync(join(root, GRAMMAR_RULES_PATH), JSON.stringify(data));
    };
    try {
      write({ ignoredWords: [] });
      expect(readPartitives(root)).toEqual([]);
      write({ partitives: [{ id: 'D7-PARTITIF', nouns: ['argent'], ref: 'D7', note: 'n' }] });
      expect(readPartitives(root)).toEqual([{ id: 'D7-PARTITIF', nouns: ['argent'], ref: 'D7' }]);
      write({ partitives: [{ id: 'D7-PARTITIF', nouns: ['argent', 'argent'], ref: 'D7' }] });
      expect(() => readPartitives(root)).toThrow(/doublon/u);
      write({ partitives: [{ id: 'D7-PARTITIF', nouns: ['Argent liquide'], ref: 'D7' }] });
      expect(() => readPartitives(root)).toThrow(/minuscules/u);
      // Connectifs (M26) : une forme d'un seul mot par classe.
      expect(readConnectives(root)).toEqual([]);
      write({ connectives: [{ id: 'D7-CONNECTIF-CLASSE', words: ['de', "d'"], forms: { '9': 'ì' }, ref: 'D7', note: 'n' }] });
      expect(readConnectives(root)).toEqual([{ id: 'D7-CONNECTIF-CLASSE', words: ['de', "d'"], forms: { '9': 'ì' }, ref: 'D7' }]);
      write({ connectives: [{ id: 'D7-CONNECTIF-CLASSE', words: ['de'], forms: { '9': 'ì mɔ̀ní' }, ref: 'D7' }] });
      expect(() => readConnectives(root)).toThrow(/une forme éton/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('createEngine', () => {
  it('décrit ses ressources et n’applique que les règles de classe A', () => {
    expect(ENGINE.info()).toMatchObject({ d8Entries: 5, d7Entries: D7_ENTRIES.length, criticalEntries: 1, wrongSenses: 0 });
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
