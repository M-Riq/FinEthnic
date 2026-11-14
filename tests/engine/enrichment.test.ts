import { describe, expect, it } from 'vitest';
import type { CorpusEntry } from '../../src/engine/corpus';
import { buildD7Index } from '../../src/engine/d7';
import { createEnrichedCorpus, createMemoryCorpusStore } from '../../src/engine/d8-store';
import { createD8Index, dedupKey, filterAbsent } from '../../src/engine/dedup';
import { createEngine } from '../../src/engine/engine';
import { createEnricher, toEngineEntries } from '../../src/engine/enrich';
import { definitionSentences } from '../../src/engine/simplify';
import { analyzeGrammar } from '../../src/engine/analysis';
import { chainSimplifiers, createRuleSimplifier, sameGrammar, type Simplifier } from '../../src/engine/simplifier';
import { D7_ENTRIES, IGNORED } from './d7-fixture';
import { LEXICON } from './support';

const entry = (id: string, text: string, synonyms: string[] = [], definition: string | null = null): CorpusEntry => ({ id, text, synonyms, definition });
const CORPUS: CorpusEntry[] = [
  entry('VOC-1', 'Tarif', ['prix'], 'Le prix à payer. Il change souvent.'),
  entry('VOC-2', 'Montant', ['somme', 'argent']),
  entry('ACT-1', 'Débiter', ['prendre'], 'Prendre l’argent du compte.'),
  entry('ACT-2', 'Virement', ['transfert bancaire'], "Un ordre bancaire. Envoyer l'argent. Encore une phrase. Et une quatrième."),
  entry('SEC-1', 'Code secret', ['mot caché']),
];
const RESOURCES = { corpus: CORPUS, guards: ['FCFA'], lexicon: LEXICON, d7: D7_ENTRIES, ignored: IGNORED, critical: ['SEC-1'] };
const SIMPLIFIER = createRuleSimplifier({ corpus: CORPUS, lexicon: LEXICON, guards: ['FCFA'] });

function setup() {
  const engine = createEngine(RESOURCES);
  const enricher = createEnricher({
    simplifier: SIMPLIFIER, d7: buildD7Index(D7_ENTRIES), lexicon: LEXICON, guards: ['FCFA'],
    translates: (t) => engine.translate(t).status === 'SUCCESS',
  });
  return { engine, enricher };
}

describe('déduplication avant envoi à D8 (§3.2)', () => {
  it('ignore casse, espaces, ponctuation et accents', () => {
    expect(dedupKey('  Débiter  !')).toBe(dedupKey('debiter'));
    expect(dedupKey('Le  TARIF, est-il à jour ?')).toBe(dedupKey('le tarif est il a jour'));
  });

  it('ne garde que les textes absents de D8, sans doublon ni texte sans mot', () => {
    const index = createD8Index(CORPUS);
    expect(index.has('TARIF ?')).toBe(true);
    expect(filterAbsent(['Tarif', 'Commission', 'commission !', '—', 'Frais de retrait'], index)).toEqual(['Commission', 'Frais de retrait']);
  });
});

describe('simplificateur à base de règles et de D8 (§3.4)', () => {
  it('mot : reprend synonymes et définition de l’entrée de D8', async () => {
    expect(await SIMPLIFIER.simplifyWord('Tarif', analyzeGrammar('Tarif'))).toEqual({
      synonymes: ['prix'], definition_simple: 'Le prix à payer. Il change souvent.', sources: ['VOC-1'],
    });
  });

  it('mot : une autre forme du lemme (participe pour un infinitif) ne reprend pas l’entrée', async () => {
    expect(await SIMPLIFIER.simplifyWord('débités', analyzeGrammar('débités', { lexicon: LEXICON }))).toBeNull();
  });

  it('phrase : variantes de même grammaire, avec élision et sans faute d’accord', async () => {
    const r = await SIMPLIFIER.simplifyPhrase('Le montant est payé.', analyzeGrammar('Le montant est payé.', { lexicon: LEXICON }));
    expect(r?.variantes).toEqual(["L'argent est payé."]);
    const q = await SIMPLIFIER.simplifyPhrase('Avez-vous payé le tarif ?', analyzeGrammar('Avez-vous payé le tarif ?', { lexicon: LEXICON }));
    expect(q?.variantes).toEqual(['Avez-vous payé le prix ?']);
  });

  it('sameGrammar refuse une variante qui change le type ou la négation', () => {
    const g = (t: string) => analyzeGrammar(t, { lexicon: LEXICON });
    expect(sameGrammar(g('Avez-vous payé ?'), g('Vous avez payé.'))).toBe(false);
    expect(sameGrammar(g('Vous avez payé.'), g('Vous n’avez pas payé.'))).toBe(false);
  });

  it('chainSimplifiers : le premier qui répond est retenu et nommé', async () => {
    const silent: Simplifier = { name: 'vide', simplifyWord: async () => null, simplifyPhrase: async () => null };
    const r = await chainSimplifiers([silent, SIMPLIFIER]).simplifyWord('Tarif', analyzeGrammar('Tarif'));
    expect(r?.fournisseur).toBe('regles-d8');
  });
});

describe('définition essayée phrase par phrase (§3.5)', () => {
  it('découpe en 3 phrases au plus', () => {
    expect(definitionSentences('Un. Deux. Trois. Quatre.')).toEqual(['Un.', 'Deux.', 'Trois.']);
  });

  it('retient la première phrase de la définition entièrement traduisible', () => {
    const r = createEngine(RESOURCES).translate('Virement');
    expect(r).toMatchObject({ status: 'SUCCESS' });
    expect(r.units[0]?.chosen).toMatchObject({ source: 'DEFINITION', text: "Envoyer l'argent" });
    expect(r.units[0]?.alternatives.map((a) => a.text)).not.toContain('Et une quatrième.');
  });
});

