import { describe, expect, it } from 'vitest';
import { createContractEngine } from '../../src/engine/contract-engine';
import type { EnrichedEntry } from '../../src/engine/enrich';
import type { Simplifier } from '../../src/engine/simplifier';
import {
  anonymize, CORPUS_KEY, corpusText, createChromeCorpusStore, type EvaluatedText, type NameReading, startCorpusSync,
} from '../../src/content/corpus-sync';
import type { TranslationRequest } from '../../src/language/contract';
import { MOT_TEST_RESOURCES } from '../contract/fixtures/mot-engine';
import { createFakeStorage } from './support/fake-storage';

const req = (text: string): TranslationRequest => ({ text, sourceLang: 'fr', targetLang: 'eto' });

/** Simplificateur de test : synonyme « somme » (dans le D7 de test) pour tout mot. */
const SOMME: Simplifier = {
  name: 'test',
  simplifyWord: async () => ({ synonymes: ['somme'], definition_simple: "C'est une somme.", sources: [] }),
  simplifyPhrase: async () => null,
};
const NOTHING: Simplifier = { name: 'vide', simplifyWord: async () => null, simplifyPhrase: async () => null };

function setup(storage = createFakeStorage().storage, simplifier: Simplifier = SOMME) {
  const engine = createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0 });
  const sync = startCorpusSync({ loaded: { engine, resources: MOT_TEST_RESOURCES }, store: createChromeCorpusStore(storage), simplifier });
  const evaluated = (...texts: string[]): EvaluatedText[] => texts.map((text) => ({ text, result: engine.translate(req(text)) }));
  return { engine, sync, evaluated };
}

const stored = (data: Map<string, unknown>): EnrichedEntry[] => (data.get(CORPUS_KEY) as EnrichedEntry[] | undefined) ?? [];

describe('couche corpus D8 de l’extension (phase 4)', () => {
  it('enrichit seulement les textes absents de D8, les garde sur l’appareil et les apprend au moteur', async () => {
    const fake = createFakeStorage();
    const { engine, sync, evaluated } = setup(fake.storage);
    await sync.ready;
    let learned = 0;
    sync.subscribe(() => learned++);
    expect(engine.translate(req('Tarif')).status).toBe('NO_MATCH');

    // « Montant » est dans D8, « Safinum Pay » est protégé : seul « Tarif » est nouveau.
    sync.offer(evaluated('Tarif', 'Montant', 'Safinum Pay', 'tarif !'));
    await sync.flush();
    expect(stored(fake.data).map((e) => [e.terme, e.statut, e.synonymes])).toEqual([['Tarif', 'enrichi', ['somme']]]);
    expect(learned).toBe(1);
    expect(engine.translate(req('Tarif'))).toMatchObject({ status: 'PENDING_VALIDATION', unverifiedKind: 'complete', unverifiedOutput: '⟦TEST:somme⟧' });

    // Un texte déjà proposé n'est ni comparé de nouveau, ni enregistré.
    const writes = fake.setCalls();
    sync.offer(evaluated('Tarif'));
    await sync.flush();
    expect(fake.setCalls()).toBe(writes);
    sync.stop();
  });

  it('ne garde aucune valeur protégée : elle devient {valeur}, et l’entrée couvre les autres montants', async () => {
    const fake = createFakeStorage();
    const { engine, sync, evaluated } = setup(fake.storage);
    sync.offer(evaluated('Tarif : 5 000 FCFA'));
    await sync.flush();
    expect(stored(fake.data).map((e) => e.terme)).toEqual(['Tarif : {valeur}']);
    expect(JSON.stringify([...fake.data.values()])).not.toMatch(/5 000/u);
    // Un autre montant est rattaché à la même entrée (gabarit), comme « Solde : {solde} » dans D8.
    expect(engine.translate(req('Tarif : 12 500 FCFA'))).toMatchObject({ entryId: stored(fake.data)[0]?.id, matchKind: 'template' });
    sync.stop();
  });

  it('au démarrage, apprend les entrées gardées et reprend celles qui étaient à enrichir', async () => {
    const fake = createFakeStorage();
    const first = setup(fake.storage, NOTHING);
    first.sync.offer(first.evaluated('Tarif', 'Cotisation'));
    await first.sync.flush();
    expect(stored(fake.data).map((e) => [e.terme, e.statut])).toEqual([['Tarif', 'a_enrichir'], ['Cotisation', 'a_enrichir']]);
    first.sync.stop();

    const second = setup(fake.storage, SOMME);
    await second.sync.ready;
    expect(stored(fake.data).map((e) => e.statut)).toEqual(['enrichi', 'enrichi']);
    expect(second.engine.translate(req('Cotisation')).status).toBe('PENDING_VALIDATION');
    second.sync.stop();
  });
});

