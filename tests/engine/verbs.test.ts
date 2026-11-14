import { describe, expect, it } from 'vitest';
import { classify } from '../../src/engine/classify';
import type { VerbFeatures } from '../../src/engine/verbs';
import { LEXICON } from './support';

/** Traits du seul verbe conjugué de la phrase, sous forme compacte. */
function verb(text: string): string {
  const verbs = classify(text, { lexicon: LEXICON }).sentences.flatMap((s) => s.finiteVerbs);
  expect(verbs).toHaveLength(1);
  const f = verbs[0]?.features as VerbFeatures;
  return [f.lemma, f.mood, f.time, f.aspect ?? '-', f.construction ?? '-', f.passive ? 'PASSIVE' : '', f.main?.lemma ?? '', f.ambiguous ? 'AMBIGUOUS' : '']
    .filter(Boolean).join(' ');
}

describe('verbs — moment, aspect et constructions (moteur, PR 2)', () => {
  it.each([
    ['MSG-072', 'Nous traitons votre demande.', 'traiter INDICATIVE PRESENT - -'],
    ['SEC-042', 'Nous ne vous demanderons jamais votre code de vérification.', 'demander INDICATIVE FUTURE - -'],
    ['MSG-064', 'Votre session a expiré.', 'avoir INDICATIVE PAST PERFECTIVE COMPOUND expirer'],
    ['MSG-059', 'Une erreur est survenue.', 'être INDICATIVE PAST PERFECTIVE COMPOUND survenir'],
    ['MSG-017', 'Les frais sont calculés automatiquement.', 'être INDICATIVE PRESENT - - PASSIVE calculer'],
    ['PAG-015', 'Ce bénéficiaire n’a jamais été utilisé sur ce compte', 'avoir INDICATIVE PAST PERFECTIVE COMPOUND PASSIVE utiliser'],
    ['SEC-048', 'Votre session va expirer dans {durée}.', 'aller INDICATIVE FUTURE - NEAR_FUTURE expirer'],
    ['PAG-014', 'Vérifiez toujours le numéro', 'vérifier IMPERATIVE PRESENT - -'],
  ])('%s « %s » → %s', (_id, text, expected) => {
    expect(verb(text)).toBe(expected);
  });

  it.each([
    ['Elle payait ses factures.', 'payer INDICATIVE PAST IMPERFECTIVE -'],
    ['Il paya la facture.', 'payer INDICATIVE PAST PERFECTIVE -'],
    ['Je viens de payer.', 'venir INDICATIVE PAST PERFECTIVE RECENT_PAST payer'],
    ['Il s’est connecté hier.', 'être INDICATIVE PAST PERFECTIVE COMPOUND connecter'],
    ['Vous aurez reçu le code.', 'avoir INDICATIVE FUTURE PERFECTIVE COMPOUND recevoir'],
    ['Le paiement a-t-il été envoyé ?', 'avoir INDICATIVE PAST PERFECTIVE COMPOUND PASSIVE envoyer'],
    ['Je vais à la banque.', 'aller INDICATIVE PRESENT - -'],
    ['Vous avez un compte.', 'avoir INDICATIVE PRESENT - -'],
  ])('« %s » → %s', (text, expected) => {
    expect(verb(text)).toBe(expected);
  });

  it('le sujet départage les lectures ; sinon l’ambiguïté est signalée', () => {
    expect(verb('Nous sommes contents.')).toBe('être INDICATIVE PRESENT - -');
    expect(verb('Je finis.')).toBe('finir INDICATIVE PRESENT - - AMBIGUOUS'); // présent ou passé simple
  });
});
