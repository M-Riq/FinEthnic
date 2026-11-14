import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contractExtras } from '../../scripts/lib/engine-corpus';
import { DICTIONARY_PATH } from '../../scripts/lib/engine-d7';
import { loadContractResources } from '../../scripts/lib/engine-load';
import { createEngineServer } from '../../scripts/lib/engine-server';
import { readLibraryEntries } from '../../scripts/lib/data-files';
import { type ContractResources, createContractEngine, MAX_TEXT_LENGTH } from '../../src/engine/contract-engine';
import { createEngine } from '../../src/engine/engine';
import type { TranslationRequest } from '../../src/language/contract';
import { checkResultShape } from '../contract/conformance';
import { MOT_TEST_RESOURCES } from '../contract/fixtures/mot-engine';

const req = (text: string, sourceLang: TranslationRequest['sourceLang'] = 'fr'): TranslationRequest => ({ text, sourceLang, targetLang: 'eto' });
const engine = (resources: ContractResources = MOT_TEST_RESOURCES, detectProtected?: (t: string) => string[]) =>
  createContractEngine(resources, detectProtected ? { cacheSize: 0, detectProtected } : { cacheSize: 0 });

describe('createContractEngine — segments protégés (I5)', () => {
  it('rend un montant avec espaces insécables octet pour octet', () => {
    const r = engine().translate(req('Montant : 5\u202F000\u00A0FCFA'));
    expect(r.status).toBe('PENDING_VALIDATION');
    expect(r.unverifiedKind).toBe('complete');
    expect(r.matchKind).toBe('composed');
    expect(r.entryId).toBeNull();
    expect(r.unverifiedOutput).toBe('⟦TEST:somme⟧ : 5\u202F000\u00A0FCFA');
    expect(r.protectedSegments).toEqual(['5\u202F000', 'FCFA']);
  });

  it('un texte fait seulement de segments signalés par l’extension est PROTECTED', () => {
    const r = engine(MOT_TEST_RESOURCES, (t) => (t.includes('TX-ABCD') ? ['TX-ABCD'] : [])).translate(req('TX-ABCD'));
    expect(r).toMatchObject({ status: 'PROTECTED', reason: 'protected-value', protectedSegments: ['TX-ABCD'] });
  });

  it('un segment signalé que le moteur traduit fait renoncer à la traduction', () => {
    const plain = engine().translate(req('Envoyer Argent'));
    expect(plain.status).toBe('PENDING_VALIDATION');
    const r = engine(MOT_TEST_RESOURCES, () => ['Argent']).translate(req('Envoyer Argent'));
    expect(r).toMatchObject({ status: 'NO_MATCH', unverifiedOutput: null });
  });

  it('une traduction validée qui perd un chiffre n’est pas affichée', () => {
    const resources = { ...MOT_TEST_RESOURCES, approved: new Map([['TST-EDGE', '⟦TEST:frais⟧ : FCFA']]) };
    const r = engine(resources).translate(req('Frais : 0 FCFA'));
    expect(r).toMatchObject({ status: 'KNOWN_UNTRANSLATED', output: null, entryId: 'TST-EDGE' });
  });
});

describe('createContractEngine — requêtes', () => {
  it('« auto » est traité comme du français, « en » n’est pas pris en charge (Q15)', () => {
    expect(engine().translate(req('Montant', 'auto'))).toMatchObject({ status: 'PENDING_VALIDATION', detectedSourceLang: 'fr', entryId: 'VOC-023' });
    expect(engine().translate(req('Montant', 'en'))).toMatchObject({ status: 'NO_MATCH', reason: 'unsupported-language' });
  });

  it('une entrée protégée est reconnue malgré la casse et les espaces', () => {
    expect(engine().translate(req('safinum  pay'))).toMatchObject({ status: 'PROTECTED', entryId: 'GUARD-001', matchKind: 'normalized', reason: 'protected-entry' });
  });

  it('une traduction rejetée par une locutrice n’est pas proposée (I6)', () => {
    expect(engine().translate(req('Compter'))).toMatchObject({ status: 'KNOWN_UNTRANSLATED', entryId: 'REJ-001', unverifiedOutput: null });
  });

  it('les décisions portées par une autre entrée de même texte comptent (libellés de pages)', () => {
    const corpus = [...MOT_TEST_RESOURCES.corpus, { id: 'P2-3', text: 'Montant', synonyms: [], definition: null }, { id: 'P2-1', text: 'Frais de transfert', synonyms: [], definition: null }];
    const rejectedOnPage = engine({ ...MOT_TEST_RESOURCES, corpus, rejected: new Set(['P2-3']) }).translate(req('Montant'));
    expect(rejectedOnPage).toMatchObject({ status: 'KNOWN_UNTRANSLATED', entryId: 'VOC-023' });
    const approvedOnPage = engine({ ...MOT_TEST_RESOURCES, corpus, approved: new Map([['P2-1', '⟦TEST:page⟧']]) }).translate(req('Frais de transfert'));
    expect(approvedOnPage).toMatchObject({ status: 'APPROVED', output: '⟦TEST:page⟧', entryId: 'TST-APP' });
    const conflicting = new Map([['TST-APP', '⟦TEST:a⟧'], ['P2-1', '⟦TEST:b⟧']]);
    expect(engine({ ...MOT_TEST_RESOURCES, corpus, approved: conflicting }).translate(req('Frais de transfert')).status).not.toBe('APPROVED');
  });

  it('une traduction validée n’est pas renvoyée si la ponctuation finale diffère', () => {
    expect(engine().translate(req('Frais de transfert')).status).toBe('APPROVED');
    expect(engine().translate(req('Frais de transfert ?')).status).not.toBe('APPROVED');
  });

  it('un texte trop long ou mal formé donne NO_MATCH sans exception (I2, I10)', () => {
    const e = engine();
    expect(e.translate(req('a'.repeat(MAX_TEXT_LENGTH + 1)))).toMatchObject({ status: 'NO_MATCH', reason: 'too-long' });
    expect(e.translate(req('\uD800 Montant')).status).toBe('NO_MATCH');
    expect(e.translate(null as unknown as TranslationRequest).status).toBe('NO_MATCH');
    expect(e.translateMany(null as unknown as TranslationRequest[])).toEqual([]);
    const thrower = engine(MOT_TEST_RESOURCES, () => {
      throw new Error('détection en panne');
    });
    expect(thrower.translate(req('Montant')).status).toBe('NO_MATCH');
  });
});

