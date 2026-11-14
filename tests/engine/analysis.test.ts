import { describe, expect, it } from 'vitest';
import { analyzeGrammar, classifyText } from '../../src/engine/analysis';
import { LEXICON } from './support';

const analyze = (text: string) => analyzeGrammar(text, { lexicon: LEXICON });
const first = (text: string) => analyze(text).phrases[0];

describe('analyse grammaticale (§3.3)', () => {
  it('phrase négative : sujet, accord, ordre, temps et possessif', () => {
    const a = analyze('Votre solde n’est pas suffisant.');
    expect(a).toMatchObject({ classe: 'phrase_affirmation', negation: true });
    expect(a.phrases[0]).toMatchObject({
      mode: 'indicatif', moment: 'present', ordreMots: 'S V O',
      sujet: { texte: 'Votre solde', nature: 'nom', personne: 3, nombre: 'singulier', accord: true },
      possessifs: [{ mot: 'Votre', possesseur: { personne: 2, nombre: 'pluriel', pronom: 'vous' }, possede: { nom: 'solde' } }],
      sens: { acte: 'informer', polarite: 'negative', adresseAuLecteur: true, possessions: [{ possesseur: 'vous', objet: 'solde' }] },
    });
  });

  it('question totale au passé avec sujet inversé', () => {
    expect(first('Avez-vous payé vos frais ?')).toMatchObject({
      classe: 'phrase_interrogation', type: 'interrogation', question: { nature: 'totale' },
      temps: 'passe_compose', moment: 'passe', ordreMots: 'V S O',
      sujet: { texte: 'vous', nature: 'pronom', personne: 2 },
      possessifs: [{ mot: 'vos', possede: { nom: 'frais', nombre: 'pluriel' } }],
      sens: { acte: 'demander' },
    });
  });

  it('impératif : sujet implicite accordé à la 2e personne', () => {
    expect(first('Payez votre facture.')).toMatchObject({
      classe: 'imperatif', mode: 'imperatif', ordreMots: 'V O',
      sujet: { nature: 'implicite', personne: 2, nombre: 'pluriel' }, sens: { acte: 'ordonner' },
    });
  });

  it('dérivations : causatif (y compris à l’impératif) et pronominal', () => {
    expect(first('Le client a fait payer les frais.')?.derivations).toEqual(['causatif']);
    expect(first('Faites payer le client.')).toMatchObject({ classe: 'imperatif', derivations: ['causatif'] });
    expect(first('Faites payer le client.')?.verbes[0]).toMatchObject({ lemme: 'faire', lemmePrincipal: 'payer', derivation: 'causatif' });
    expect(first('Il se paie.')?.derivations).toEqual(['pronominal']);
    expect(first('Nous nous envoyons de l’argent.')?.derivations).toEqual(['pronominal']);
  });

  it('un pronom complément d’une autre personne que le sujet n’est pas un pronominal', () => {
    expect(first('Il me paie.')).toMatchObject({ derivations: [], verbes: [{ lemme: 'payer', derivation: null }] });
  });

  it('classifyText : mot, question, paragraphe', () => {
    expect(classifyText('Solde', { lexicon: LEXICON }).classe).toBe('mot');
    expect(classifyText('Voulez-vous payer ?', { lexicon: LEXICON }).classe).toBe('phrase_interrogation');
    expect(classifyText('Payez. Avez-vous payé ?', { lexicon: LEXICON })).toMatchObject({ classe: 'paragraphe', phrases: ['imperatif', 'phrase_interrogation'] });
  });
});
