import { describe, expect, it } from 'vitest';
import { normalize } from '../../src/engine/normalize';

const GUARDS = ['Safinum', 'Safinum Pay', 'FCFA', 'XAF'];
const tokens = (text: string) => normalize(text, { guards: GUARDS }).tokens.map((t) => `${t.kind}:${t.text}${t.enclitic ? '~' : ''}`);

describe('normalize (moteur, PR 1)', () => {
  it('garde l’original et les espaces de bord ; unifie espaces et apostrophes sans toucher accents ni casse', () => {
    const n = normalize('  L’Opération\u202F:\u00A0réussie  \n');
    expect(n.original).toBe('  L’Opération\u202F:\u00A0réussie  \n');
    expect(n.leading).toBe('  ');
    expect(n.trailing).toBe('  \n');
    expect(n.text).toBe("L'Opération : réussie");
    expect(n.tokens.map((t) => t.key)).toEqual(["l'", 'opération', ':', 'réussie']);
  });

  it('garde un saut de ligne interne (limite de phrase)', () => {
    expect(normalize('Ligne un \n\n Ligne deux').text).toBe('Ligne un\nLigne deux');
  });

  it('les positions des jetons pointent dans le texte normalisé', () => {
    const n = normalize("Qu'est-ce que l’on doit à Safinum Pay ?", { guards: GUARDS });
    for (const t of n.tokens) expect(n.text.slice(t.start, t.end)).toBe(t.text);
  });

  it('protège variables, montants, nombres, noms protégés, URL et e-mails', () => {
    expect(tokens('Envoyez 10 000 FCFA au +237 6 99 99 99 99 avec Safinum Pay.')).toEqual([
      'word:Envoyez', 'amount:10 000 FCFA', 'word:au', 'number:+237 6 99 99 99 99',
      'word:avec', 'guard:Safinum Pay', 'punct:.',
    ]);
    expect(tokens('Total : {total} {devise}')).toEqual(['word:Total', 'punct::', 'variable:{total}', 'variable:{devise}']);
    expect(tokens('Voir https://safinum.cm/aide. ou aide@safinum.cm')).toEqual([
      'word:Voir', 'url:https://safinum.cm/aide', 'punct:.', 'word:ou', 'email:aide@safinum.cm',
    ]);
    expect(tokens('Montant : 1 500,50 XAF à 10h30')).toEqual([
      'word:Montant', 'punct::', 'amount:1 500,50 XAF', 'word:à', 'number:10h30',
    ]);
  });

  it('un nom protégé n’est pas reconnu à l’intérieur d’un mot', () => {
    expect(tokens('Safinumien')).toEqual(['word:Safinumien']);
  });

  it('détache les élisions et les pronoms liés par un trait d’union', () => {
    expect(tokens("Connectez-vous à l'application")).toEqual(['word:Connectez', 'word:vous~', 'word:à', "word:l'", 'word:application']);
    expect(tokens('A-t-il reçu ?')).toEqual(['word:A', 'word:il~', 'word:reçu', 'punct:?']);
    expect(tokens("Qu'est-ce que")).toEqual(["word:Qu'", 'word:est', 'word:ce~', 'word:que']);
    expect(tokens("aujourd'hui")).toEqual(["word:aujourd'hui"]);
  });

  it('ne coupe pas les mots composés figés', () => {
    expect(tokens('Rendez-vous Wi-Fi ci-dessus peut-être')).toEqual([
      'word:Rendez-vous', 'word:Wi-Fi', 'word:ci-dessus', 'word:peut-être',
    ]);
  });

  it('texte vide ou blanc', () => {
    expect(normalize('').tokens).toEqual([]);
    const blank = normalize('   ');
    expect(blank.leading + blank.text + blank.trailing).toBe('   ');
    expect(blank.tokens).toEqual([]);
  });
});
