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
    expect(D7.maxWords).toBe(3);
  });

  it('préfère la catégorie attendue, puis une forme libre, puis la plus courte, et garde les autres', () => {
    const choice = chooseEntry(D7.get('langue'), new Set(['NOM']));
    expect(choice?.entry.eto).toBe('ù-jə́m');
    expect(choice?.alternatives.map((a) => a.eto)).toEqual(['ŋ̀-kɔ́lɔ̂']);
    expect(isBoundForm('-áŋ')).toBe(true);
    expect(isBoundForm('m-wán')).toBe(false);
  });

  it('décrit le sens : nombre de sens numérotés, précision entre parenthèses, sens premier', () => {
    const [organ] = D7.get('langue').filter((x) => x.eto === 'ù-jə́m');
    expect(senseOf(organ as D7Entry, 'langue')).toEqual({ senses: 2, qualifier: 'organe', primary: true });
    expect(senseOf(D7.get('argent')[0] as D7Entry, 'argent')).toEqual({ senses: 1, qualifier: null, primary: true });
    // « rejeter » ouvre le 3e sens de pàzì : sens premier de ce sens, mais mot à plusieurs sens.
    expect(senseOf(D7.get('rejeter')[0] as D7Entry, 'rejeter')).toEqual({ senses: 3, qualifier: null, primary: true });
  });

  it('un seul sens si chaque sens numéroté contient la clé (bɛ̀n : « 1) refuser… 2) refuser… »)', () => {
    expect(senseOf(D7.get('refuser')[0] as D7Entry, 'refuser')).toMatchObject({ senses: 1, primary: true });
  });

  it('sens second : lìŋ veut d’abord dire « épargner », pas « mettre de côté »', () => {
    expect(senseOf(D7.get('mettre de côté')[0] as D7Entry, 'mettre de côté')).toEqual({ senses: 1, qualifier: null, primary: false });
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
    const r = run("Est-ce que vous envoyez l'argent ?");
    expect(r.draft).toBe('də̀ [vous] lóm mɔ̀ní ?');
    expect(gapIds(r)).toEqual([ETON_RULES.PRESENT.id]);
    expect(run("Est-ce que tu envoies l'argent ?").eto).toBe('də̀ ùtə́ ꜜlóm mɔ̀ní ?');
  });

  it('présent avec « je », « tu », « nous » (M19) : reproduit « mə̀tə́ ꜜdí » de D7 ; ꜜ seulement devant un ton haut', () => {
    const r = run('Je mange.');
    expect(r.eto).toBe('mə̀tə́ ꜜdí.');
    expect(r.sentences[0]?.applied.map((x) => x.id)).toContain(ETON_RULES.PRESENT_PRONOUN.id);
    expect(r.sentences[0]?.pieces.find((p) => p.fr === 'mange')?.eto).toBe('dí');
    expect(run('Tu attends.').eto).toBe('ùtə́ yàŋà.');
    expect(run("Nous envoyons l'argent.").eto).toBe('ɛ̀tə́ ꜜlóm mɔ̀ní.');
    expect(run("J'envoie l'argent.").eto).toBe('mə̀tə́ ꜜlóm mɔ̀ní.');
  });

  it('présent : rien n’est produit pour vous, il, elle, ils, un nom sujet, la négation ou un verbe suivi d’un infinitif', () => {
    for (const text of ['Vous mangez.', 'Il mange.', 'Elles mangent.', "L'enfant mange.", 'Je ne mange pas.', 'Je veux payer.', 'Je viens payer.', 'Je viens vite payer.', 'Tu veux de l’argent.', 'Mange-t-il ?']) {
      const r = run(text);
      expect(r.eto, text).toBeNull();
      expect(r.draft, text).not.toMatch(/tə́/);
    }
    expect(gapIds(run('Je ne mange pas.'))).toEqual([ETON_RULES.PRESENT.id, ETON_RULES.NEGATION.id]);
  });

  it('une expression de D7 l’emporte sur ses mots, même avec « rien » (« pour rien »)', () => {
    const r = run('Payer pour rien');
    expect(r.eto).toBe('yágnà á pûpùd');
  });
});

describe('buildEton — termes français gardés (M20)', () => {
  const KEPT = ['compte', 'code', 'code secret', 'reçu', 'argent'];
  const kept = (text: string): EtonText => buildEton(text, D7, { guards: GUARDS, lexicon: LEXICON, ignored: IGNORED, kept: KEPT });

  it('un nom de la liste reste en français, signalé, et la phrase est complète', () => {
    const r = kept('Envoyer le code');
    expect(r).toMatchObject({ eto: 'lóm code', complete: true, kept: ['code'], gaps: [], found: 1, total: 2 });
    expect(r.sentences[0]?.pieces.at(-1)).toMatchObject({ fr: 'code', eto: 'code', source: 'FRENCH', ref: null });
  });

  it('terme de plusieurs mots (le plus long d’abord) et pluriel par le lemme', () => {
    expect(kept('Envoyer le code secret')).toMatchObject({ eto: 'lóm code secret', kept: ['code secret'] });
    expect(kept('Envoyer les comptes')).toMatchObject({ eto: 'lóm comptes', kept: ['comptes'] });
  });

  it('D7 passe avant la liste ; un verbe ou un participe n’est pas gardé', () => {
    expect(kept("Envoyer l'argent")).toMatchObject({ eto: 'lóm mɔ̀ní', kept: [] });
    expect(kept("Je compte l'argent")).toMatchObject({ eto: 'mə̀tə́ ꜜláŋ mɔ̀ní', kept: [] });
    const received = kept("L'argent reçu");
    expect(received.kept).toEqual([]);
    expect(gapIds(received)).toContain('WORD:reçu');
  });

  it('une phrase sans aucun mot rendu par D7 n’est pas présentée comme traduite', () => {
    const r = kept('Le compte');
    expect(r).toMatchObject({ eto: null, complete: false, kept: [], draft: '[compte]' });
    expect(gapIds(r)).toEqual(['WORD:compte']);
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