describe('stockage et filtrage des textes', () => {
  const entry = (cle: string): EnrichedEntry =>
    ({ id: `ENR-${cle}`, terme: cle, cle, classe: 'mot', synonymes: [], variantes: [], definition_simple: null, statut: 'a_enrichir' }) as unknown as EnrichedEntry;

  it('garde au plus `max` entrées (les plus anciennes partent) et ignore une valeur mal formée', async () => {
    const fake = createFakeStorage({ [CORPUS_KEY]: [entry('a'), { cle: 'cassée' }, 'texte'] });
    const store = createChromeCorpusStore(fake.storage, 2);
    expect((await store.load()).map((e) => e.cle)).toEqual(['a']);
    await store.save([entry('b'), entry('c')]);
    expect((await store.load()).map((e) => e.cle)).toEqual(['b', 'c']);
    await store.save([entry('b')]);
    expect((await store.load()).map((e) => e.cle)).toEqual(['c', 'b']);
  });

  it('écarte les textes validés, protégés, trop longs ou peu français', () => {
    const engine = createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0 });
    const french = (word: string) => !['available', 'balance'].includes(word);
    const text = (t: string) => corpusText({ text: t, result: engine.translate(req(t)) }, french);
    expect(text('Frais de transfert')).toBeNull();
    expect(text('250 000 FCFA')).toBeNull();
    expect(text('Available balance')).toBeNull();
    expect(text('x'.repeat(2001))).toBeNull();
    expect(text('Tarif réduit')).toBe('Tarif réduit');
    // Lectures de Lefff : « Marie », « Pierre », « Claire », « Frais » ont aussi une lecture de nom propre.
    const proper = ['marie', 'pierre', 'claire', 'frais'];
    const common = ['reçu', 'de', 'bonjour', 'étape', 'sur', 'titulaire', 'du', 'compte', 'bénéficiaire', 'envoyé', 'par', 'votre', 'paiement', 'est', 'confirmé', 'retrait', 'paul.'];
    const nameReading = (key: string) => (proper.includes(key) ? 'proper' : common.includes(key) ? 'common' : 'unknown') as NameReading;
    const anon = (t: string) => anonymize(t, { guards: ['FCFA'], nameReading });
    expect(anon('Reçu :\u00A05\u202F000 FCFA de Paul Mbarga (+237 6 99 12 34 56, paul@exemple.cm)')).toBe(
      'Reçu : {valeur} de {valeur} {valeur} ({valeur}, {valeur})',
    );
    // Après « : », en capitales, ou prénom qui est aussi un mot courant : toujours un nom.
    expect(anon('Titulaire du compte : Mbarga')).toBe('Titulaire du compte : {valeur}');
    expect(anon('Bénéficiaire : Marie Claire')).toBe('Bénéficiaire : {valeur} {valeur}');
    expect(anon('Envoyé par PAUL MBARGA')).toBe('Envoyé par {valeur} {valeur}');
    expect(anon('Bonjour Marie Claire')).toBe('Bonjour {valeur} {valeur}');
    expect(anon('Paiement reçu de Pierre')).toBe('Paiement reçu de {valeur}');
    expect(anon('Marie, votre paiement est confirmé')).toBe('{valeur}, votre paiement est confirmé');
    // Début de phrase : un mot courant qui peut aussi être un nom propre reste.
    expect(anon('Frais de retrait. Étape 2 sur 3, {nom}')).toBe('Frais de retrait. Étape {valeur} sur {valeur}, {nom}');
    // Un texte déjà rattaché à D8 n'est pas proposé.
    const known = engine.translate(req('Frais de transfert'));
    expect(corpusText({ text: 'Frais de transfert', result: { ...known, status: 'KNOWN_UNTRANSLATED' } }, french)).toBeNull();
  });
});
