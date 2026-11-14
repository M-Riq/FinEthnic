import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCorpus, type CorpusEntry } from '../../src/engine/corpus';
import { fillVariables, simplify, type SimplifiedUnit } from '../../src/engine/simplify';
import { readLibraryEntries } from '../../scripts/lib/data-files';
import { corpusEntries, guardTexts } from '../../scripts/lib/engine-corpus';
import { LEXICON } from './support';

const GUARDS = ['Safinum', 'Safinum Pay', 'FCFA', 'XAF'];
const entry = (id: string, text: string, synonyms: string[] = [], definition: string | null = null): CorpusEntry => ({ id, text, synonyms, definition });

const CORPUS = buildCorpus([
  entry('T-1', 'Frais : {frais} {devise}', ['Prix du service : {frais} {devise}'], 'Ce que coûte le service : {frais} {devise}.'),
  entry('T-2', 'De {expediteur} à {destinataire}', ['Envoyé par {expediteur} pour {destinataire}']),
  entry('W-1', 'Transfert', ["envoyer de l'argent", "envoi d'argent"], "Envoi d'argent d'un compte à un autre."),
  entry('W-2', 'Solde disponible', ['ton argent', 'argent utilisable']),
  entry('W-3', 'Débiter', ["enlever l'argent"]),
  entry('W-4', 'Sans frais', ['gratuit']),
  entry('W-5', 'Montant', []),
  entry('S-1', 'Le paiement a échoué.', ["Le paiement n'a pas marché.", 'Le paiement ne marche pas.']),
  entry('S-2', 'Vérifiez le montant', ['Regarde bien la somme']),
], { guards: GUARDS, lexicon: LEXICON });

const run = (text: string): SimplifiedUnit[] => simplify(text, CORPUS, { guards: GUARDS, lexicon: LEXICON }).units;
const texts = (u: SimplifiedUnit | undefined): string[] => u?.candidates.map((c) => `${c.source}:${c.text}`) ?? [];

describe('buildCorpus', () => {
  it('sépare les entrées exactes, les modèles à variables et les termes sans verbe conjugué', () => {
    expect(CORPUS.templates.map((t) => t.entry.id)).toEqual(['T-1', 'T-2']);
    expect([...CORPUS.terms.values()].map((e) => e.id)).toEqual(['W-1', 'W-2', 'W-3', 'W-4']);
    expect(CORPUS.exact.get('vérifiez le montant')?.id).toBe('S-2');
  });
});

describe('simplify — correspondance exacte (EXACT)', () => {
  it('ignore la casse, les espaces et la ponctuation finale ; rend les synonymes puis la définition', () => {
    const [u, ...rest] = run('  le paiement   a échoué ! ');
    expect(rest).toEqual([]);
    expect(u?.match).toBe('EXACT');
    expect(u?.entryId).toBe('S-1');
    expect(texts(u)).toEqual(['ORIGINAL:le paiement a échoué !', "SYNONYM:Le paiement n'a pas marché.", 'SYNONYM:Le paiement ne marche pas.']);
  });

  it('signale les traits perdus par un synonyme de D8 sans l’écarter', () => {
    const [u] = run('Vérifiez le montant.');
    expect(u?.candidates[1]).toMatchObject({ source: 'SYNONYM', text: 'Regarde bien la somme', lost: [] });
    const [past] = run('Le paiement a échoué.');
    expect(past?.candidates.map((c) => c.lost)).toEqual([[], [], ['TIME:PAST']]);
  });

  it('remplit les variables d’un modèle avec les valeurs du texte reçu', () => {
    const [u] = run('Frais : 500 FCFA');
    expect(u?.entryId).toBe('T-1');
    expect(u?.values).toEqual({ '{frais}': '500 FCFA', '{devise}': '' });
    expect(texts(u)).toEqual(['ORIGINAL:Frais : 500 FCFA', 'SYNONYM:Prix du service : 500 FCFA', 'DEFINITION:Ce que coûte le service : 500 FCFA.']);
    const [v] = run('De Jean Mbarga à Marie Atangana');
    expect(v?.values).toEqual({ '{expediteur}': 'Jean Mbarga', '{destinataire}': 'Marie Atangana' });
    expect(v?.candidates[1]?.text).toBe('Envoyé par Jean Mbarga pour Marie Atangana');
    expect(run('Frais :')[0]?.match).not.toBe('EXACT');
  });

  it('fillVariables retire une variable vide et son espace', () => {
    expect(fillVariables('Prix : {frais} {devise}.', new Map([['{frais}', '500 FCFA'], ['{devise}', '']]))).toBe('Prix : 500 FCFA.');
  });
});

