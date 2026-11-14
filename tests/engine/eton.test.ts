import { describe, expect, it } from 'vitest';
import { buildD7Index, chooseEntry, type D7Entry, isBoundForm, senseOf } from '../../src/engine/d7';
import { buildEton, ETON_RULES, type EtonText } from '../../src/engine/eton';
import { D7_ENTRIES, IGNORED } from './d7-fixture';
import { LEXICON } from './support';

const D7 = buildD7Index(D7_ENTRIES);
const GUARDS = ['Safinum', 'FCFA'];
const run = (text: string): EtonText => buildEton(text, D7, { guards: GUARDS, lexicon: LEXICON, ignored: IGNORED });
const gapIds = (r: EtonText): string[] => r.gaps.map((g) => (g.kind === 'WORD' ? `WORD:${g.fr}` : g.rule.id));

describe('d7 — index et choix (M6)', () => {
  it('cherche par clé normalisée, y compris les expressions de plusieurs mots', () => {
    expect(D7.get('pour rien').map((x) => x.eto)).toEqual(['á pûpùd']);
    expect(D7.maxWords).toBe(2);
  });

  it('préfère la catégorie attendue, puis une forme libre, puis la plus courte, et garde les autres', () => {
    const choice = chooseEntry(D7.get('langue'), new Set(['NOM']));
    expect(choice?.entry.eto).toBe('ù-jə́m');
    expect(choice?.alternatives.map((a) => a.eto)).toEqual(['ŋ̀-kɔ́lɔ̂']);
    expect(isBoundForm('-áŋ')).toBe(true);
    expect(isBoundForm('m-wán')).toBe(false);
  });

  it('décrit le sens : nombre de sens numérotés et précision entre parenthèses', () => {
    const [organ] = D7.get('langue').filter((x) => x.eto === 'ù-jə́m');
    expect(senseOf(organ as D7Entry, 'langue')).toEqual({ senses: 2, qualifier: 'organe' });
    expect(senseOf(D7.get('argent')[0] as D7Entry, 'argent')).toEqual({ senses: 1, qualifier: null });
  });
});

describe('buildEton — traduction complète (règles de classe A seulement)', () => {
  it('rend un infinitif et son complément dans l’ordre du français, sans article', () => {
    const r = run("Envoyer l'argent");
    expect(r.eto).toBe('lóm mɔ̀ní');
    expect(r.complete).toBe(true);
    expect(r.ambiguous).toEqual([]);
    expect(r.sentences[0]?.applied.map((x) => x.id)).toEqual(['D7-MOTS-IGNORES-1', ETON_RULES.ORDER.id]);
    expect(r.sentences[0]?.pieces[0]).toMatchObject({ fr: 'Envoyer', source: 'D7', ref: 'D7 p. 174 (lexique n° 1616)', by: 'FORM' });
  });

  it('garde les valeurs protégées et la ponctuation', () => {
    expect(run('Payer avec Safinum.').eto).toBe('yágnà èè Safinum.');
  });

  it('rend les impératifs irréguliers de D7 (« Va ! » kɛ̀ní, « Viens ! » zùgá)', () => {
    expect(run('Viens ici !').eto).toBe('zùgá mű !');
    expect(run('Va !').eto).toBe('kɛ̀ní !');
  });

  it('question oui/non : « də̀ » en tête ; mot interrogatif laissé à sa place', () => {
    expect(run('Quand ?').eto).toBe('ídɛ́n ?');
    const r = run("Est-ce que tu envoies l'argent ?");
    expect(r.draft).toBe('də̀ [tu] lóm mɔ̀ní ?');
    expect(gapIds(r)).toEqual([ETON_RULES.PRESENT.id]);
  });

  it('une expression de D7 l’emporte sur ses mots, même avec « rien » (« pour rien »)', () => {
    const r = run('Payer pour rien');
    expect(r.eto).toBe('yágnà á pûpùd');
  });
});