describe('createContractEngine — info()', () => {
  it('compte les entrées par statut et date la bibliothèque', () => {
    const info = engine().info();
    expect(info.entryCounts).toEqual({ approved: 2, pending: 1, untranslated: 2, protected: 2 });
    expect(engine().info().libraryVersion).toBe(info.libraryVersion);
    const changed = engine({ ...MOT_TEST_RESOURCES, rejected: new Set() }).info();
    expect(changed.libraryVersion).not.toBe(info.libraryVersion);
  });
});

describe('API HTTP locale — routes du contrat (MOT6)', () => {
  const server = createEngineServer(createEngine(MOT_TEST_RESOURCES), engine());
  let base = '';
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });
  const post = (body: string): Promise<Response> =>
    fetch(`${base}/contract/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

  it('POST /contract/translate : une requête ou une liste de requêtes', async () => {
    expect(await (await post(JSON.stringify(req('Montant')))).json()).toMatchObject({ status: 'PENDING_VALIDATION', entryId: 'VOC-023' });
    const many = (await (await post(JSON.stringify({ requests: [req('Safinum Pay'), req('Montant', 'en'), { text: 3 }] }))).json()) as { results: { status: string }[] };
    expect(many.results.map((r) => r.status)).toEqual(['PROTECTED', 'NO_MATCH', 'NO_MATCH']);
  });

  it('GET /contract/info', async () => {
    expect(await (await fetch(`${base}/contract/info`)).json()).toMatchObject({ contractVersion: '0.3.0', engineId: 'finethnic' });
  });

  it('refuse un corps qui n’est pas un objet JSON', async () => {
    const error = async (res: Response): Promise<[number, string]> => [res.status, ((await res.json()) as { error: string }).error];
    expect(await error(await post('['))).toEqual([400, 'INVALID_JSON']);
    expect(await error(await post('[]'))).toEqual([400, 'INVALID_BODY']);
    expect(await error(await post('{"requests": 1}'))).toEqual([400, 'INVALID_BODY']);
    expect(await error(await fetch(`${base}/contract/translate`))).toEqual([405, 'METHOD_NOT_ALLOWED']);
  });

  it('sans moteur contrat, les routes n’existent pas', async () => {
    const plain = createEngineServer(createEngine(MOT_TEST_RESOURCES));
    await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve));
    const res = await fetch(`http://127.0.0.1:${(plain.address() as AddressInfo).port}/contract/info`);
    await new Promise<void>((resolve) => plain.close(() => resolve()));
    expect(res.status).toBe(404);
  });
});

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('contractExtras — D8 réel', () => {
  const { entries } = readLibraryEntries(ROOT);
  const extras = contractExtras(entries);

  it('reprend toutes les entrées PROTECTED et OUT_OF_SCOPE actives', () => {
    const expected = entries.filter((e) => e.disposition !== 'TRANSLATABLE' && !e.deprecated).map((e) => e.id);
    expect(extras.protectedEntries.map((e) => e.id)).toEqual(expected);
  });

  it('ne compte comme validée qu’une traduction validée en langue et en sens financier', () => {
    for (const id of extras.approved.keys()) {
      const v = entries.find((e) => e.id === id)?.target.eto?.validation;
      expect([v?.linguistic, v?.financialMeaning]).toEqual(['VALIDATED', 'VALIDATED']);
    }
  });
});

// D7 n'est pas versionné (Q17) : ce contrôle ne tourne que là où le dictionnaire a été importé.
describe.skipIf(!existsSync(join(ROOT, DICTIONARY_PATH)))('createContractEngine — D8 et D7 réels', () => {
  it('tout texte de D8 (termes, synonymes, définitions) donne un résultat conforme', () => {
    const resources = loadContractResources(ROOT);
    const e = createContractEngine(resources, { cacheSize: 0 });
    const texts = [...new Set(resources.corpus.flatMap((c) => [c.text, ...c.synonyms, ...(c.definition ? [c.definition] : [])]))];
    const problems = texts.flatMap((text) => checkResultShape(req(text), e.translate(req(text))).map((p) => `${text} : ${p}`));
    expect(problems).toEqual([]);
  });
});
