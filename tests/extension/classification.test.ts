import { describe, expect, it } from 'vitest';
import { classifyPageText } from '../../src/content/classification';

describe('classification des textes de la page (phase 2, §3.1)', () => {
  it.each([
    ['Montant', 'mot'],
    ['Frais de transfert', 'mot'],
    ['Votre compte', 'mot'],
    ['Voulez-vous continuer ?', 'phrase_interrogation'],
    ['Combien coûte le transfert ?', 'phrase_interrogation'],
    ['Saisissez votre code.', 'imperatif'],
    ['Transfert effectué !', 'exclamation'],
    ['Le montant saisi dépasse votre solde.', 'phrase_affirmation'],
    ['Votre transfert a été envoyé avec succès.', 'phrase_affirmation'],
  ])('« %s » → %s', (text, classe) => {
    expect(classifyPageText(text).classe).toBe(classe);
  });

  it('donne la classe de chaque phrase d’un paragraphe', () => {
    const result = classifyPageText('Votre transfert a été envoyé. Voulez-vous continuer ?');
    expect(result.classe).toBe('paragraphe');
    expect(result.phrases).toEqual(['phrase_affirmation', 'phrase_interrogation']);
  });

  it('signale la négation, à garder à la traduction', () => {
    expect(classifyPageText("Le transfert n'a pas été envoyé.").negation).toBe(true);
    expect(classifyPageText('Le transfert a été envoyé.').negation).toBe(false);
  });

  it('classe un texte sans mot à traduire comme un mot', () => {
    expect(classifyPageText('125 000 FCFA')).toEqual({ classe: 'mot', phrases: ['mot'], negation: false });
  });
});