describe('enrichissement et stockage de D8 (§3.4)', () => {
  it('statuts : texte simple, mot sans entrée, phrase avec variantes', async () => {
    const { enricher } = setup();
    const [simple] = await enricher.enrich('argent');
    expect(simple).toMatchObject({ statut: 'enrichi', complexite: { complexe: false }, synonymes: [], variantes: [] });
    const [unknown] = await enricher.enrich('débités');
    expect(unknown).toMatchObject({ classe: 'mot', statut: 'a_enrichir', synonymes: [], definition_simple: null });
    const [phrase] = await enricher.enrich('Le montant est payé.');
    expect(phrase).toMatchObject({ classe: 'phrase_affirmation', statut: 'enrichi', variantes: ["L'argent est payé."], sources: ['VOC-2'] });
    expect(phrase?.grammaire.phrases[0]?.moment).toBe('present');
    expect(toEngineEntries([unknown!, phrase!]).map((e) => e.id)).toEqual([phrase?.id]);
  });

  it('un paragraphe donne une entrée par phrase', async () => {
    const { enricher } = setup();
    expect((await enricher.enrich('Le montant est payé. Avez-vous payé le tarif ?')).map((e) => e.classe)).toEqual(['phrase_affirmation', 'phrase_interrogation']);
  });

  it('n’enrichit que les textes absents, une seule fois, et étend le moteur', async () => {
    const { engine, enricher } = setup();
    const store = createMemoryCorpusStore();
    const corpus = await createEnrichedCorpus({ base: CORPUS, store, enricher, guards: ['FCFA'], onAdded: (a) => engine.extend(toEngineEntries(a)) });
    const r = await corpus.submit(['Tarif', 'débités', 'Débités !', 'Le montant est payé.']);
    expect(r.added.map((e) => e.terme)).toEqual(['débités', 'Le montant est payé.']);
    expect(r.skipped).toBe(2);
    const [a, b] = await Promise.all([corpus.submit(['Commission']), corpus.submit(['commission'])]);
    expect(a.added.length + b.added.length).toBe(1);
    expect(store.entries).toHaveLength(3);
    expect(engine.info().d8Entries).toBe(CORPUS.length + 1);
    const chosen = engine.translate('Le montant est payé.').units[0]?.chosen;
    expect(chosen).toMatchObject({ source: 'SYNONYM', text: "L'argent est payé." });
  });

  it('retry reprend les entrées a_enrichir quand le simplificateur répond', async () => {
    let ready = false;
    const late: Simplifier = {
      name: 'tardif',
      simplifyWord: async () => (ready ? { synonymes: ['argent'], definition_simple: 'L’argent.', sources: [] } : null),
      simplifyPhrase: async () => null,
    };
    const enricher = createEnricher({ simplifier: late, d7: buildD7Index(D7_ENTRIES), lexicon: LEXICON });
    const store = createMemoryCorpusStore();
    const corpus = await createEnrichedCorpus({ base: CORPUS, store, enricher });
    expect((await corpus.submit(['Commission'])).added[0]?.statut).toBe('a_enrichir');
    ready = true;
    expect((await corpus.retry()).map((e) => [e.terme, e.statut, e.simplificateur])).toEqual([['Commission', 'enrichi', 'tardif']]);
    expect(await corpus.corpusEntries()).toEqual([{ id: expect.stringMatching(/^ENR-/), text: 'Commission', synonyms: ['argent'], definition: 'L’argent.' }]);
  });
});

describe('dérivation et participe dans la traduction', () => {
  it('causatif et pronominal sont signalés par une règle de classe C : jamais de traduction complète', () => {
    const engine = createEngine(RESOURCES);
    const rules = (t: string) => engine.translate(t).units.flatMap((u) => u.chosen?.eton?.gaps ?? []).flatMap((g) => (g.kind === 'RULE' ? [g.rule.id] : []));
    expect(engine.translate('Il fait payer.').status).not.toBe('SUCCESS');
    expect(rules('Il fait payer.')).toContain('D7-CAUSATIF');
    expect(rules('Il se paie.')).toContain('D7-PRONOMINAL');
    expect(rules('Il me paie.')).not.toContain('D7-PRONOMINAL');
  });

  it('« Avez-vous reçu » : le participe après le sujet inversé n’est pas le nom « Reçu »', () => {
    const engine = createEngine({ ...RESOURCES, corpus: [...CORPUS, entry('DOC-1', 'Reçu', ['ticket'])] });
    const texts = engine.translate('Avez-vous reçu le tarif ?').units.flatMap((u) => [u.chosen, ...u.alternatives]).map((c) => c?.text);
    expect(texts).toContain('Avez-vous reçu le prix ?');
    expect(texts.some((t) => t?.includes('ticket'))).toBe(false);
  });
});

describe('engine.extend', () => {
  it('une entrée ajoutée qui contient un terme critique devient critique', () => {
    const engine = createEngine(RESOURCES);
    expect(engine.info().criticalEntries).toBe(1);
    engine.extend([entry('ENR-1', 'Votre code secret', ['votre mot caché']), entry('ENR-2', 'Expédier', ['envoyer'])]);
    expect(engine.info()).toMatchObject({ criticalEntries: 2, d8Entries: CORPUS.length + 2 });
    expect(engine.translate('Expédier')).toMatchObject({ status: 'SUCCESS', output: 'lóm' });
  });
});