describe('buildEton — manques signalés, jamais inventés', () => {
  it('un mot absent de D7 donne un brouillon, pas une traduction', () => {
    const r = run('Envoyer le code');
    expect(r.eto).toBeNull();
    expect(r.draft).toBe('lóm [code]');
    expect(gapIds(r)).toEqual(['WORD:code']);
    expect([r.found, r.total]).toEqual([1, 2]);
  });

  it('le nom « compte » ne devient pas le verbe « compter » ; « de » partitif ne devient pas « un »', () => {
    expect(gapIds(run('Le compte'))).toEqual(['WORD:compte']);
    expect(gapIds(run("Envoyer de l'argent"))).toEqual(['WORD:de']);
  });

  it('une entrée de D7 d’une autre catégorie est écartée et citée (« prêt » nom ≠ bə̀bə̀ adverbe)', () => {
    expect(run('Le prêt').gaps).toEqual([
      { kind: 'WORD', fr: 'prêt', rejected: [{ eto: 'bə̀bə̀', category: 'ADV', ref: 'D7 p. 85 (lexique n° 203)' }] },
    ]);
  });

  it('temps, négation, possessif et pronom complément : règles de classe B ou C', () => {
    expect(gapIds(run("Il envoie l'argent."))).toEqual([ETON_RULES.PRESENT.id]);
    expect(gapIds(run("Il va envoyer l'argent."))).toEqual([ETON_RULES.FUTURE.id]);
    expect(gapIds(run("Envoyez l'argent."))).toEqual([ETON_RULES.IMPERATIVE_PLURAL.id]);
    expect(gapIds(run('Ne paie pas.'))).toEqual([ETON_RULES.IMPERATIVE.id, ETON_RULES.NEGATION_IMPERATIVE.id]);
    expect(gapIds(run('Payer ton enfant'))).toEqual([ETON_RULES.POSSESSIVE.id]);
    expect(gapIds(run('Il ne paie que 500 FCFA.'))).toEqual([ETON_RULES.PRESENT.id, ETON_RULES.RESTRICTION.id]);
  });

  it('« Personne ne vole » : négation, et le verbe non repéré n’est pas écrit à l’infinitif sans le dire', () => {
    const r = run('Personne ne vole.');
    expect(r.eto).toBeNull();
    expect(gapIds(r)).toContain(ETON_RULES.NEGATION.id);
    expect(gapIds(r)).toContain(ETON_RULES.VERB_FORM.id);
  });

  it('un auxiliaire de D7 trouvé par le lemme d’une forme non infinitive est un manque (« faux » → faillir ≠ yì)', () => {
    const r = run('faux message');
    expect(r.complete).toBe(false);
    expect(gapIds(r)).toEqual([ETON_RULES.VERB_FORM.id]);
  });

  it('forme liée, nombre devant un nom, préposition devant un infinitif, adverbe de lieu', () => {
    // Sans lexique, aucune catégorie n'écarte le radical lié « -áŋ » (combien) : jamais écrit seul.
    const bound = buildEton('Combien ?', D7);
    expect(bound.draft).toBe('[Combien] ?');
    expect(gapIds(bound)).toEqual([ETON_RULES.AGREEMENT.id]);
    expect(gapIds(run('un enfant'))).toEqual([ETON_RULES.NUMERAL.id]);
    expect(gapIds(run("l'argent à envoyer"))).toEqual([ETON_RULES.INFINITIVE.id]);
    // D7 : « íꜜlə́ á sí » (sous l'arbre) — l'adverbe suit le nom.
    expect(gapIds(run("sous l'arbre"))).toEqual([ETON_RULES.POSTPOSITION.id]);
  });

  it('signale le sens à confirmer : entrée à plusieurs sens', () => {
    const r = run('Langue');
    expect(r.eto).toBe('ù-jə́m');
    expect(r.ambiguous).toEqual(['Langue']);
    expect(r.sentences[0]?.pieces[0]).toMatchObject({ senses: 2, qualifier: 'organe', alternatives: [{ eto: 'ŋ̀-kɔ́lɔ̂' }] });
  });
});
