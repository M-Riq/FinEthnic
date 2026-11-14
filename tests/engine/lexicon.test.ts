import { describe, expect, it } from 'vitest';
import { isFinite, parseLexicon, parseLine } from '../../src/engine/lexicon';
import { LEXICON } from './support';

describe('lexicon — lecture du format de Lefff (moteur, PR 2)', () => {
  it('un code à plusieurs temps donne une lecture par temps', () => {
    expect(parseLine('dépasse\tv\tdépasser\tPS13s').map((r) => [r.mood, r.tense, r.persons, r.number])).toEqual([
      ['INDICATIVE', 'PRESENT', [1, 3], 'SINGULAR'],
      ['SUBJUNCTIVE', 'PRESENT', [1, 3], 'SINGULAR'],
    ]);
  });

  it('participes, noms et codes inconnus', () => {
    expect(parseLine('envoyées\tv\tenvoyer\tKfp')[0]).toMatchObject({ mood: 'PAST_PARTICIPLE', tense: null, gender: 'FEMININE', number: 'PLURAL' });
    expect(parseLine('facture\tnc\tfacture\tfs')[0]).toMatchObject({ pos: 'NOUN', mood: null, gender: 'FEMININE', number: 'SINGULAR' });
    expect(parseLine('x\tv\tx\t_error')[0]).toMatchObject({ pos: 'VERB', mood: null, persons: [] });
    expect(parseLine('incomplète\tv')).toEqual([]);
  });

  it('ignore commentaires, lignes vides et fins de ligne Windows ; la casse est ignorée à la recherche', () => {
    const lexicon = parseLexicon('# en-tête\n\npaie\tv\tpayer\tP3s\r\npaie\tnc\tpaie\tfs\n');
    expect(lexicon.size).toBe(1);
    expect(lexicon.lookup('Paie').map((r) => r.pos)).toEqual(['VERB', 'NOUN']);
    expect(lexicon.lookup('inconnu')).toEqual([]);
  });

  it('l’extrait versionné couvre la conjugaison complète des verbes de D8', () => {
    expect(LEXICON.lookup('enverrons').filter(isFinite).map((r) => [r.lemma, r.tense])).toEqual([['envoyer', 'FUTURE']]);
    expect(LEXICON.lookup('dépasse').every(isFinite)).toBe(true);
  });
});
