import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  classify, negationIndices, questionParticleIndices, restrictionIndices, type SentenceAnalysis,
} from '../../src/engine/classify';
import { LEXICON } from './support';

const GUARDS = ['Safinum', 'Safinum Pay', 'FCFA', 'XAF'];

/** Résumé compact : forme, type, question, négation, restriction. */
const summary = (s: SentenceAnalysis): string =>
  [
    s.form ?? '-',
    s.type ?? '-',
    s.question ? `${s.question.kind}${s.question.markers.length ? `(${s.question.markers.join(',')})` : ''}` : '',
    s.negation.length ? `NEG(${s.negation.join(',')})` : '',
    s.restriction ? 'RESTRICTION' : '',
  ].filter(Boolean).join(' ');
const classifyAll = (text: string): string[] => classify(text, { guards: GUARDS }).sentences.map(summary);

describe('classify — textes réels de D8 (moteur, PR 1)', () => {
  it.each([
    ['ACT-001', 'Envoyer', 'WORD -'],
    ['ACT-023', 'Accepter les conditions', 'EXPRESSION -'],
    ['P1-1', 'Votre compte', 'EXPRESSION -'],
    ['PAG-010', 'Compte Safinum', 'EXPRESSION -'],
    ['MSG-040', 'Référence : {référence}', 'EXPRESSION -'],
    ['MSG-005', 'Aucune transaction récente.', 'EXPRESSION - NEG(aucune)'],
    ['SEC-018', 'Accès non autorisé', 'EXPRESSION - NEG(non)'],
    ['MSG-073', 'Besoin d’aide ?', 'EXPRESSION QUESTION YES_NO'],
    ['MSG-010', 'Votre compte est actif.', 'SIMPLE_SENTENCE STATEMENT'],
    ['MSG-072', 'Nous traitons votre demande.', 'SIMPLE_SENTENCE STATEMENT'],
    ['PAG-017', 'J’ai vérifié le nom et le numéro du bénéficiaire', 'SIMPLE_SENTENCE STATEMENT'],
    ['PAG-014', 'Vérifiez toujours le numéro', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['MSG-019', 'Veuillez saisir un montant valide.', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['SEC-060', 'Déconnectez-vous après chaque utilisation.', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['MSG-045', 'Voulez-vous vraiment annuler cette opération ?', 'SIMPLE_SENTENCE QUESTION YES_NO'],
    ['PAG-015', 'Ce bénéficiaire n’a jamais été utilisé sur ce compte', "SIMPLE_SENTENCE STATEMENT NEG(n',jamais)"],
    ['SEC-041', 'Ne communiquez jamais votre code PIN à personne.', 'SIMPLE_SENTENCE IMPERATIVE NEG(ne,jamais)'],
    ['SEC-042', 'Nous ne vous demanderons jamais votre code de vérification.', 'SIMPLE_SENTENCE STATEMENT NEG(ne,jamais)'],
    ['MSG-041', 'Je confirme que les informations ci-dessus sont exactes.', 'COMPLEX_SENTENCE STATEMENT'],
    ['SEC-053', 'Le code saisi est incorrect ou a expiré.', 'COMPLEX_SENTENCE STATEMENT'],
    ['SEC-051', 'Si vous n’êtes pas à l’origine de cette opération, contactez-nous immédiatement.', "COMPLEX_SENTENCE IMPERATIVE NEG(n',pas)"],
    ['SEC-057', 'Méfiez-vous des appels qui vous demandent de transférer de l’argent en urgence.', 'COMPLEX_SENTENCE IMPERATIVE'],
    ['SEC-059', 'Signalez toute opération que vous ne reconnaissez pas.', 'COMPLEX_SENTENCE IMPERATIVE NEG(ne,pas)'],
  ])('%s « %s » → %s', (_id, text, expected) => {
    expect(classifyAll(text)).toEqual([expected]);
  });

  it('découpe un texte de plusieurs phrases et classe chacune (MSG-054, MSG-064)', () => {
    expect(classifyAll('Transaction échouée. Aucun montant n’a été débité.')).toEqual([
      'EXPRESSION -', "SIMPLE_SENTENCE STATEMENT NEG(aucun,n')",
    ]);
    expect(classifyAll('Votre session a expiré. Veuillez vous reconnecter.')).toEqual([
      'SIMPLE_SENTENCE STATEMENT', 'SIMPLE_SENTENCE IMPERATIVE',
    ]);
  });

});

describe('classify — avec le lexique de Lefff (moteur, PR 2)', () => {
  const withLexicon = (text: string): SentenceAnalysis[] => classify(text, { guards: GUARDS, lexicon: LEXICON }).sentences;

  it('MSG-018 : reconnaît un verbe lexical sans autre indice', () => {
    const [s] = withLexicon('Le montant saisi dépasse votre solde disponible.');
    expect(summary(s as SentenceAnalysis)).toBe('SIMPLE_SENTENCE STATEMENT');
    expect(s?.finiteVerbs.map((v) => [v.key, v.features?.lemma, v.features?.time])).toEqual([['dépasse', 'dépasser', 'PRESENT']]);
    expect(summary(classify('Le montant saisi dépasse votre solde disponible.').sentences[0] as SentenceAnalysis)).toBe('EXPRESSION -');
  });

  it('une forme seulement verbale en tête de proposition est un impératif ; après un déterminant, ce n’est pas un verbe', () => {
    expect(withLexicon('Envoie le code.').map(summary)).toEqual(['SIMPLE_SENTENCE IMPERATIVE']);
    expect(withLexicon('Les sommes envoyées').map(summary)).toEqual(['EXPRESSION -']);
  });

  it('une forme aussi nominale est un impératif devant un déterminant de complément ou dans « ne … pas »', () => {
    expect(withLexicon('Garde ce papier.').map(summary)).toEqual(['SIMPLE_SENTENCE IMPERATIVE']);
    expect(withLexicon('Ne donne pas ton code.').map(summary)).toEqual(['SIMPLE_SENTENCE IMPERATIVE NEG(ne,pas)']);
    expect(withLexicon('Code du marchand').map(summary)).toEqual(['EXPRESSION -']);
    expect(withLexicon('La garde ce soir').map(summary)).toEqual(['EXPRESSION -']);
  });

  it('une forme coordonnée après un verbe à l’indicatif n’est pas un impératif', () => {
    expect(withLexicon('Le système vérifie et envoie le code.').map(summary)).toEqual(['COMPLEX_SENTENCE STATEMENT']);
    expect(withLexicon('Saisissez le montant et confirmez.').map(summary)).toEqual(['COMPLEX_SENTENCE IMPERATIVE']);
  });

  it('une lecture de nom propre de Lefff n’empêche pas l’impératif (« Viens », aussi nom de commune)', () => {
    expect(withLexicon('Viens !').map(summary)).toEqual(['SIMPLE_SENTENCE IMPERATIVE']);
  });

  it('« personne » devant « ne » est une négation, sauf après un déterminant ; « ne … que » est repéré', () => {
    const tokens = (text: string) => withLexicon(text)[0]?.tokens ?? [];
    expect([...negationIndices(tokens('Personne ne paie.'))]).toEqual([0, 1]);
    expect([...negationIndices(tokens('La personne ne paie pas.'))]).toEqual([2, 4]);
    expect([...restrictionIndices(tokens('Il ne paie que 500 FCFA.'))]).toEqual([1, 3]);
    expect([...questionParticleIndices(tokens('Est-ce que tu paies ?'))]).toEqual([0, 1, 2]);
  });

  it('sans lexique, les verbes n’ont pas de traits', () => {
    expect(classify('Votre compte est actif.').sentences[0]?.finiteVerbs.map((v) => v.features)).toEqual([null]);
  });
});

describe('classify — questions, négation, impératif', () => {
  it.each([
    ['Combien voulez-vous envoyer ?', 'SIMPLE_SENTENCE QUESTION WH(combien)'],
    ['À qui envoyez-vous l’argent ?', 'SIMPLE_SENTENCE QUESTION WH(qui)'],
    ['Vous payez combien ?', 'SIMPLE_SENTENCE QUESTION WH(combien)'],
    ['Pourquoi ?', 'WORD QUESTION WH(pourquoi)'],
    ['Est-ce que vous voulez payer ?', 'SIMPLE_SENTENCE QUESTION YES_NO'],
    ['Qu’est-ce que vous voulez ?', "SIMPLE_SENTENCE QUESTION WH(qu')"],
    // Inversion du sujet sans point d'interrogation : reste une question.
    ['Peut-il payer demain', 'SIMPLE_SENTENCE QUESTION YES_NO'],
    ['A-t-elle reçu l’argent ?', 'SIMPLE_SENTENCE QUESTION YES_NO'],
  ])('« %s » → %s', (text, expected) => {
    expect(classifyAll(text)).toEqual([expected]);
  });

  it.each([
    ['Pas de frais.', 'EXPRESSION - NEG(pas)'],
    ['Transfert sans frais', 'EXPRESSION - NEG(sans)'],
    ['Il n’y a plus de frais.', "SIMPLE_SENTENCE STATEMENT NEG(n',plus)"],
    // « ne … que » = « seulement » : signalé à part, ce n'est pas une négation.
    ['Vous ne payez que 500 FCFA.', 'SIMPLE_SENTENCE STATEMENT RESTRICTION'],
    ['Je pense que ce n’est pas possible.', "COMPLEX_SENTENCE STATEMENT NEG(n',pas)"],
  ])('négation : « %s » → %s', (text, expected) => {
    expect(classifyAll(text)).toEqual([expected]);
  });

  it.each([
    ['Envoyez-le à Paul !', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['Dis-moi le montant.', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['Continuez', 'SIMPLE_SENTENCE IMPERATIVE'],
    ['Quand vous payez, vérifiez le reçu.', 'COMPLEX_SENTENCE IMPERATIVE'],
    // Faux amis : nom composé, déterminant + « sommes ».
    ['Rendez-vous à 10h30', 'EXPRESSION -'],
    ['Les sommes envoyées', 'EXPRESSION -'],
    // Un seul verbe reconnu, mais une subordonnée : phrase complexe.
    ['Le montant que vous avez saisi dépasse le plafond.', 'COMPLEX_SENTENCE STATEMENT'],
  ])('« %s » → %s', (text, expected) => {
    expect(classifyAll(text)).toEqual([expected]);
  });

  it('signale l’exclamation et garde le détail des verbes', () => {
    const [s] = classify('Envoyez-le à Paul !').sentences;
    expect(s?.exclamative).toBe(true);
    expect(s?.finiteVerbs).toEqual([{ index: 0, key: 'envoyez', imperative: true, features: null }]);
  });

  it('un texte sans mot à traduire n’est pas traduisible', () => {
    expect(classify('{montant} {devise}').translatable).toBe(false);
    expect(classify('  Safinum Pay ', { guards: GUARDS }).translatable).toBe(false);
    expect(classify('').sentences).toEqual([]);
    expect(classify('Frais : {frais} {devise}').translatable).toBe(true);
  });
});

describe('moteur embarquable', () => {
  it('src/engine n’importe aucun module Node (il doit tourner dans l’extension)', () => {
    const dir = fileURLToPath(new URL('../../src/engine', import.meta.url));
    for (const file of readdirSync(dir)) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(/from ['"](?:node:|fs|path|os|child_process)/u);
    }
  });
});
