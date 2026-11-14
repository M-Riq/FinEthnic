import { describe, expect, it } from 'vitest';
import { buildD7Index, chooseEntry, type D7Entry, isBoundForm, senseOf } from '../../src/engine/d7';
import { buildEton, ETON_RULES, type EtonText } from '../../src/engine/eton';
import { LEXICON } from './support';

/**
 * Quelques entrées citées de D7 (Van de Velde & Essele Essele, CLÉ 2022, CC BY-NC-SA 4.0), avec leur
 * référence. Le dictionnaire complet reste hors de Git (Q17).
 */
const e = (fr: string, eto: string, category: string, gloss: string, ref: string): D7Entry => ({ fr, eto, category, gloss, ref });
const D7 = buildD7Index([
  e('à', 'á', 'PREP', 'dans, à', 'D7 p. 71 (lexique n° 1)'),
  e('pour rien', 'á pûpùd', 'ADV', 'pour rien, à fonds perdu', 'D7 p. 71 (lexique n° 3)'),
  e('sous', 'á sí', 'ADV', 'dessous, en bas, sous', 'D7 p. 71 (lexique n° 4)'),
  e('chez', 'ábɔ̂', 'PREP', 'chez', 'D7 p. 71 (lexique n° 15)'),
  e('combien', '-áŋ', 'ADJ', 'combien', 'D7 p. 76 (lexique n° 78)'),
  e('pour', 'ású', 'PREP', '1) pour, destiné à 2) pour, afin de', 'D7 p. 77 (lexique n° 105)'),
  e('prêt', 'bə̀bə̀', 'ADV', '1) proche 2) prêt', 'D7 p. 85 (lexique n° 203)'),
  e('avec', 'èè', 'PREP', '1) avec 2) et', 'D7 p. 105 (lexique n° 495)'),
  e('quand', 'ídɛ́n', 'ADV', 'quand?', 'D7 p. 124 (lexique n° 792)'),
  e('arbre', 'ì-lə́', 'NOM', 'arbre', 'D7 p. 131 (lexique n° 930)'),
  e('voler', 'jíb', 'VERBE', 'voler, commettre un vol', 'D7 p. 147 (lexique n° 1209)'),
  e('compter', 'láŋ', 'VERBE', '1) lire 2) compter, calculer', 'D7 p. 169 (lexique n° 1558)'),
  e('envoyer', 'lóm', 'VERBE', 'envoyer', 'D7 p. 174 (lexique n° 1616)'),
  e('argent', 'mɔ̀ní', 'NOM', 'argent', 'D7 p. 192 (lexique n° 1919)'),
  e('ici', 'mű', 'ADV', 'ici, là', 'D7 p. 194 (lexique n° 1962)'),
  e('enfant', 'm-wán', 'NOM', '1) enfant, fils ou fille d’une personne ou d’un animal 2) neveu, nièce', 'D7 p. 194 (lexique n° 1968)'),
  e('langue', 'ŋ̀-kɔ́lɔ̂', 'NOM', '1) langue 2) prise de parole', 'D7 p. 213 (lexique n° 2302)'),
  e('un', 'pwág', 'NUM', 'un', 'D7 p. 238 (lexique n° 2716)'),
  e('venir', 'sɔ́', 'VERBE', 'venir', 'D7 p. 248 (lexique n° 2867)'),
  e('langue', 'ù-jə́m', 'NOM', '1) langue (organe) 2) caquet, bavardage', 'D7 p. 259 (lexique n° 3060)'),
  e('payer', 'yágnà', 'VERBE', 'payer, récompenser, rémunérer', 'D7 p. 273 (lexique n° 3307)'),
]);
const IGNORED = [{ id: 'D7-MOTS-IGNORES-1', words: ['le', 'la', "l'", 'les', 'des'], ref: 'D7 p. 71 (lexique n° 15)' }];
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
