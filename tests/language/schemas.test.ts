import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatSchemaErrors, loadSchemaValidators } from '../../scripts/lib/schemas';

const validators = loadSchemaValidators();
const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const clone = <T>(value: T): T => structuredClone(value);
const valid = (name: keyof typeof validators, data: unknown): string[] => {
  const validate = validators[name];
  return validate(data) ? [] : formatSchemaErrors(validate.errors);
};

const testLexicon = JSON.parse(read('tests/language/fixtures/test-lexicon.json'));
const validEntries = JSON.parse(read('tests/language/fixtures/entries/valid-entries.json'));

describe('schéma d’entrée (data/schemas/entry.schema.json)', () => {
  it('accepte l’exemple de PROJECT_CONTEXT §4.5', () => {
    const doc = read('PROJECT_CONTEXT.md');
    const section = doc.slice(doc.indexOf('### 4.5 '), doc.indexOf('### 4.6 '));
    const jsonc = /```jsonc\n([\s\S]*?)```/u.exec(section)?.[1] ?? '';
    const example = JSON.parse(jsonc.replace(/\s+\/\/.*$/gmu, ''));
    expect(valid('entry', example)).toEqual([]);
  });

  it('accepte chaque entrée de la fixture valide', () => {
    for (const entry of validEntries) expect(valid('entry', entry), entry.id).toEqual([]);
  });

  it('refuse une entrée TRANSLATABLE sans cible Éton', () => {
    const entry = clone(validEntries[0]);
    entry.target.eto = null;
    expect(valid('entry', entry)).not.toEqual([]);
  });

  it('refuse une cible Éton sur une entrée protégée', () => {
    const entry = clone(validEntries.find((e: { id: string }) => e.id === 'GUARD-001'));
    entry.target.eto = clone(validEntries[0].target.eto);
    expect(valid('entry', entry)).not.toEqual([]);
  });

  it('refuse un statut de traduction inconnu et un code relecteur non conforme', () => {
    const entry = clone(validEntries.find((e: { id: string }) => e.id === 'TST-010'));
    entry.target.eto.translationStatus = 'APPROVED';
    expect(valid('entry', entry)).not.toEqual([]);
    const other = clone(validEntries.find((e: { id: string }) => e.id === 'TST-010'));
    other.target.eto.validation.reviews[0].reviewer = 'Marie';
    expect(valid('entry', other)).not.toEqual([]);
  });
});

describe('schéma du lexique d’exécution (data/schemas/lexicon.schema.json)', () => {
  it('accepte le lexique de test du contrat §12', () => {
    expect(valid('lexicon', testLexicon)).toEqual([]);
  });

  it('refuse une cible sur une entrée sans traduction retenue (I6)', () => {
    const lexicon = clone(testLexicon);
    lexicon.entries.find((e: { id: string }) => e.id === 'VOC-023').target = 'proposition';
    expect(valid('lexicon', lexicon)).not.toEqual([]);
  });

  it('refuse une entrée en attente sans traduction non vérifiée (contrat I3, §5.4)', () => {
    const lexicon = clone(testLexicon);
    lexicon.entries.find((e: { id: string }) => e.id === 'P4-012').unverifiedTarget = null;
    expect(valid('lexicon', lexicon)).not.toEqual([]);
  });

  it('refuse une traduction non vérifiée placée dans target, qui alimente output (contrat I3, Q9)', () => {
    const lexicon = clone(testLexicon);
    const entry = lexicon.entries.find((e: { id: string }) => e.id === 'P4-012');
    entry.target = entry.unverifiedTarget;
    expect(valid('lexicon', lexicon)).not.toEqual([]);
  });

  it('refuse une traduction non vérifiée sur une entrée approuvée ou non traduite', () => {
    for (const id of ['P2-001', 'VOC-023']) {
      const lexicon = clone(testLexicon);
      lexicon.entries.find((e: { id: string }) => e.id === id).unverifiedTarget = 'proposition';
      expect(valid('lexicon', lexicon)).not.toEqual([]);
    }
  });

  it('refuse une entrée approuvée sans cible', () => {
    const lexicon = clone(testLexicon);
    lexicon.entries.find((e: { id: string }) => e.id === 'P2-001').target = null;
    expect(valid('lexicon', lexicon)).not.toEqual([]);
  });

  it('n’utilise que des marqueurs ⟦TEST:<id>⟧ comme cibles (contrat §11 : aucune forme Éton réelle)', () => {
    for (const entry of testLexicon.entries) {
      for (const text of [entry.target, entry.unverifiedTarget]) {
        if (text !== null) expect(text).toBe(`⟦TEST:${entry.id}⟧`);
      }
    }
  });

  it('contient les entrées des exemples du contrat §12', () => {
    const ids = testLexicon.entries.map((e: { id: string }) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['P2-001', 'VOC-028', 'VOC-023', 'P4-012', 'VOC-034', 'GUARD-001', 'P5-002', 'TST-001', 'TST-002', 'VOC-008']));
  });
});

describe('schéma d’import de relecture (data/schemas/review-import.schema.json)', () => {
  const row = {
    id: 'VOC-023', sourceText: 'Montant', aspect: 'linguistic', decision: 'CORRECTED',
    text: '⟦TEST:VOC-023⟧', reviewer: 'LOC-01', date: '2026-11-20',
  };

  it('accepte une ligne complète', () => {
    expect(valid('review-import', { sheet: 'fiches-L1-P4.csv', rows: [row] })).toEqual([]);
  });

  it('refuse une ligne sans relecteur, ou corrigée sans texte', () => {
    const { reviewer: _omitted, ...withoutReviewer } = row;
    expect(valid('review-import', { sheet: 's.csv', rows: [withoutReviewer] })).not.toEqual([]);
    expect(valid('review-import', { sheet: 's.csv', rows: [{ ...row, text: null }] })).not.toEqual([]);
  });
});
