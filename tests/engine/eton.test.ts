import { describe, expect, it } from 'vitest';
import { buildD7Index, chooseEntry, type D7Entry, isBoundForm, senseOf } from '../../src/engine/d7';
import { augmented, buildEton, ETON_RULES, type EtonText, subjectClass } from '../../src/engine/eton';
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

  it('présent avec « il », « elle », « ils », « elles » ou un nom sujet (M28) : marque de la classe du nom (esquisse ex. 19)', () => {
    const r = run('Il mange.');
    expect(r.eto).toBe('àtə́ ꜜdí.');
    expect(r.sentences[0]?.applied.map((x) => x.id)).toContain(ETON_RULES.PRESENT_SUBJECT.id);
    expect(run('Elles mangent.').eto).toBe('bə́ꜜtə́ ꜜdí.');
    expect(run("L'enfant mange.").eto).toBe('m-wán àtə́ ꜜdí.');
    expect(run("L'arbre attend.").eto).toBe('ì-lə́ íꜜtə́ yàŋà.');
    expect(run('Le prix attend.').eto).toBe('táŋ ìtə́ yàŋà.');
    expect(run("L'argent attend.").eto).toBe('mɔ̀ní àtə́ yàŋà.');
    expect(run("Est-ce que l'enfant mange ?").eto).toBe('də̀ m-wán àtə́ ꜜdí ?');
  });

  it('« ne … pas » au présent (M28) : àá après la marque du sujet, formes attestées seulement', () => {
    const r = run('Je ne mange pas.');
    expect(r.eto).toBe('màáꜜtə́ ꜜdí.');
    expect(r.sentences[0]?.applied.map((x) => x.id)).toEqual(expect.arrayContaining([ETON_RULES.PRESENT_PRONOUN.id, ETON_RULES.NEGATION_PRESENT.id]));
    expect(run("Tu n'attends pas.").eto).toBe('wàátə́ yàŋà.');
    expect(run('Il ne mange pas.').eto).toBe('àáꜜtə́ ꜜdí.');
    expect(run('Ils ne mangent pas.').eto).toBe('bàáꜜtə́ ꜜdí.');
    expect(run("L'enfant ne mange pas.").eto).toBe('m-wán àáꜜtə́ ꜜdí.');
  });

  it('présent : rien n’est produit sans forme sûre (vous, négation non attestée, nom pluriel, nom sans classe, infinitif…)', () => {
    for (const text of ['Vous mangez.', 'Nous ne mangeons pas.', "L'arbre n'attend pas.", 'Les enfants mangent.', 'Le message attend.',
      'Je ne mange jamais.', "L'argent que tu n'attends pas.", 'Je veux payer.', 'Je viens payer.', 'Je viens vite payer.', 'Tu veux de l’argent.', 'Mange-t-il ?']) {
      const r = run(text);
      expect(r.eto, text).toBeNull();
      expect(r.draft, text).not.toMatch(/tə́/);
    }
    expect(gapIds(run('Nous ne mangeons pas.'))).toEqual([ETON_RULES.PRESENT.id, ETON_RULES.NEGATION.id]);
    expect(gapIds(run("L'arbre n'attend pas."))).toEqual([ETON_RULES.PRESENT.id, ETON_RULES.NEGATION.id]);
  });

  it('« être » au présent (M29) : sujet + nə̀ en une forme, négatif sə́, formes de D7 seulement', () => {
    const r = run('Je suis ici.');
    expect(r.eto).toBe('mə̀nə̀ mű.');
    expect(r.sentences[0]?.applied.map((x) => x.id)).toContain(ETON_RULES.COPULA.id);
    expect(run('Tu es ici.').eto).toBe('ùnə̀ mű.');
    expect(run('Nous sommes ici.').eto).toBe('ɛ̀nə̀ mű.');
    expect(run('Elle est ici.').eto).toBe('ànə̀ mű.');
    expect(run('Ils sont ici.').eto).toBe('bə́nə̂ mű.');
    expect(run("L'enfant est ici.").eto).toBe('m-wán ànə̀ mű.');
    expect(run("L'arbre est facile.").eto).toBe('ì-lə́ ínə̂ ì-bùbû.');
    expect(run('Le prix est ici.').eto).toBe('táŋ ìnə̀ mű.');
    expect(run('Est-ce que tu es ici ?').eto).toBe('də̀ ùnə̀ mű ?');
    expect(run("Elle n'est pas ici.").eto).toBe('àsə́ mű.');
    expect(run('Je ne suis pas ici.').eto).toBe('mə̀sə́ mű.');
  });

  it('« être » : rien n’est produit sans forme sûre (vous, négation non attestée, c’est, relative, sans complément…)', () => {
    for (const text of ['Vous êtes ici.', "Tu n'es pas ici.", "L'arbre n'est pas ici.", "C'est ici.", 'Le message est ici.',
      "L'enfant qui est ici.", "L'argent que tu es.", 'Il est.', 'Il est manger.', 'Je suis en train de manger.']) {
      const r = run(text);
      expect(r.eto, text).toBeNull();
      expect(r.draft, text).not.toMatch(/nə|sə́/u);
    }
    expect(gapIds(run('Il est.'))).toContain(ETON_RULES.PRESENT.id);
  });

  it('« qui » sujet au présent (M30) : augment + marque de la classe du nom + tə́ + infinitif, « qui » non traduit', () => {
    const r = run("La personne qui envoie l'argent.");
    expect(r.eto).toBe('í mód àtə́ ꜜlóm mɔ̀ní.');
    expect(r.sentences[0]?.applied.map((x) => x.id)).toContain(ETON_RULES.RELATIVE_SUBJECT.id);
    expect(run("L'arbre qui attend.").eto).toBe('í-lə́ íꜜtə́ yàŋà.');
    expect(augmented('m̀-mú')).toBe('ḿ-mú');
  });

  it('« qui » sujet : rien n’est produit sans augment ou classe sûrs (autre préfixe, s.g, pluriel, négation, « être », sans antécédent…)', () => {
    for (const text of ["L'enfant qui mange.", 'Le prix qui attend.', "L'argent qui attend.", 'Les personnes qui mangent.',
      'La personne qui ne mange pas.', 'La personne qui est ici.', 'Qui mange ?', 'Celui qui mange.', "Le message de l'arbre qui attend."]) {
      const r = run(text);
      expect(r.eto, text).toBeNull();
      expect(r.draft, text).not.toMatch(/tə́|nə/u);
    }
    expect(run("La personne qui envoie l'argent attend.").eto).toBeNull();
  });

  it('classe d’accord du nom sujet (M28)', () => {
    expect(subjectClass('7/8', false)).toBe('7');
    expect(subjectClass('3a/6', false)).toBe('3');
    expect(subjectClass('3u/5', false)).toBe('3');
    expect(subjectClass('s.g', false)).toBe('1');
    expect(subjectClass('9/10', true)).toBe('10');
    expect(subjectClass('6', true)).toBe('6');
    for (const [c, plural] of [['1/2', true], ['s.g', true], ['9', true], ['9/10, s.g', false], ['6 (5)', false]] as const) {
      expect(subjectClass(c, plural), c).toBeNull();
    }
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

describe('buildEton — partitif après un verbe (M21)', () => {
  const PARTITIVES = [{ id: 'D7-PARTITIF', nouns: ['argent', 'sel'], ref: 'D7 p. 81 (lexique n° 153)' }];
  const part = (text: string): EtonText => buildEton(text, D7, { guards: GUARDS, lexicon: LEXICON, ignored: IGNORED, partitives: PARTITIVES });
  const applied = (r: EtonText): string[] => r.sentences.flatMap((x) => x.applied.map((a) => a.id));

  it('« de l’ », « du » après un verbe et devant un nom de la liste disparaissent', () => {
    const r = part("Envoyer de l'argent");
    expect(r).toMatchObject({ eto: 'lóm mɔ̀ní', complete: true, gaps: [] });
    expect(applied(r)).toContain('D7-PARTITIF');
    expect(gapIds(part('Envoyer du sel'))).toEqual(['WORD:sel']);
  });

  it('« de » reste un manque ailleurs : nom hors liste, après un nom, en début de phrase', () => {
    expect(gapIds(part('Retirer du compte'))).toContain('WORD:du');
    expect(gapIds(part("Le prix de l'argent"))).toEqual(['WORD:de']);
    expect(gapIds(part("De l'argent"))).toEqual(['WORD:De']);
    expect(applied(part("Le prix de l'argent"))).not.toContain('D7-PARTITIF');
  });
});

describe('buildEton — connectif « de » entre deux noms (M26)', () => {
  const CONNECTIVES = [{ id: 'D7-CONNECTIF-CLASSE', words: ['de', 'du', "d'"], forms: { '1': 'à', '9': 'ì', 's.g': 'à' }, ref: 'D7 p. 196 (lexique n° 1991)' }];
  const conn = (text: string, kept: string[] = []): EtonText =>
    buildEton(text, D7, { guards: GUARDS, lexicon: LEXICON, ignored: IGNORED, connectives: CONNECTIVES, kept });
  const applied = (r: EtonText): string[] => r.sentences.flatMap((x) => x.applied.map((a) => a.id));

  it('la forme suit la classe du premier nom de D7 ; le second peut être un terme gardé', () => {
    const r = conn("Le prix de l'argent");
    expect(r).toMatchObject({ eto: 'táŋ ì mɔ̀ní', complete: true, gaps: [] });
    expect(applied(r)).toContain('D7-CONNECTIF-CLASSE');
    expect(conn("L'enfant du prix").eto).toBe('m-wán à táŋ');
    expect(conn("L'argent du compte", ['compte']).eto).toBe('mɔ̀ní à compte');
  });

  it('« de » reste un manque : classe sans forme, premier nom gardé en français, pas entre deux noms', () => {
    expect(gapIds(conn("L'arbre de l'argent"))).toEqual(['WORD:de']);
    expect(gapIds(conn("Le compte de l'argent", ['compte']))).toEqual(['WORD:de']);
    expect(gapIds(conn("Envoyer de l'argent"))).toEqual(['WORD:de']);
    expect(applied(conn("L'arbre de l'argent"))).not.toContain('D7-CONNECTIF-CLASSE');
  });

  it('pas de connectif séparé devant un second nom à voyelle initiale : la fusion n’est pas documentée', () => {
    expect(gapIds(conn("L'enfant de l'arbre"))).toEqual(['WORD:de']);
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
    expect(gapIds(run("Vous envoyez l'argent."))).toEqual([ETON_RULES.PRESENT.id]);
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

  it('nom + adjectif : aussi pour un adjectif rendu par un adverbe de D7, ou séparé du nom par un adverbe', () => {
    // D7 classe cə̀càd « petit, peu » parmi les adverbes : l'ordre avec le nom n'est pas attesté pour autant.
    expect(gapIds(run('petit argent'))).toEqual([ETON_RULES.ADJECTIVE.id]);
    expect(gapIds(run('argent petit'))).toEqual([ETON_RULES.ADJECTIVE.id]);
    expect(gapIds(run('prix plus facile'))).toEqual([ETON_RULES.ADJECTIVE.id]);
    // Un vrai adverbe à côté d'un nom n'est pas un adjectif : « pour rien » reste rendu.
    expect(run('Argent pour rien').eto).toBe('mɔ̀ní á pûpùd');
  });

  it('signale le sens à confirmer : entrée à plusieurs sens', () => {
    const r = run('Langue');
    expect(r.eto).toBe('ù-jə́m');
    expect(r.ambiguous).toEqual(['Langue']);
    expect(r.sentences[0]?.pieces[0]).toMatchObject({ senses: 2, qualifier: 'organe', alternatives: [{ eto: 'ŋ̀-kɔ́lɔ̂' }] });
  });
});
