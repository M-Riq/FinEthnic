import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readLibraryEntries } from '../../scripts/lib/data-files';
import { buildL1Rows, L1_COLUMNS, renderCsv } from '../../scripts/lib/l1-sheet';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const rows = buildL1Rows(readLibraryEntries(ROOT).entries);
const row = (id: string) => rows.find((r) => r['ID'] === id);

describe('fiche L1 (BM2.5)', () => {
  it('a une ligne par texte unique des pages, répétitions indiquées', () => {
    expect(rows).toHaveLength(52);
    expect(row('P4-3')).toBeUndefined();
    expect(row('P2-3')?.['Aussi présent en']).toBe('P4-3, P5-4');
    expect(row('P1-1')?.['Étape']).toBe('1 - Solde et tableau de bord');
  });

  it('marque les 7 actions critiques du lot ①', () => {
    expect(rows.filter((r) => r['Lot'] === '①').map((r) => r['ID'])).toEqual(['P2-4', 'P2-10', 'P2-12', 'P2-13', 'P4-5', 'P4-11', 'P4-12']);
  });

  it('distingue les liens exact et par le sens, sans reprendre ce qui ne concerne que le gabarit', () => {
    expect(row('P2-6')).toMatchObject({ 'Lien avec le corpus': 'PAG-010 (même texte, même traduction)', 'À garder tel quel': 'Safinum' });
    expect(row('P4-5')).toMatchObject({
      'Lien avec le corpus': 'MSG-038 « Total débité : {total} {devise} » (même sens, traduction séparée)',
      'Gabarit lié': 'MSG-038 « Total débité : {total} {devise} »',
      'À garder tel quel': '',
      'Remarque': '',
    });
  });

  it('laisse vides les colonnes de réponse : aucune forme Éton', () => {
    const answers = L1_COLUMNS.slice(L1_COLUMNS.indexOf('Traduction éton (à remplir par la locutrice)'));
    expect(rows.every((r) => answers.every((c) => r[c] === ''))).toBe(true);
  });
});

describe('CSV pour tableur', () => {
  it('écrit UTF-8 avec BOM, « ; », guillemets doublés et fins de ligne CRLF', () => {
    expect(renderCsv(['ID', 'Texte'], [{ ID: 'P1-1', Texte: 'Dit « oui » ; puis "non"' }]))
      .toBe('\uFEFF"ID";"Texte"\r\n"P1-1";"Dit « oui » ; puis ""non"""\r\n');
  });

  it('refuse une cellule qu\'un tableur lirait comme une formule', () => {
    expect(() => renderCsv(['ID', 'Texte'], [{ ID: 'P1-1', Texte: '=1+1' }])).toThrow('formule de tableur');
  });
});