describe('simplify — phrase nouvelle (PARTIAL, NONE)', () => {
  it('substitue les termes de D8 par leurs synonymes de même catégorie, sans doubler le déterminant', () => {
    const [u] = run('Votre solde disponible est bas.');
    expect(u?.match).toBe('PARTIAL');
    expect(texts(u)).toEqual(['ORIGINAL:Votre solde disponible est bas.', 'SUBSTITUTION:Votre argent utilisable est bas.']);
    const [t] = run('Transfert impossible');
    expect(texts(t)).toEqual(['ORIGINAL:Transfert impossible', "SUBSTITUTION:Envoi d'argent impossible"]);
  });

  it('écarte une variante qui perd un trait de la phrase', () => {
    const [u] = run('Envoi sans frais.');
    expect(u?.candidates.map((c) => c.source)).toEqual(['ORIGINAL']);
    expect(u?.rejected).toMatchObject([{ text: 'Envoi gratuit.', lost: ['NEGATION'] }]);
  });

  it('reconnaît un terme par son lemme, en note seulement, et relève les mots non couverts', () => {
    const [u] = run("Aucun montant n'a été débité.");
    expect(u?.terms).toMatchObject([{ entryId: 'W-3', term: 'Débiter', surface: 'débité', by: 'LEMMA' }]);
    expect(u?.candidates.map((c) => c.source)).toEqual(['ORIGINAL']);
    expect(u?.uncovered).toEqual(['montant']);
  });

  it('traite chaque phrase à part si le texte entier n’est pas dans D8 ; les phrases absentes sont en attente', () => {
    const result = simplify('Le paiement a échoué. Réessayez demain.', CORPUS, { guards: GUARDS, lexicon: LEXICON });
    expect(result.units.map((u) => u.match)).toEqual(['EXACT', 'NONE']);
    expect(result.pending).toEqual(['Réessayez demain.']);
  });

  it('un texte sans mot à traduire n’est pas en attente', () => {
    const result = simplify('Safinum Pay', CORPUS, { guards: GUARDS, lexicon: LEXICON });
    expect(result.units[0]?.translatable).toBe(false);
    expect(result.pending).toEqual([]);
  });

  it('sans lexique, aucune substitution n’est proposée', () => {
    const [u] = simplify('Votre solde disponible est bas.', CORPUS, { guards: GUARDS }).units;
    expect(u?.match).toBe('PARTIAL');
    expect(u?.candidates.map((c) => c.source)).toEqual(['ORIGINAL']);
  });
});

describe('simplify — corpus D8 réel', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const { entries } = readLibraryEntries(root);
  const guards = guardTexts(entries);
  const items = corpusEntries(entries);
  const corpus = buildCorpus(items, { guards, lexicon: LEXICON });

  it('chaque texte traduisible de D8 est reconnu tel quel (EXACT)', () => {
    const missed = items.filter((e) => {
      const { units, pending } = simplify(e.text, corpus, { guards, lexicon: LEXICON });
      return units.length !== 1 || units[0]?.match !== 'EXACT' || pending.length > 0;
    });
    expect(missed.map((e) => e.id)).toEqual([]);
  });

  it('un participe après un nom n’est pas le nom de D8 (« le code reçu » ≠ « Reçu ») ; après un déterminant, si', () => {
    const terms = (text: string): string[] =>
      simplify(text, corpus, { guards, lexicon: LEXICON }).units.flatMap((u) => u.terms.map((t) => `${t.term}/${t.by}`));
    expect(terms('Tape le code reçu.')).not.toContain('Reçu/FORM');
    expect(terms("L'argent reçu arrive.")).not.toContain('Reçu/FORM');
    expect(terms('Le montant arrondi arrive.')).not.toContain('Arrondi/FORM');
    expect(terms('Garde bien ce reçu.')).toContain('Reçu/FORM');
  });
});
